import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { logger } from "@/lib/logger";
import { withUnifiedAuth } from '@/lib/auth/unified-auth';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { isDevelopment } from '@/lib/env';
import { success, apiErrors, isZodError, handleZodError } from '@/lib/api/standard-response';
import { z } from 'zod';
import { validateBody } from '@/lib/api/validation-schemas';

export const runtime = "nodejs";

const stocktakeSchema = z.object({
  ingredient_id: z.string().uuid("Invalid ingredient ID"),
  actual_count: z.number().nonnegative("Actual count must be non-negative"),
  note: z.string().max(500).optional(),
  venue_id: z.string().uuid("Invalid venue ID").optional(),
});

// POST /api/inventory/stock/stocktake
export const POST = withUnifiedAuth(
  async (req: NextRequest, context) => {
    try {
      // STEP 1: Rate limiting (ALWAYS FIRST)
      const rateLimitResult = await rateLimit(req, RATE_LIMITS.GENERAL);
      if (!rateLimitResult.success) {
        return apiErrors.rateLimit(
          Math.ceil((rateLimitResult.reset - Date.now()) / 1000)
        );
      }

      // STEP 2: Validate input
      const body = await validateBody(stocktakeSchema, await req.json());
      const venueId = context.venueId || body.venue_id;

      if (!venueId) {
        return apiErrors.badRequest("venue_id is required");
      }

      // STEP 3: Business logic
      const adminSupabase = createAdminClient();

      // Get current stock level
      const { data: stockLevel, error: stockError } = await adminSupabase
        .from("v_stock_levels")
        .select("on_hand")
        .eq("ingredient_id", body.ingredient_id)
        .eq("venue_id", venueId)
        .single();

      if (stockError && stockError.code !== "PGRST116") {
        logger.error("[INVENTORY STOCKTAKE] Error fetching stock level:", {
          error: stockError.message,
          ingredientId: body.ingredient_id,
          venueId,
          userId: context.user.id,
        });
        return apiErrors.database(
          "Failed to fetch current stock level",
          isDevelopment() ? stockError.message : undefined
        );
      }

      const currentStock = stockLevel?.on_hand || 0;
      const delta = body.actual_count - currentStock;

      // Get ingredient to verify venue_id matches
      const { data: ingredient, error: ingredientError } = await adminSupabase
        .from("ingredients")
        .select("venue_id, name")
        .eq("id", body.ingredient_id)
        .single();

      if (ingredientError || !ingredient) {
        logger.error("[INVENTORY STOCKTAKE] Ingredient not found:", {
          error: ingredientError?.message,
          ingredientId: body.ingredient_id,
          venueId,
          userId: context.user.id,
        });
        return apiErrors.notFound("Ingredient not found");
      }

      if (ingredient.venue_id !== venueId) {
        return apiErrors.forbidden("Ingredient does not belong to this venue");
      }

      // Create stocktake ledger entry
      const { data: ledgerEntry, error: ledgerError } = await adminSupabase
        .from("stock_ledgers")
        .insert({
          ingredient_id: body.ingredient_id,
          venue_id: venueId,
          delta,
          reason: "stocktake",
          ref_type: "manual",
          note: body.note || `Stocktake: ${currentStock} → ${body.actual_count}`,
          created_by: context.user.id,
        })
        .select()
        .single();

      if (ledgerError || !ledgerEntry) {
        logger.error("[INVENTORY STOCKTAKE] Error creating stocktake:", {
          error: ledgerError?.message,
          ingredientId: body.ingredient_id,
          venueId,
          userId: context.user.id,
        });
        return apiErrors.database(
          "Failed to create stocktake entry",
          isDevelopment() ? ledgerError?.message : undefined
        );
      }

      logger.info("[INVENTORY STOCKTAKE] Stocktake completed successfully", {
        ingredientId: body.ingredient_id,
        ingredientName: ingredient.name,
        previousStock: currentStock,
        newStock: body.actual_count,
        delta,
        venueId,
        userId: context.user.id,
      });

      // STEP 4: Return success response
      return success({
        data: ledgerEntry,
        previous_stock: currentStock,
        new_stock: body.actual_count,
        delta,
      });
    } catch (error) {
      logger.error("[INVENTORY STOCKTAKE] Unexpected error:", {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        venueId: context.venueId,
        userId: context.user.id,
      });

      if (isZodError(error)) {
        return handleZodError(error);
      }

      return apiErrors.internal(
        "Request processing failed",
        isDevelopment() ? error : undefined
      );
    }
  },
  {
    // Extract venueId from body
    extractVenueId: async (req) => {
      try {
        const body = await req.json().catch(() => ({}));
        return (body as { venue_id?: string; venueId?: string })?.venue_id || 
               (body as { venue_id?: string; venueId?: string })?.venueId || 
               null;
      } catch {
        return null;
      }
    },
  }
);
