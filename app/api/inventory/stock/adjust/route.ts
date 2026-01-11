import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase";
import { withUnifiedAuth } from "@/lib/auth/unified-auth";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { isDevelopment } from "@/lib/env";
import { success, apiErrors, isZodError, handleZodError } from "@/lib/api/standard-response";
import { z } from "zod";
import { validateBody } from "@/lib/api/validation-schemas";

export const runtime = "nodejs";

const stockAdjustmentSchema = z.object({

  delta: z.number().refine((val) => val !== 0, "Delta must not be zero"),
  reason: z.enum(["sale", "receive", "adjust", "waste", "stocktake", "return"]),

/**
 * Adjust inventory stock for an ingredient
 * SECURITY: Uses withUnifiedAuth to enforce venue access and RLS.
 * The authenticated client ensures users can only adjust stock for ingredients in venues they have access to.
 */
export const POST = withUnifiedAuth(
  async (req: NextRequest, context) => {
    try {
      // STEP 1: Rate limiting (ALWAYS FIRST)
      const rateLimitResult = await rateLimit(req, RATE_LIMITS.GENERAL);
      if (!rateLimitResult.success) {
        return apiErrors.rateLimit(Math.ceil((rateLimitResult.reset - Date.now()) / 1000));
      }

      // STEP 2: Validate input
      const body = await validateBody(stockAdjustmentSchema, await req.json());

      // STEP 3: Get venueId from ingredient and verify access
      // Use authenticated client that respects RLS (not admin client)
      // RLS policies ensure users can only access ingredients for venues they have access to
      const supabase = await createClient();

      const { data: ingredient, error: ingredientError } = await supabase
        .from("ingredients")
        .select("venue_id, name")
        .eq("id", body.ingredient_id)
        .eq("venue_id", context.venueId) // Explicit venue check (RLS also enforces this)
        .single();

      if (ingredientError || !ingredient) {
        
        return apiErrors.notFound("Ingredient not found");
      }

      const venueId = ingredient.venue_id;

      // Verify venue matches context (double-check for security)
      if (venueId !== context.venueId) {
        
        return apiErrors.forbidden("Ingredient does not belong to your venue");
      }

      // STEP 4: Business logic - Create stock ledger entry
      // RLS ensures user can only create ledger entries for venues they have access to
      const { data: ledgerEntry, error: ledgerError } = await supabase
        .from("stock_ledgers")
        .insert({

          note: body.note || `Manual adjustment: ${body.delta > 0 ? "+" : ""}${body.delta}`,

        .select()
        .single();

      if (ledgerError || !ledgerEntry) {
        
        return apiErrors.database(
          "Failed to create stock ledger entry",
          isDevelopment() ? ledgerError?.message : undefined
        );
      }

      

      // STEP 5: Return success response
      return success({

        message: `Stock adjusted by ${body.delta > 0 ? "+" : ""}${body.delta}`,

    } catch (error) {

      if (isZodError(error)) {
        return handleZodError(error);
      }

      return apiErrors.internal("Request processing failed", isDevelopment() ? error : undefined);
    }
  },
  {

        const body = await req.json().catch(() => ({}));
        const ingredientId = (body as { ingredient_id?: string })?.ingredient_id;
        if (ingredientId) {
          // SECURITY: Using admin client here only to extract venue_id for routing
          // The main handler will use authenticated client and verify venue access
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
