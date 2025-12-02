import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { logger } from "@/lib/logger";

/**
 * Payment API Route - No authentication required for ordering UI
 * This allows customers and staff to process payments without auth checks
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { orderId, venue_id, payment_method, payment_status } = body;

    if (!orderId || !venue_id) {
      return NextResponse.json(
        { error: "Order ID and venue ID are required" },
        { status: 400 }
      );
    }

    // Use admin client - no auth required for payment processing
    const supabase = createAdminClient();

    // Verify order exists and belongs to venue
    const { data: orderCheck, error: checkError } = await supabase
      .from("orders")
      .select("venue_id, payment_status")
      .eq("id", orderId)
      .eq("venue_id", venue_id)
      .single();

    if (checkError || !orderCheck) {
      logger.error("[ORDERS PAYMENT] Order not found:", {
        error: checkError?.message,
        orderId,
        venue_id,
      });
      return NextResponse.json(
        { error: "Order not found" },
        { status: 404 }
      );
    }

    // Update payment status
    const updateData: Record<string, unknown> = {
      payment_status: payment_status || "PAID",
      updated_at: new Date().toISOString(),
    };

    if (payment_method) {
      updateData.payment_method = payment_method.toUpperCase();
      // If payment method is "till", set payment_mode to "pay_at_till"
      if (payment_method.toLowerCase() === "till") {
        updateData.payment_mode = "pay_at_till";
      }
    }

    const { data: updatedOrder, error: updateError } = await supabase
      .from("orders")
      .update(updateData)
      .eq("id", orderId)
      .eq("venue_id", venue_id)
      .select()
      .single();

    if (updateError || !updatedOrder) {
      logger.error("[ORDERS PAYMENT] Failed to update payment:", {
        error: updateError?.message,
        orderId,
        venue_id,
      });
      return NextResponse.json(
        { error: "Failed to update payment status" },
        { status: 500 }
      );
    }

    logger.info("[ORDERS PAYMENT] Payment updated successfully", {
      orderId,
      payment_status: updateData.payment_status,
      payment_method: updateData.payment_method,
      venue_id,
    });

    return NextResponse.json({ success: true, order: updatedOrder });
  } catch (error) {
    logger.error("[ORDERS PAYMENT] Unexpected error:", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

