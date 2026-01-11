import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";

import { apiErrors } from "@/lib/api/standard-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/orders/[orderId]/collect-payment
 *
 * Mark payment as collected for "pay_at_till" orders
 * Staff uses this after processing payment via card reader/cash register
 */
type OrderParams = { params?: { orderId?: string } };

export async function POST(_request: NextRequest, context: OrderParams = {}) {
  const orderId = context.params?.orderId;

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
      .select("*")
      .eq("id", orderId)
      .eq("venue_id", venue_id)
      .single();

    if (fetchError || !order) {

      return apiErrors.notFound("Order not found");
    }

    // Validate order state
    if (order.payment_status === "PAID") {

      return apiErrors.badRequest("Order has already been paid");
    }

    if (order.payment_mode !== "pay_at_till") {

      return NextResponse.json(
        { error: "This endpoint is only for 'pay_at_till' orders" },
        { status: 400 }
      );
    }

    // Update order to mark as paid
    const { data: updatedOrder, error: updateError } = await admin
      .from("orders")
      .update({
        payment_status: "PAID",
        payment_method: payment_method,
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
}
