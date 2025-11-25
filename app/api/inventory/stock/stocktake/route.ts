import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";
import type { StocktakeRequest } from "@/types/inventory";
import { logger } from "@/lib/logger";
import { withUnifiedAuth } from '@/lib/auth/unified-auth';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';

export const runtime = "nodejs";

// POST /api/inventory/stock/stocktake
export const POST = withUnifiedAuth(
  async (req: NextRequest, _context) => {
    try {
      // CRITICAL: Rate limiting
      const rateLimitResult = await rateLimit(req, RATE_LIMITS.GENERAL);
      if (!rateLimitResult.success) {
        return NextResponse.json(
          {
            error: 'Too many requests',
            message: `Rate limit exceeded. Try again in ${Math.ceil((rateLimitResult.reset - Date.now()) / 1000)} seconds.`,
          },
          { status: 429 }
        );
      }

      const supabase = await createClient();
      const body: StocktakeRequest = await req.json();

    const { ingredient_id, actual_count, note } = body;

    if (!ingredient_id || actual_count === undefined) {
      return NextResponse.json(
        { error: "ingredient_id and actual_count are required" },
        { status: 400 }
      );
    }

    // Get ingredient to find venue_id
    const { data: ingredient, error: ingredientError } = await supabase
      .from("ingredients")
      .select("venue_id")
      .eq("id", ingredient_id)
      .single();

    if (ingredientError || !ingredient) {
      return NextResponse.json({ error: "Ingredient not found" }, { status: 404 });
    }

    // Get current stock level
    const { data: stockLevel, error: stockError } = await supabase
      .from("v_stock_levels")
      .select("on_hand")
      .eq("ingredient_id", ingredient_id)
      .single();

    if (stockError) {
      logger.error("[INVENTORY API] Error fetching stock level:", { error: stockError.message });
      return NextResponse.json({ error: stockError.message }, { status: 500 });
    }

    const currentStock = stockLevel?.on_hand || 0;
    const delta = actual_count - currentStock;

    // Get current user
    const { data: currentUser } = await supabase.auth.getSession();

    // Create stocktake ledger entry
    const { data, error } = await supabase
      .from("stock_ledgers")
      .insert({
        ingredient_id,
        venue_id: ingredient.venue_id,
        delta,
        reason: "stocktake",
        ref_type: "manual",
        note: note || `Stocktake: ${currentStock} → ${actual_count}`,
        created_by: currentUser?.session?.user?.id || null,
      })
      .select()
      .single();

    if (error) {
      logger.error("[INVENTORY API] Error creating stocktake:", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(
      {
        data,
        previous_stock: currentStock,
        new_stock: actual_count,
        delta,
      },
      { status: 201 }
    );
    } catch (_error) {
      logger.error("[INVENTORY API] Unexpected error:", {
        error: _error instanceof Error ? _error.message : "Unknown _error",
      });
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
  },
  {
    extractVenueId: async (req) => {
      // Get venueId from ingredient in body
      try {
        const body = await req.json();
        const ingredientId = body?.ingredient_id;
        if (ingredientId) {
          const supabase = await createClient();
          const { data: ingredient } = await supabase
            .from("ingredients")
            .select("venue_id")
            .eq("id", ingredientId)
            .single();
          if (ingredient?.venue_id) {
            return ingredient.venue_id;
          }
        }
      } catch {
        // Ignore errors
      }
      // Fallback to query/body
      const url = new URL(req.url);
      return url.searchParams.get("venueId") || url.searchParams.get("venue_id");
    },
  }
);
