import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { apiErrors } from "@/lib/api/standard-response";

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
      
      return apiErrors.notFound("Order not found");
    }

    // Validate order state - can only change payment mode if unpaid
    if (order.payment_status === "PAID") {
      
      return NextResponse.json(
        { error: "Cannot change payment mode for already paid orders" },
        { status: 400 }
      );
    }

    // Validate order is not completed
    if (order.order_status === "COMPLETED") {
      
      return NextResponse.json(
        { error: "Cannot change payment mode for completed orders" },
        { status: 400 }
      );
    }

    // Update payment mode
    const { data: updatedOrder, error: updateError } = await admin
      .from("orders")
      .update({

      .eq("id", orderId)
      .eq("venue_id", venue_id)
      .select("*")
      .single();

    if (updateError) {
      
      return apiErrors.internal("Failed to update payment mode");
    }

    

    return NextResponse.json({

  } catch (_error) {
     },

    return apiErrors.internal("Internal server error");
  }
}
