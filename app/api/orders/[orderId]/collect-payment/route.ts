import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";

import { apiErrors } from "@/lib/api/standard-response";
import { withUnifiedAuth } from "@/lib/auth/unified-auth";
import {
  deriveQrTypeFromOrder,
  normalizePaymentMethod,
  validatePaymentMethodForQrType,
} from "@/lib/orders/qr-payment-validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/orders/[orderId]/collect-payment
 *
 * Mark payment as collected for "pay_at_till" orders
 * Staff uses this after processing payment via card reader/cash register
 */
export const POST = withUnifiedAuth(
  async (_request: NextRequest, contextWithAuth, routeParams) => {
  const params = routeParams?.params ? await routeParams.params : undefined;
  const orderId = params?.orderId;

  if (!orderId) {
    return apiErrors.badRequest("Order ID is required");
  }

  try {
    const body = await _request.json();
    const { payment_method, venue_id } = body;

    // Validate payment method
    if (!payment_method || !["till", "card", "cash"].includes(payment_method)) {
      return NextResponse.json(
        { error: "Invalid payment method. Must be 'till', 'card', or 'cash'" },
        { status: 400 }
      );
    }

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
      return NextResponse.json({
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
      return NextResponse.json(
        {
          success: false,
          error: validation.error,
        },
        { status: 400 }
      );
    }

    if (!["PAY_AT_TILL", "PAY_LATER"].includes(normalizedPaymentMethod)) {
      return NextResponse.json(
        { error: "This endpoint is only for Pay at Till or Pay Later orders" },
        { status: 400 }
      );
    }

    // Update order to mark as paid
    const { data: updatedOrder, error: updateError } = await admin
      .from("orders")
      .update({
        payment_status: "PAID",
        payment_method: normalizedPaymentMethod,
        paid_at: new Date().toISOString(),
        paid_by_user_id: contextWithAuth.user.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", orderId)
      .eq("venue_id", venue_id)
      .select("*")
      .single();

    if (updateError) {

      return apiErrors.internal("Failed to mark payment as collected");
    }

    return NextResponse.json({
      ok: true,
      order: updatedOrder,
      message: "Payment collected successfully",
    });
  } catch (_error) {

    return apiErrors.internal("Internal server error");
  }
  },
  {
    extractVenueId: async (req) => {
      try {
        const body = await req.clone().json();
        const orderId = body?.orderId;
        if (!orderId) return null;
        const admin = createAdminClient();
        const { data: order } = await admin
          .from("orders")
          .select("venue_id")
          .eq("id", orderId)
          .single();
        return (order?.venue_id as string | undefined) ?? null;
      } catch {
        return null;
      }
    },
    requireRole: ["owner", "manager", "staff", "server", "kitchen"],
  }
);
