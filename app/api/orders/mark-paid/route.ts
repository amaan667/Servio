import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase";

import { apiErrors, success } from "@/lib/api/standard-response";
import { createUnifiedHandler } from "@/lib/api/unified-handler";
import {
  deriveQrTypeFromOrder,
  normalizePaymentMethod,
  validatePaymentMethodForQrType,
} from "@/lib/orders/qr-payment-validation";
import { z } from "zod";
import { RATE_LIMITS } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const markPaidSchema = z.object({
  orderId: z.string().min(1, "Order ID is required"),
  venue_id: z.string().optional(),
});

/**
 * POST /api/orders/mark-paid
 *
 * Mark a Pay at Till or Pay Later order as paid (staff-only).
 * Used by the Payments page "Mark as Paid" button.
 */
export const POST = createUnifiedHandler(
  async (_req: NextRequest, context) => {
    const { body } = context;
    const { orderId } = body;

    const admin = createAdminClient();

    const { data: order, error: fetchError } = await admin
      .from("orders")
      .select(
        "id, venue_id, payment_status, payment_method, payment_mode, qr_type, fulfillment_type, source, requires_collection"
      )
      .eq("id", orderId)
      .single();

    if (fetchError || !order) {
      return apiErrors.notFound("Order not found");
    }

    const venueId = body.venue_id || (order.venue_id as string);
    if (context.venueId && venueId !== context.venueId) {
      return apiErrors.forbidden("Order does not belong to this venue");
    }

    if (String(order.payment_status || "").toUpperCase() === "PAID") {
      return success({
        success: true,
        order,
        message: "Order already marked as paid",
      });
    }

    const { data: venueSettings } = await admin
      .from("venues")
      .select("allow_pay_at_till_for_table_collection")
      .eq("venue_id", venueId)
      .maybeSingle();

    const allowPayAtTillForTableCollection =
      venueSettings?.allow_pay_at_till_for_table_collection === true;

    const normalizedMethod = normalizePaymentMethod(order.payment_method) || "PAY_AT_TILL";
    const qrType = deriveQrTypeFromOrder(order);
    const validation = validatePaymentMethodForQrType({
      qrType,
      paymentMethod: normalizedMethod,
      allowPayAtTillForTableCollection,
    });

    if (!validation.ok) {
      return apiErrors.badRequest(validation.error || "Invalid payment method for this order");
    }

    if (!["PAY_AT_TILL", "PAY_LATER"].includes(normalizedMethod)) {
      return apiErrors.badRequest(
        "Only Pay at Till and Pay Later orders can be marked as paid here. Pay Now orders are paid via Stripe."
      );
    }

    const { data: updatedOrder, error: updateError } = await admin
      .from("orders")
      .update({
        payment_status: "PAID",
        paid_at: new Date().toISOString(),
        paid_by_user_id: context.user?.id ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", orderId)
      .eq("venue_id", venueId)
      .select("*")
      .single();

    if (updateError) {
      return apiErrors.internal(
        `Failed to mark order as paid: ${updateError.message || "Unknown error"}`
      );
    }

    return success({
      success: true,
      order: updatedOrder,
      message: "Order marked as paid",
    });
  },
  {
    schema: markPaidSchema,
    requireVenueAccess: true,
    requireRole: ["owner", "manager", "staff", "server", "kitchen"],
    rateLimit: RATE_LIMITS.GENERAL,
    enforceIdempotency: true, // Critical for payment operations to prevent double-charging
    extractVenueId: async (req) => {
      try {
        const body = await req
          .clone()
          .json()
          .catch(() => ({}));
        if (body?.venue_id) return body.venue_id;
        const orderId = body?.orderId;
        if (orderId) {
          const admin = createAdminClient();
          const { data: order } = await admin
            .from("orders")
            .select("venue_id")
            .eq("id", orderId)
            .single();
          return (order?.venue_id as string | undefined) ?? null;
        }
        return null;
      } catch {
        return null;
      }
    },
  }
);
