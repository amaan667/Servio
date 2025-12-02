import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { logger } from "@/lib/logger";
import { cleanupTableOnOrderCompletion } from "@/lib/table-cleanup";
import { withUnifiedAuth } from '@/lib/auth/unified-auth';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { isDevelopment } from '@/lib/env';
import { success, apiErrors, isZodError, handleZodError } from '@/lib/api/standard-response';
import { z } from 'zod';
import { validateBody } from '@/lib/api/validation-schemas';

export const runtime = "nodejs";

const completeOrderSchema = z.object({
  orderId: z.string().uuid("Invalid order ID"),
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
      const body = await validateBody(completeOrderSchema, await req.json());
      const orderId = body.orderId;

      // STEP 3: Get venueId from context
      const venueId = context.venueId;

      if (!venueId) {
        return apiErrors.badRequest("venue_id is required");
      }

      // STEP 4: Business logic - Get order and verify it exists and belongs to venue
      const supabase = createAdminClient();

      const { data: orderData, error: orderError } = await supabase
        .from("orders")
        .select("id, venue_id, order_status, payment_status, table_id, table_number, source")
        .eq("id", orderId)
        .eq("venue_id", venueId)
        .single();

      if (orderError || !orderData) {
        logger.error("[ORDERS COMPLETE] Order not found:", {
          error: orderError?.message,
          orderId,
          venueId,
          userId: context.user.id,
        });
        return apiErrors.notFound("Order not found");
      }

      // Verify order is in a completable state
      const completableStatuses = ["SERVED", "READY", "SERVING"];
      if (!completableStatuses.includes(orderData.order_status)) {
        return apiErrors.badRequest(
          `Cannot complete order: current status is ${orderData.order_status}. Order must be SERVED, READY, or SERVING before completion.`
        );
      }

      // Verify payment status - must be in a paid state
      const paidStatuses = ["PAID", "TILL"];
      if (!paidStatuses.includes(orderData.payment_status?.toUpperCase() || "")) {
        return apiErrors.badRequest(
          `Cannot complete order: payment status is ${orderData.payment_status}. Order must be PAID or TILL before completion.`
        );
      }

      // Update order status to COMPLETED
      const { error: updateError } = await supabase
        .from("orders")
        .update({
          order_status: "COMPLETED",
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", orderId)
        .eq("venue_id", venueId);

      if (updateError) {
        logger.error("[ORDERS COMPLETE] Error updating order:", {
          error: updateError.message,
          orderId,
          venueId,
          userId: context.user.id,
        });
        return apiErrors.database(
          "Failed to complete order",
          isDevelopment() ? updateError.message : undefined
        );
      }

      logger.info("[ORDERS COMPLETE] Order updated to COMPLETED", {
        orderId,
        venueId,
        userId: context.user.id,
      });

      // STEP 5: Clear table session if order has table
      if (orderData.table_id || orderData.table_number) {
        logger.debug("[ORDERS COMPLETE] Clearing table session and runtime state for order", {
          orderId,
          tableId: orderData.table_id,
          tableNumber: orderData.table_number,
          paymentStatus: orderData.payment_status,
          source: orderData.source,
          venueId,
        });

        // Use centralized cleanup function
        const cleanupResult = await cleanupTableOnOrderCompletion({
          venueId,
          tableId: orderData.table_id || undefined,
          tableNumber: orderData.table_number?.toString() || undefined,
          orderId,
        });

        if (!cleanupResult.success) {
          logger.warn("[ORDERS COMPLETE] Table cleanup failed", {
            orderId,
            venueId,
            error: cleanupResult.error,
          });
        } else {
          logger.debug("[ORDERS COMPLETE] Table cleanup successful", {
            orderId,
            venueId,
            details: cleanupResult.details,
          });
        }
      }

      // STEP 6: Return success response
      return success({
        success: true,
        message: "Order marked as completed and table freed",
      });
    } catch (error) {
      logger.error("[ORDERS COMPLETE] Unexpected error:", {
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
    // Extract venueId from order lookup
    extractVenueId: async (req) => {
      try {
        const body = await req.json();
        const orderId = body?.orderId;
        if (orderId) {
          const { createAdminClient } = await import("@/lib/supabase");
          const admin = createAdminClient();
          const { data: order } = await admin
            .from("orders")
            .select("venue_id")
            .eq("id", orderId)
            .single();
          if (order?.venue_id) {
            return order.venue_id;
          }
        }
        return body?.venue_id || body?.venueId || null;
      } catch {
        return null;
      }
    },
  }
);
