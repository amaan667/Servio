import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    // Step 1: Parse request body
    const body = await req.json();

    const { order_id, sessionId } = body;

    logger.info("⏰ [PAY LATER] Pay later requested", {
      orderId: order_id,
      sessionId,
      fullBody: body,
      timestamp: new Date().toISOString(),
    });

    if (!order_id) {
      console.error("[PAY LATER] ❌ Missing order ID in request body");
      logger.error("❌ [PAY LATER] Missing order ID");
      return NextResponse.json(
        {
          success: false,
          error: "Order ID is required",
        },
        { status: 400 }
      );
    }

    // Step 2: Create Supabase client
    const supabase = createAdminClient();

    // Step 3: Attempt to update order
    const updateData = {
      payment_status: "PAY_LATER",
      payment_method: "later",
      updated_at: new Date().toISOString(),
    };

    const { data: order, error: updateError } = await supabase
      .from("orders")
      .update(updateData)
      .eq("id", order_id)
      .select()
      .single();

    if (updateError || !order) {
      console.error("[PAY LATER] ❌ Update failed:", {
        orderId: order_id,
        error: updateError,
        fullError: JSON.stringify(updateError, null, 2),
      });
      logger.error("❌ [PAY LATER] Failed to update order", {
        orderId: order_id,
        error: updateError?.message,
        fullError: updateError,
      });
      return NextResponse.json(
        {
          success: false,
          error: "Failed to process order",
          details: updateError?.message || "Unknown error",
        },
        { status: 500 }
      );
    }

    logger.info("✅ [PAY LATER] Order marked as pay later successfully", {
      orderId: order.id,
      tableNumber: order.table_number,
      total: order.total_amount,
      orderNumber: order.order_number,
      note: "Customer can re-scan QR to pay online",
    });

    const response = {
      success: true,
      order_number: order.order_number,
      data: {
        order_id: order.id,
        payment_status: "PAY_LATER",
        payment_method: "later",
        total_amount: order.total_amount,
      },
    };

    return NextResponse.json(response);
  } catch (_error) {
    console.error("[PAY LATER] 💥 EXCEPTION CAUGHT:", {
      error: _error,
      message: _error instanceof Error ? _error.message : "Unknown error",
      stack: _error instanceof Error ? _error.stack : undefined,
    });

    logger.error("[PAY LATER] Error:", {
      error: _error instanceof Error ? _error.message : "Unknown _error",
      fullError: _error,
    });

    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
        details: _error instanceof Error ? _error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
