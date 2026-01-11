import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { withUnifiedAuth } from "@/lib/auth/unified-auth";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { isDevelopment } from "@/lib/env";
import { success, apiErrors, isZodError, handleZodError } from "@/lib/api/standard-response";
import { z } from "zod";
import { validateBody } from "@/lib/api/validation-schemas";

const createIngredientSchema = z.object({

// GET /api/inventory/ingredients?venue_id=xxx
export const GET = withUnifiedAuth(
  async (req: NextRequest, context) => {
    try {
      // STEP 1: Rate limiting (ALWAYS FIRST)
      const rateLimitResult = await rateLimit(req, RATE_LIMITS.GENERAL);
      if (!rateLimitResult.success) {
        return apiErrors.rateLimit(Math.ceil((rateLimitResult.reset - Date.now()) / 1000));
      }

      // STEP 2: Get venueId from context (already verified)
      const venueId = context.venueId;

      if (!venueId) {
        return apiErrors.badRequest("venue_id is required");
      }

      // STEP 3: Business logic - Fetch ingredients
      const supabase = createAdminClient();

      const { data, error } = await supabase
        .from("v_stock_levels")
        .select("*")
        .eq("venue_id", venueId)
        .order("name", { ascending: true });

      if (error) {
        
        return apiErrors.database(
          "Failed to fetch ingredients",
          isDevelopment() ? error.message : undefined
        );
      }

      

      // STEP 4: Return success response
      return success(data || []);
    } catch (error) {

      if (isZodError(error)) {
        return handleZodError(error);
      }

      return apiErrors.internal("Request processing failed", isDevelopment() ? error : undefined);
    }
  },
  {
    // Extract venueId from query params

        const { searchParams } = new URL(req.url);
        return searchParams.get("venue_id") || searchParams.get("venueId");
      } catch {
        return null;
      }
    },
  }
);

// POST /api/inventory/ingredients
export const POST = withUnifiedAuth(
  async (req: NextRequest, context) => {
    try {
      // STEP 1: Rate limiting (ALWAYS FIRST)
      const rateLimitResult = await rateLimit(req, RATE_LIMITS.GENERAL);
      if (!rateLimitResult.success) {
        return apiErrors.rateLimit(Math.ceil((rateLimitResult.reset - Date.now()) / 1000));
      }

      // STEP 2: Validate input
      const body = await validateBody(createIngredientSchema, await req.json());
      const venueId = context.venueId || body.venue_id;

      if (!venueId) {
        return apiErrors.badRequest("venue_id is required");
      }

      // STEP 3: Business logic
      const adminSupabase = createAdminClient();

      // Create ingredient
      const { data: ingredient, error: ingredientError } = await adminSupabase
        .from("ingredients")
        .insert({

        .select()
        .single();

      if (ingredientError || !ingredient) {
        
        return apiErrors.database(
          "Failed to create ingredient",
          isDevelopment() ? ingredientError?.message : undefined
        );
      }

      // If initial_stock is provided, create a stock movement
      if (
        body.initial_stock !== undefined &&
        body.initial_stock !== null &&
        body.initial_stock > 0
      ) {
        const { error: movementError } = await adminSupabase.from("stock_ledgers").insert({

        if (movementError) {
          
          // Don't fail the request, just log the error
        }
      }

      

      // STEP 4: Return success response
      return success(ingredient);
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
