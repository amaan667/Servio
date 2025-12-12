import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { logger } from "@/lib/logger";
import { apiErrors } from "@/lib/api/standard-response";

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
      .select("venue_id")
      .eq("id", order_id)
      .single();

    if (orderError) {
      return apiErrors.notFound("Order not found");
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
      logger.error("[POS ORDERS STATUS] Error:", updateError);
      return apiErrors.internal("Internal server error");
    }

    return NextResponse.json({ order: updatedOrder });
  } catch (_error) {
    logger.error("[POS ORDERS STATUS] Unexpected error:", {
      error: _error instanceof Error ? _error.message : "Unknown _error",
    });
    return apiErrors.internal("Internal server error");
  }
}
