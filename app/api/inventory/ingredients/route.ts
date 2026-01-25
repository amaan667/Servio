import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase";

import { withUnifiedAuth } from "@/lib/auth/unified-auth";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { isDevelopment } from "@/lib/env";
import { success, apiErrors, isZodError, handleZodError } from "@/lib/api/standard-response";
import { z } from "zod";
import { validateBody } from "@/lib/api/validation-schemas";
import { getRequestMetadata, getIdempotencyKey } from "@/lib/api/request-helpers";
import { checkIdempotency, storeIdempotency } from "@/lib/db/idempotency";

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
    const requestMetadata = getRequestMetadata(req);
    const requestId = requestMetadata.correlationId;
    
    try {
      // STEP 1: Rate limiting (ALWAYS FIRST)
      const rateLimitResult = await rateLimit(req, RATE_LIMITS.GENERAL);
      if (!rateLimitResult.success) {
        return apiErrors.rateLimit(Math.ceil((rateLimitResult.reset - Date.now()) / 1000), requestId);
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
      return success(data || [], { timestamp: new Date().toISOString(), requestId }, requestId);
    } catch (error) {

      if (isZodError(error)) {
        return handleZodError(error);
      }

      return apiErrors.internal(
        "Request processing failed",
        isDevelopment() ? error : undefined,
        requestId
      );
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
    const requestMetadata = getRequestMetadata(req);
    const requestId = requestMetadata.correlationId;
    
    try {
      // STEP 1: Rate limiting (ALWAYS FIRST)
      const rateLimitResult = await rateLimit(req, RATE_LIMITS.GENERAL);
      if (!rateLimitResult.success) {
        return apiErrors.rateLimit(Math.ceil((rateLimitResult.reset - Date.now()) / 1000), requestId);
      }

      // STEP 2: Validate input
      const body = await validateBody(createIngredientSchema, await req.json());

      // Optional idempotency check (non-breaking - only if header is provided)
      const idempotencyKey = getIdempotencyKey(req);
      if (idempotencyKey) {
        const existing = await checkIdempotency(idempotencyKey);
        if (existing.exists) {
          return success(
            existing.response.response_data as unknown,
            { timestamp: new Date().toISOString(), requestId },
            requestId
          );
        }
      }
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

          // Don't fail the request, just log the error
        }
      }

      // STEP 4: Return success response
      const response = ingredient;

      // Store idempotency key if provided (non-breaking - only if header was sent)
      if (idempotencyKey) {
        const requestHash = JSON.stringify(body);
        await storeIdempotency(
          idempotencyKey,
          requestHash,
          response,
          200,
          3600 // 1 hour TTL
        ).catch(() => {
          // Don't fail request if idempotency storage fails
        });
      }

      return success(response, { timestamp: new Date().toISOString(), requestId }, requestId);
    } catch (error) {

      if (isZodError(error)) {
        return handleZodError(error);
      }

      return apiErrors.internal(
        "Request processing failed",
        isDevelopment() ? error : undefined,
        requestId
      );
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
