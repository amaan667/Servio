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

const stockAdjustmentSchema = z.object({
  ingredient_id: z.string().uuid("Invalid ingredient ID"),
  delta: z.number().refine((val) => val !== 0, "Delta must not be zero"),
  reason: z.enum(["sale", "receive", "adjust", "waste", "stocktake", "return"]),
  note: z.string().max(500).optional(),
});

// POST /api/inventory/stock/adjust
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
      const body = await validateBody(stockAdjustmentSchema, await req.json());

      // STEP 3: Get venueId from ingredient
      const adminSupabase = createAdminClient();
      const { data: ingredient, error: ingredientError } = await adminSupabase
        .from("ingredients")
        .select("venue_id, name")
        .eq("id", body.ingredient_id)
        .single();

      if (ingredientError || !ingredient) {
        logger.error("[INVENTORY STOCK ADJUST] Ingredient not found:", {
          error: ingredientError?.message,
          ingredientId: body.ingredient_id,
          userId: context.user.id,
        });
        return apiErrors.notFound("Ingredient not found");
      }

      const venueId = ingredient.venue_id;

      // STEP 4: Business logic - Create stock ledger entry
      const { data: ledgerEntry, error: ledgerError } = await adminSupabase
        .from("stock_ledgers")
        .insert({
          ingredient_id: body.ingredient_id,
          venue_id: venueId,
          delta: body.delta,
          reason: body.reason,
          ref_type: "manual",
          note: body.note || `Manual adjustment: ${body.delta > 0 ? '+' : ''}${body.delta}`,
          created_by: context.user.id,
        })
        .select()
        .single();

      if (ledgerError || !ledgerEntry) {
        logger.error("[INVENTORY STOCK ADJUST] Error creating ledger entry:", {
          error: ledgerError?.message,
          ingredientId: body.ingredient_id,
          venueId,
          userId: context.user.id,
        });
        return apiErrors.database(
          "Failed to create stock ledger entry",
          isDevelopment() ? ledgerError?.message : undefined
        );
      }

      logger.info("[INVENTORY STOCK ADJUST] Stock adjusted successfully", {
        ingredientId: body.ingredient_id,
        ingredientName: ingredient.name,
        delta: body.delta,
        reason: body.reason,
        venueId,
        userId: context.user.id,
      });

      // STEP 5: Return success response
      return success({
        data: ledgerEntry,
        message: `Stock adjusted by ${body.delta > 0 ? '+' : ''}${body.delta}`,
      });
    } catch (error) {
      logger.error("[INVENTORY STOCK ADJUST] Unexpected error:", {
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
    extractVenueId: async (req) => {
      // Get venueId from ingredient in body
      try {
        const body = await req.json().catch(() => ({}));
        const ingredientId = (body as { ingredient_id?: string })?.ingredient_id;
        if (ingredientId) {
          const { createAdminClient } = await import("@/lib/supabase");
          const supabase = createAdminClient();
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
      try {
        const url = new URL(req.url);
        return url.searchParams.get("venueId") || url.searchParams.get("venue_id");
      } catch {
        return null;
      }
    },
  }
);
