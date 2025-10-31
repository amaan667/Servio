import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    console.log("[PAY LATER] 🚀 Starting pay later endpoint");

    // Step 1: Parse request body
    const body = await req.json();
    console.log("[PAY LATER] 📦 Request body received:", JSON.stringify(body, null, 2));

    const { order_id, sessionId } = body;
    console.log("[PAY LATER] 🆔 Extracted data:", { order_id, sessionId });

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
    console.log("[PAY LATER] 🔧 Creating Supabase admin client...");
    const supabase = createAdminClient();
    console.log("[PAY LATER] ✅ Supabase client created:", !!supabase);

    // Step 3: Check environment variables
    console.log("[PAY LATER] 🔑 Environment check:", {
      hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      hasServiceRoleKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      supabaseUrlLength: process.env.NEXT_PUBLIC_SUPABASE_URL?.length || 0,
      serviceRoleKeyLength: process.env.SUPABASE_SERVICE_ROLE_KEY?.length || 0,
    });

    // Step 4: Attempt to update order
    console.log("[PAY LATER] 💾 Attempting to update order:", order_id);
    const updateData = {
      payment_status: "PAY_LATER",
      payment_method: "later",
      updated_at: new Date().toISOString(),
    };
    console.log("[PAY LATER] 📝 Update data:", JSON.stringify(updateData, null, 2));

    const { data: order, error: updateError } = await supabase
      .from("orders")
      .update(updateData)
      .eq("id", order_id)
      .select()
      .single();

    console.log("[PAY LATER] 📊 Update result:", {
      success: !!order,
      hasError: !!updateError,
      errorMessage: updateError?.message,
      errorDetails: updateError?.details,
      errorHint: updateError?.hint,
      errorCode: updateError?.code,
      orderReturned: !!order,
    });

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

    console.log("[PAY LATER] ✅ Order updated successfully:", {
      orderId: order.id,
      tableNumber: order.table_number,
      total: order.total_amount,
      orderNumber: order.order_number,
      paymentStatus: order.payment_status,
    });

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

    console.log("[PAY LATER] 📤 Sending response:", JSON.stringify(response, null, 2));
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
