import { NextRequest } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase';
import { withUnifiedAuth } from '@/lib/auth/unified-auth';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { isDevelopment } from '@/lib/env';
import { success, apiErrors, isZodError, handleZodError } from '@/lib/api/standard-response';
import { validateBody } from '@/lib/api/validation-schemas';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';

const reviewSchema = z.object({
  orderId: z.string().uuid("Invalid order ID"),
  rating: z.number().int().min(1).max(5, "Rating must be between 1 and 5"),
  comment: z.string().max(500, "Comment too long").optional(),
});

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
      const body = await validateBody(reviewSchema, await req.json());

      // STEP 3: Business logic
      const admin = await createClient();
      
      // Verify order exists
      const { data: order, error: orderError } = await admin
        .from('orders')
        .select('id, venue_id')
        .eq('id', body.orderId)
        .maybeSingle();

      if (orderError || !order) {
        logger.warn("[REVIEWS ADD] Order not found", {
          orderId: body.orderId,
          userId: context.user.id,
        });
        return apiErrors.notFound("Order not found");
      }

      // Insert review
      const { error: insErr } = await admin.from('reviews').insert({
        order_id: body.orderId,
        venue_id: order.venue_id,
        rating: body.rating,
        comment: (body.comment ?? '').slice(0, 500),
      });

      if (insErr) {
        logger.error("[REVIEWS ADD] Error inserting review:", {
          error: insErr.message,
          orderId: body.orderId,
          userId: context.user.id,
        });
        return apiErrors.database(
          "Failed to save review",
          isDevelopment() ? insErr.message : undefined
        );
      }

      logger.info("[REVIEWS ADD] Review added successfully", {
        orderId: body.orderId,
        rating: body.rating,
        userId: context.user.id,
      });

      // STEP 4: Return success response
      return success({ success: true });
    } catch (error) {
      logger.error("[REVIEWS ADD] Unexpected error:", {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
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
    // System route - no venue required (reviews can be for any order)
    extractVenueId: async () => null,
  }
);
