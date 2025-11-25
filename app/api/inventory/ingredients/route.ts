import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import type { CreateIngredientRequest } from "@/types/inventory";
import { logger } from "@/lib/logger";
import { withUnifiedAuth } from '@/lib/auth/unified-auth';
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";

// GET /api/inventory/ingredients?venue_id=xxx
export const GET = withUnifiedAuth(
  async (req: NextRequest, context) => {
    try {
      // CRITICAL: Rate limiting
      const rateLimitResult = await rateLimit(req, RATE_LIMITS.GENERAL);
      if (!rateLimitResult.success) {
        return NextResponse.json(
          {
            error: "Too many requests",
            message: `Rate limit exceeded. Try again in ${Math.ceil((rateLimitResult.reset - Date.now()) / 1000)} seconds.`,
          },
          { status: 429 }
        );
      }

      const adminSupabase = createAdminClient();

      // Fetch ingredients with current stock levels from view
      const { data, error } = await adminSupabase
        .from("v_stock_levels")
        .select("*")
        .eq("venue_id", context.venueId)
        .order("name", { ascending: true });

      if (error) {
        logger.error("[INVENTORY API] Error fetching ingredients:", {
          error: error instanceof Error ? error.message : "Unknown error",
        });
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ data });
    } catch (_error) {
      logger.error("[INVENTORY API] Unexpected error:", {
        error: _error instanceof Error ? _error.message : "Unknown _error",
      });
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
  }
);

// POST /api/inventory/ingredients
export const POST = withUnifiedAuth(
  async (req: NextRequest, context) => {
    try {
      // CRITICAL: Rate limiting
      const rateLimitResult = await rateLimit(req, RATE_LIMITS.GENERAL);
      if (!rateLimitResult.success) {
        return NextResponse.json(
          {
            error: "Too many requests",
            message: `Rate limit exceeded. Try again in ${Math.ceil((rateLimitResult.reset - Date.now()) / 1000)} seconds.`,
          },
          { status: 429 }
        );
      }

      const body: CreateIngredientRequest = await req.json();

      const {
        name,
        sku,
        unit,
        cost_per_unit = 0,
        par_level = 0,
        reorder_level = 0,
        supplier,
        notes,
        initial_stock,
      } = body;

      if (!name || !unit) {
        return NextResponse.json({ error: "name and unit are required" }, { status: 400 });
      }

      const adminSupabase = createAdminClient();

      // Create ingredient
      const { data: ingredient, error: ingredientError } = await adminSupabase
        .from("ingredients")
        .insert({
          venue_id: context.venueId,
          name,
          sku: sku || null,
          unit,
          cost_per_unit,
          par_level,
          reorder_level,
          supplier: supplier || null,
          notes: notes || null,
        })
        .select()
        .single();

      if (ingredientError) {
        logger.error("[INVENTORY API] Error creating ingredient:", {
          error: ingredientError instanceof Error ? ingredientError.message : "Unknown error",
        });
        return NextResponse.json({ error: ingredientError.message }, { status: 500 });
      }

      // If initial_stock is provided, create a stock movement
      if (initial_stock !== undefined && initial_stock !== null && initial_stock > 0) {
        const { error: movementError } = await adminSupabase.from("stock_movements").insert({
          venue_id: context.venueId,
          ingredient_id: ingredient.id,
          movement_type: "ADJUSTMENT",
          quantity: initial_stock,
          notes: "Initial stock",
        });

        if (movementError) {
          logger.error("[INVENTORY API] Error creating initial stock movement:", {
            error: movementError instanceof Error ? movementError.message : "Unknown error",
          });
          // Don't fail the request, just log the error
        }
      }

      return NextResponse.json({ data: ingredient });
    } catch (_error) {
      logger.error("[INVENTORY API] Unexpected error:", {
        error: _error instanceof Error ? _error.message : "Unknown _error",
      });
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
  }
);
