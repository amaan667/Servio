import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { logger } from "@/lib/logger";
import { withUnifiedAuth } from "@/lib/auth/unified-auth";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { isDevelopment } from "@/lib/env";
import { success, apiErrors, isZodError, handleZodError } from "@/lib/api/standard-response";
import { z } from "zod";
import { validateBody } from "@/lib/api/validation-schemas";

const createIngredientSchema = z.object({
  venue_id: z.string().uuid().optional(),
  name: z.string().min(1).max(100),
  sku: z.string().max(50).optional(),
  unit: z.string().min(1).max(20),
  cost_per_unit: z.number().nonnegative().optional(),
  par_level: z.number().nonnegative().optional(),
  reorder_level: z.number().nonnegative().optional(),
  supplier: z.string().max(100).optional(),
  initial_stock: z.number().nonnegative().optional(),
});

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
        logger.error("[INVENTORY API] Error fetching ingredients:", {
          error: error.message,
          venueId,
          userId: context.user.id,
        });
        return apiErrors.database(
          "Failed to fetch ingredients",
          isDevelopment() ? error.message : undefined
        );
      }

      logger.info("[INVENTORY API] Ingredients fetched successfully", {
        venueId,
        count: data?.length || 0,
        userId: context.user.id,
      });

      // STEP 4: Return success response
      return success({ data: data || [] });
    } catch (error) {
      logger.error("[INVENTORY API] Unexpected error:", {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        venueId: context.venueId,
        userId: context.user.id,
      });

      if (isZodError(error)) {
        return handleZodError(error);
      }

      return apiErrors.internal("Request processing failed", isDevelopment() ? error : undefined);
    }
  },
  {
    // Extract venueId from query params
    extractVenueId: async (req) => {
      try {
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
          venue_id: venueId,
          name: body.name,
          sku: body.sku,
          unit: body.unit,
          cost_per_unit: body.cost_per_unit,
          par_level: body.par_level,
          reorder_level: body.reorder_level,
          supplier: body.supplier,
        })
        .select()
        .single();

      if (ingredientError || !ingredient) {
        logger.error("[INVENTORY API] Error creating ingredient:", {
          error: ingredientError?.message,
          venueId,
          userId: context.user.id,
        });
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
          ingredient_id: ingredient.id,
          venue_id: venueId,
          delta: body.initial_stock,
          reason: "receive",
          ref_type: "manual",
          note: "Initial stock",
        });

        if (movementError) {
          logger.error("[INVENTORY API] Error creating initial stock movement:", {
            error: movementError.message,
            ingredientId: ingredient.id,
            venueId,
            userId: context.user.id,
          });
          // Don't fail the request, just log the error
        }
      }

      logger.info("[INVENTORY API] Ingredient created successfully", {
        ingredientId: ingredient.id,
        venueId,
        userId: context.user.id,
      });

      // STEP 4: Return success response
      return success({ data: ingredient });
    } catch (error) {
      logger.error("[INVENTORY API] Unexpected error:", {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        venueId: context.venueId,
        userId: context.user.id,
      });

      if (isZodError(error)) {
        return handleZodError(error);
      }

      return apiErrors.internal("Request processing failed", isDevelopment() ? error : undefined);
    }
  },
  {
    // Extract venueId from body
    extractVenueId: async (req) => {
      try {
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
