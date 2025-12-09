import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase";
import { logger } from "@/lib/logger";
import { withUnifiedAuth } from '@/lib/auth/unified-auth';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { isDevelopment } from '@/lib/env';
import { success, apiErrors, isZodError, handleZodError } from '@/lib/api/standard-response';
import { z } from 'zod';
import { validateBody } from '@/lib/api/validation-schemas';

export const runtime = "nodejs";

const stockDeductionSchema = z.object({
  order_id: z.string().uuid("Invalid order ID"),
  venue_id: z.string().uuid("Invalid venue ID").optional(),
});

/**
 * Deduct stock for an order using SQL function
 * SECURITY: Uses withUnifiedAuth to enforce venue access and RLS.
 * The authenticated client ensures users can only deduct stock for orders in venues they have access to.
 * RPC calls respect RLS policies defined in the database function.
 */
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
      const body = await validateBody(stockDeductionSchema, await req.json());
      const venueId = context.venueId || body.venue_id;

      if (!venueId) {
        return apiErrors.badRequest("venue_id is required");
      }

      // Verify venue matches context (double-check for security)
      if (body.venue_id && body.venue_id !== context.venueId) {
        logger.error("[INVENTORY STOCK DEDUCT] Venue mismatch:", {
          bodyVenueId: body.venue_id,
          contextVenueId: context.venueId,
          orderId: body.order_id,
          userId: context.user.id,
        });
        return apiErrors.forbidden("Order does not belong to your venue");
      }

      // STEP 3: Business logic - Deduct stock via SQL function
      // Use authenticated client that respects RLS (not admin client)
      // RPC functions should respect RLS policies defined in the database
      const supabase = await createClient();

      const { data, error } = await supabase.rpc("deduct_stock_for_order", {
        p_order_id: body.order_id,
        p_venue_id: venueId,
      });

      if (error) {
        logger.error("[INVENTORY STOCK DEDUCT] Error deducting stock:", {
          error: error.message,
          orderId: body.order_id,
          venueId,
          userId: context.user.id,
        });
        return apiErrors.database(
          "Failed to deduct stock for order",
          isDevelopment() ? error.message : undefined
        );
      }

      logger.info("[INVENTORY STOCK DEDUCT] Stock deducted successfully", {
        orderId: body.order_id,
        venueId,
        userId: context.user.id,
      });

      // STEP 4: Return success response
      return success({ data: data || null });
    } catch (error) {
      logger.error("[INVENTORY STOCK DEDUCT] Unexpected error:", {
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
