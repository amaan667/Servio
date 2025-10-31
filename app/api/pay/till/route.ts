import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { order_id } = body;

    logger.info("💳 [PAY TILL] Payment at till requested", {
      orderId: order_id,
      timestamp: new Date().toISOString(),
    });

    if (!order_id) {
      logger.error("❌ [PAY TILL] Missing order ID");
      return NextResponse.json(
        {
          success: false,
          error: "Order ID is required",
        },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // Update order payment status to till
    const { data: order, error: updateError } = await supabase
      .from("orders")
      .update({
        payment_status: "TILL",
        payment_method: "till",
        updated_at: new Date().toISOString(),
      })
      .eq("id", order_id)
      .select()
      .single();

    if (updateError || !order) {
      logger.error("❌ [PAY TILL] Failed to update order", {
        orderId: order_id,
        error: updateError?.message,
      });
      return NextResponse.json(
        {
          success: false,
          error: "Failed to process order",
        },
        { status: 500 }
      );
    }

    logger.info("✅ [PAY TILL] Order marked for till payment successfully", {
      orderId: order.id,
      tableNumber: order.table_number,
      total: order.total_amount,
      orderNumber: order.order_number,
    });

    return NextResponse.json({
      success: true,
      order_number: order.order_number,
      data: {
        order_id: order.id,
        payment_status: "TILL",
        payment_method: "till",
        total_amount: order.total_amount,
      },
    });
  } catch (_error) {
    logger.error("[PAY TILL] Error:", {
      error: _error instanceof Error ? _error.message : "Unknown _error",
    });
    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
      },
      { status: 500 }
    );
  }
}
