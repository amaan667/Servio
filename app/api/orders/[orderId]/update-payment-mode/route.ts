import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { logger } from "@/lib/logger";
import { success, apiErrors, isZodError, handleZodError } from "@/lib/api/standard-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * PATCH /api/orders/[orderId]/update-payment-mode
 *
 * Allow customer to switch payment method (e.g., pay_later → pay_at_till)
 * Used when customer changes their mind about how to pay
 */
type OrderParams = { params?: { orderId?: string } };

export async function PATCH(_request: NextRequest, context: OrderParams = {}) {
  const orderId = context.params?.orderId;

  if (!orderId) {
    return apiErrors.badRequest("Order ID is required");
  }

  try {
    const body = await _request.json();
    const { new_payment_mode, venue_id } = body;

    logger.info("[UPDATE PAYMENT MODE] Customer changing payment method", {
      data: { orderId, new_payment_mode, venue_id },
    });

    // Validate new payment mode
    if (!new_payment_mode || !["pay_at_till", "pay_later", "online"].includes(new_payment_mode)) {
      return NextResponse.json(
        { error: "Invalid payment mode. Must be 'pay_at_till', 'pay_later', or 'online'" },
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
      logger.error("[UPDATE PAYMENT MODE] Order not found", {
        data: { orderId, venue_id, error: fetchError },
      });
      return apiErrors.notFound("Order not found");
    }

    // Validate order state - can only change payment mode if unpaid
    if (order.payment_status === "PAID") {
      logger.warn("[UPDATE PAYMENT MODE] Order already paid", { data: { orderId } });
      return NextResponse.json(
        { error: "Cannot change payment mode for already paid orders" },
        { status: 400 }
      );
    }

    // Validate order is not completed
    if (order.order_status === "COMPLETED") {
      logger.warn("[UPDATE PAYMENT MODE] Order already completed", { data: { orderId } });
      return NextResponse.json(
        { error: "Cannot change payment mode for completed orders" },
        { status: 400 }
      );
    }

    // Update payment mode
    const { data: updatedOrder, error: updateError } = await admin
      .from("orders")
      .update({
        payment_mode: new_payment_mode,
        updated_at: new Date().toISOString(),
      })
      .eq("id", orderId)
      .eq("venue_id", venue_id)
      .select("*")
      .single();

    if (updateError) {
      logger.error("[UPDATE PAYMENT MODE] Failed to update order", {
        data: { orderId, error: updateError },
      });
      return apiErrors.internal("Failed to update payment mode");
    }

    logger.info("[UPDATE PAYMENT MODE] Payment mode updated successfully", {
      data: {
        orderId,
        old_mode: order.payment_mode,
        new_mode: new_payment_mode,
      },
    });

    return NextResponse.json({
      ok: true,
      order: updatedOrder,
      message: "Payment mode updated successfully",
      changed_from: order.payment_mode,
      changed_to: new_payment_mode,
    });
  } catch (_error) {
    logger.error("[UPDATE PAYMENT MODE] Unexpected error", {
      data: { orderId, error: _error instanceof Error ? _error.message : String(_error) },
    });
    return apiErrors.internal("Internal server error");
  }
}
