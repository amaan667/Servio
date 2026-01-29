import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";

import { apiErrors } from "@/lib/api/standard-response";
import {
  deriveQrTypeFromOrder,
  normalizePaymentStatus,
  validateOrderStatusTransition,
} from "@/lib/orders/qr-payment-validation";

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { order_id, order_status, payment_status } = body;

    if (!order_id || !order_status) {
      return NextResponse.json(
        { error: "order_id and order_status are required" },
        { status: 400 }
      );
    }

    // Use admin client - no auth needed
    const supabase = createAdminClient();

    // Get the order
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select(
        "venue_id, payment_status, order_status, qr_type, fulfillment_type, source, requires_collection"
      )
      .eq("id", order_id)
      .single();

    if (orderError || !order) {
      return apiErrors.notFound("Order not found");
    }

    const qrType = deriveQrTypeFromOrder(order);
    const normalizedPaymentStatus = normalizePaymentStatus(order.payment_status) || "UNPAID";
    const transitionValidation = validateOrderStatusTransition({
      qrType,
      paymentStatus: normalizedPaymentStatus,
      currentStatus: order.order_status || "",
      nextStatus: order_status,
    });

    if (!transitionValidation.ok) {
      return NextResponse.json(
        {
          success: false,
          error: transitionValidation.error || "Order status transition not allowed",
        },
        { status: 400 }
      );
    }

    // Update order status
    const updateData: Record<string, string> = { order_status };
    if (payment_status) {
      updateData.payment_status = payment_status;
    }

    const { data: updatedOrder, error: updateError } = await supabase
      .from("orders")
      .update(updateData)
      .eq("id", order_id)
      .select()
      .single();

    if (updateError) {
      return apiErrors.internal("Internal server error");
    }

    return NextResponse.json({ order: updatedOrder });
  } catch (_error) {
    return apiErrors.internal("Internal server error");
  }
}
