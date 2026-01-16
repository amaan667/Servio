import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase";

import { cleanupTableOnOrderCompletion } from "@/lib/table-cleanup";
import { withUnifiedAuth } from "@/lib/auth/unified-auth";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { isDevelopment } from "@/lib/env";
import { success, apiErrors, isZodError, handleZodError } from "@/lib/api/standard-response";
import { z } from "zod";
import { validateBody } from "@/lib/api/validation-schemas";
import {
  deriveQrTypeFromOrder,
  normalizePaymentStatus,
  validateOrderStatusTransition,
} from "@/lib/orders/qr-payment-validation";

export const runtime = "nodejs";

const completeOrderSchema = z.object({
  orderId: z.string().uuid("Invalid order ID"),
  forced: z.boolean().optional(),
  forcedReason: z.string().min(1).max(500).optional(),
});

export const POST = withUnifiedAuth(
  async (req: NextRequest, context) => {
    try {
      // STEP 1: Rate limiting (ALWAYS FIRST)
      const rateLimitResult = await rateLimit(req, RATE_LIMITS.GENERAL);
      if (!rateLimitResult.success) {
        return apiErrors.rateLimit(Math.ceil((rateLimitResult.reset - Date.now()) / 1000));
      }

      // STEP 2: Validate input
      const body = await validateBody(completeOrderSchema, await req.json());
      const orderId = body.orderId;
      const forced = body.forced === true;
      const forcedReason = body.forcedReason;

      // STEP 3: Get venueId from context
      const venueId = context.venueId;

      if (!venueId) {
        return apiErrors.badRequest("venue_id is required");
      }

      // STEP 4: Business logic - Get order and verify it exists and belongs to venue
      const supabase = createAdminClient();

      const { data: orderData, error: orderError } = await supabase
        .from("orders")
        .select(
          "id, venue_id, order_status, payment_status, payment_method, kitchen_status, service_status, completion_status, table_id, table_number, source, qr_type, fulfillment_type, requires_collection"
        )
        .eq("id", orderId)
        .eq("venue_id", venueId)
        .single();
      const qrType = deriveQrTypeFromOrder(orderData || {});
      const normalizedPaymentStatus = normalizePaymentStatus(orderData?.payment_status) || "UNPAID";
      const transitionValidation = validateOrderStatusTransition({
        qrType,
        paymentStatus: normalizedPaymentStatus,
        currentStatus: orderData?.order_status || "",
        nextStatus: "COMPLETED",
      });

      if (!transitionValidation.ok) {
        return apiErrors.badRequest(
          transitionValidation.error || "Order status transition not allowed"
        );
      }

      if (orderError || !orderData) {

        return apiErrors.notFound("Order not found");
      }

      // Forced completion requires elevated role and auditable reason
      if (forced && !["owner", "manager"].includes(context.role)) {
        return apiErrors.forbidden("Forced completion requires owner or manager role");
      }
      if (forced && (!forcedReason || forcedReason.trim().length === 0)) {
        return apiErrors.badRequest("forcedReason is required when forced=true");
      }

      // Canonical completion transition (atomic eligibility check in RPC)
      const { data: completedRows, error: completeError } = await supabase.rpc("orders_complete", {
        p_order_id: orderId,
        p_venue_id: venueId,
        p_forced: forced,
        p_forced_by: forced ? context.user.id : null,
        p_forced_reason: forced ? forcedReason : null,
      });

      if (completeError) {
        return apiErrors.badRequest(
          isDevelopment() ? completeError.message : "Order not eligible for completion"
        );
      }

      await supabase
        .from("orders")
        .update({
          fulfillment_status: "COMPLETED",
          updated_at: new Date().toISOString(),
        })
        .eq("id", orderId)
        .eq("venue_id", venueId);

      // STEP 5: Clear table session if order has table
      if (orderData.table_id || orderData.table_number) {

        // Use centralized cleanup function
        const cleanupResult = await cleanupTableOnOrderCompletion({
          venueId,
          tableId: orderData.table_id || undefined,
          tableNumber: orderData.table_number?.toString() || undefined,
          orderId,
        });

        if (!cleanupResult.success) { /* Condition handled */ } else { /* Else case handled */ }
      }

      // STEP 6: Return success response
      return success({
        success: true,
        message: forced
          ? "Order force-completed and table freed"
          : "Order marked as completed and table freed",
        order: Array.isArray(completedRows) ? completedRows[0] : completedRows,
      });
    } catch (error) {

      if (isZodError(error)) {
        return handleZodError(error);
      }

      return apiErrors.internal("Request processing failed", isDevelopment() ? error : undefined);
    }
  },
  {
    // Extract venueId from order lookup
    extractVenueId: async (req) => {
      try {
        // Clone the request so we don't consume the original body
        const clonedReq = req.clone();
        const body = await clonedReq.json();
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
