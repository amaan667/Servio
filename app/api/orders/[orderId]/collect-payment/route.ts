import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { logger } from "@/lib/logger";
import { success, apiErrors, isZodError, handleZodError } from "@/lib/api/standard-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/orders/[orderId]/collect-payment
 *
 * Mark payment as collected for "pay_at_till" orders
 * Staff uses this after processing payment via card reader/cash register
 */
type CollectPaymentRouteContext = {
  params?: {
    orderId?: string;
  };
};

export async function POST(_request: NextRequest, context?: CollectPaymentRouteContext) {
  const orderId = context?.params?.orderId;

  if (!orderId) {
    return apiErrors.badRequest("Order ID is required");
  }

  try {
    const body = await _request.json();
    const { payment_method, venue_id } = body;

    logger.info("[COLLECT PAYMENT] Processing till payment", {
      data: { orderId, payment_method, venue_id },
    });

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
      logger.error("[COLLECT PAYMENT] Order not found", {
        data: { orderId, venue_id, error: fetchError },
      });
      return apiErrors.notFound('Order not found');
    }

    // Validate order state
    if (order.payment_status === "PAID") {
      logger.warn("[COLLECT PAYMENT] Order already paid", { data: { orderId } });
      return apiErrors.badRequest('Order has already been paid');
    }

    if (order.payment_mode !== "pay_at_till") {
      logger.warn("[COLLECT PAYMENT] Invalid payment mode for this endpoint", {
        data: { orderId, payment_mode: order.payment_mode },
      });
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
      logger.error("[COLLECT PAYMENT] Failed to update order", {
        data: { orderId, error: updateError },
      });
      return apiErrors.internal('Failed to mark payment as collected');
    }

    logger.info("[COLLECT PAYMENT] Payment collected successfully", {
      data: { orderId, payment_method, payment_status: updatedOrder.payment_status },
    });

    return NextResponse.json({
      ok: true,
      order: updatedOrder,
      message: "Payment collected successfully",
    });
  } catch (_error) {
    logger.error("[COLLECT PAYMENT] Unexpected error", {
      data: { orderId, error: _error instanceof Error ? _error.message : String(_error) },
    });
    return apiErrors.internal('Internal server error');
  }
}
