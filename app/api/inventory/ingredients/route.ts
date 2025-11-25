import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";
import type { CreateIngredientRequest } from "@/types/inventory";
import { logger } from "@/lib/logger";
import { requireVenueAccessForAPI } from "@/lib/auth/api";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";

// GET /api/inventory/ingredients?venue_id=xxx
export async function GET(_request: NextRequest) {
  try {
    const { searchParams } = new URL(_request.url);
    const venue_id = searchParams.get("venue_id");

    if (!venue_id) {
      return NextResponse.json({ error: "venue_id is required" }, { status: 400 });
    }

    // CRITICAL: Add authentication and venue access verification
    const venueAccessResult = await requireVenueAccessForAPI(venue_id);
    if (!venueAccessResult.success) {
      return venueAccessResult.response;
    }

    // CRITICAL: Add rate limiting
    const rateLimitResult = await rateLimit(_request, RATE_LIMITS.GENERAL);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        {
          error: "Too many requests",
          message: `Rate limit exceeded. Try again in ${Math.ceil((rateLimitResult.reset - Date.now()) / 1000)} seconds.`,
        },
        { status: 429 }
      );
    }

    const supabase = await createClient();

    // Fetch ingredients with current stock levels from view
    const { data, error } = await supabase
      .from("v_stock_levels")
      .select("*")
      .eq("venue_id", venue_id)
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

// POST /api/inventory/ingredients
export async function POST(_request: NextRequest) {
  try {
    const body: CreateIngredientRequest = await _request.json();

    const {
      venue_id,
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

    if (!venue_id || !name || !unit) {
      return NextResponse.json({ error: "venue_id, name, and unit are required" }, { status: 400 });
    }

    // CRITICAL: Add authentication and venue access verification
    const venueAccessResult = await requireVenueAccessForAPI(venue_id);
    if (!venueAccessResult.success) {
      return venueAccessResult.response;
    }

    // CRITICAL: Add rate limiting
    const rateLimitResult = await rateLimit(_request, RATE_LIMITS.GENERAL);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        {
          error: "Too many requests",
          message: `Rate limit exceeded. Try again in ${Math.ceil((rateLimitResult.reset - Date.now()) / 1000)} seconds.`,
        },
        { status: 429 }
      );
    }

    const supabase = await createClient();

    // Create ingredient
    const { data: ingredient, error: ingredientError } = await supabase
      .from("ingredients")
      .insert({
        venue_id,
        name,
        sku,
        unit,
        cost_per_unit,
        par_level,
        reorder_level,
        supplier,
        notes,
      })
      .select()
      .single();

    if (ingredientError) {
      logger.error("[INVENTORY API] Error creating ingredient:", {
        error: ingredientError.message,
      });
      return NextResponse.json({ error: ingredientError.message }, { status: 500 });
    }

    // If initial stock provided, create a receive ledger entry
    if (initial_stock && initial_stock > 0) {
      const { data: currentUser } = await supabase.auth.getSession();

      const { error: ledgerError } = await supabase.from("stock_ledgers").insert({
        ingredient_id: ingredient.id,
        venue_id,
        delta: initial_stock,
        reason: "receive",
        ref_type: "manual",
        note: "Initial stock",
        created_by: currentUser?.session?.user?.id || null,
      });

      if (ledgerError) {
        logger.error("[INVENTORY API] Error creating initial stock:", {
          error: ledgerError.message,
        });
        // Don't fail the request, ingredient is already created
      }
    }

    return NextResponse.json({ data: ingredient }, { status: 201 });
  } catch (_error) {
    logger.error("[INVENTORY API] Unexpected error:", {
      error: _error instanceof Error ? _error.message : "Unknown _error",
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
