import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { withUnifiedAuth } from "@/lib/auth/unified-auth";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { isDevelopment } from "@/lib/env";
import { success, apiErrors, isZodError, handleZodError } from "@/lib/api/standard-response";
import { z } from "zod";
import { validateBody } from "@/lib/api/validation-schemas";

export const runtime = "nodejs";

const stocktakeSchema = z.object({

// POST /api/inventory/stock/stocktake
export const POST = withUnifiedAuth(
  async (req: NextRequest, context) => {
    try {
      // STEP 1: Rate limiting (ALWAYS FIRST)
      const rateLimitResult = await rateLimit(req, RATE_LIMITS.GENERAL);
      if (!rateLimitResult.success) {
        return apiErrors.rateLimit(Math.ceil((rateLimitResult.reset - Date.now()) / 1000));
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
        
        return apiErrors.notFound("Ingredient not found");
      }

      if (ingredient.venue_id !== venueId) {
        return apiErrors.forbidden("Ingredient does not belong to this venue");
      }

      // Create stocktake ledger entry
      const { data: ledgerEntry, error: ledgerError } = await adminSupabase
        .from("stock_ledgers")
        .insert({

          delta,

          note: body.note || `Stocktake: ${currentStock} → ${body.actual_count}`,

        .select()
        .single();

      if (ledgerError || !ledgerEntry) {
        
        return apiErrors.database(
          "Failed to create stocktake entry",
          isDevelopment() ? ledgerError?.message : undefined
        );
      }

      

      // STEP 4: Return success response
      return success({

        delta,

    } catch (error) {

      if (isZodError(error)) {
        return handleZodError(error);
      }

      return apiErrors.internal("Request processing failed", isDevelopment() ? error : undefined);
    }
  },
  {
    // Extract venueId from body

        const body = await req.json().catch(() => ({}));
        return (
          (body as { venue_id?: string; venueId?: string })?.venue_id ||
          (body as { venue_id?: string; venueId?: string })?.venueId ||
          null
        );
      } catch {
        return null;
      }
    },
  }
);
