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

const collectPaymentSchema = z.object({
  payment_method: z.enum(["till", "card", "cash"]),
  venue_id: z.string(),
});

/**
 * POST /api/orders/[orderId]/collect-payment
 *
 * Mark payment as collected for "pay_at_till" orders
 * Staff uses this after processing payment via card reader/cash register
 */
export const POST = createUnifiedHandler(
  async (_req: NextRequest, context) => {
    // Get orderId from route params (handled by unified handler)
    const orderId = context.params?.orderId as string | undefined;

    if (!orderId) {
      return apiErrors.badRequest("Order ID is required");
    }

    const { body } = context;
    const { payment_method, venue_id } = body;

    // Validation already done by unified handler schema

    const admin = createAdminClient();

    // Fetch the order
    const { data: order, error: fetchError } = await admin
      .from("orders")
      .select(
        "id, venue_id, payment_status, payment_method, payment_mode, qr_type, fulfillment_type, source, requires_collection"
      )
      .eq("id", orderId)
      .eq("venue_id", venue_id)
      .single();

    if (fetchError || !order) {
      return apiErrors.notFound("Order not found");
    }

    // Idempotent: if already paid, return success
    if (String(order.payment_status || "").toUpperCase() === "PAID") {
      return success({
        ok: true,
        order,
        message: "Order already marked as paid",
      });
    }

    const { data: venueSettings } = await admin
      .from("venues")
      .select("allow_pay_at_till_for_table_collection")
      .eq("venue_id", venue_id)
      .maybeSingle();

    const allowPayAtTillForTableCollection =
      venueSettings?.allow_pay_at_till_for_table_collection === true;

    const normalizedPaymentMethod = normalizePaymentMethod(payment_method) || "PAY_AT_TILL";
    const qrType = deriveQrTypeFromOrder(order);
    const validation = validatePaymentMethodForQrType({
      qrType,
      paymentMethod: normalizedPaymentMethod,
      allowPayAtTillForTableCollection,
    });

    if (!validation.ok) {
      return apiErrors.badRequest(validation.error || "Invalid payment method for this order type");
    }

    if (!["PAY_AT_TILL", "PAY_LATER"].includes(normalizedPaymentMethod)) {
      return apiErrors.badRequest("This endpoint is only for Pay at Till or Pay Later orders");
    }

    // Update order to mark as paid
    const { data: updatedOrder, error: updateError } = await admin
      .from("orders")
      .update({
        payment_status: "PAID",
        payment_method: normalizedPaymentMethod,
        paid_at: new Date().toISOString(),
        paid_by_user_id: context.user.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", orderId)
      .eq("venue_id", venue_id)
      .select("*")
      .single();

    if (updateError) {
      return apiErrors.internal("Failed to mark payment as collected");
    }

    return success({
      ok: true,
      order: updatedOrder,
      message: "Payment collected successfully",
    });
  },
  {
    schema: collectPaymentSchema,
    requireVenueAccess: true,
    requireRole: ["owner", "manager", "staff", "server", "kitchen"],
    rateLimit: RATE_LIMITS.GENERAL,
    extractVenueId: async (req, routeContext) => {
      try {
        // Try to get from body first
        const body = await req.clone().json();
        if (body?.venue_id) return body.venue_id;

        // Try to get from orderId in route params
        const params = routeContext?.params ? await routeContext.params : {};
        const orderId = params?.orderId as string | undefined;
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
