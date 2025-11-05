import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase";
import { getAuthUserForAPI } from "@/lib/auth/server";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    // Authenticate user
    const { user, error: authError } = await getAuthUserForAPI();

    if (authError || !user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    // Step 1: Parse request body
    const body = await req.json();

    const { order_id } = body;

    logger.info("💳 [PAY TILL] Payment at till requested", {
      orderId: order_id,
      userId: user.id,
      fullBody: body,
      timestamp: new Date().toISOString(),
    });

    if (!order_id) {
      console.error("[PAY TILL] ❌ Missing order ID in request body");
      logger.error("❌ [PAY TILL] Missing order ID");
      return NextResponse.json(
        {
          success: false,
          error: "Order ID is required",
        },
        { status: 400 }
      );
    }

    // Step 2: Create authenticated Supabase client
    const supabase = await createServerSupabase();

    // Verify order access
    const { data: orderCheck } = await supabase
      .from("orders")
      .select("venue_id")
      .eq("id", order_id)
      .single();

    if (!orderCheck) {
      return NextResponse.json({ success: false, error: "Order not found" }, { status: 404 });
    }

    // Verify venue access
    const { data: venueAccess } = await supabase
      .from("venues")
      .select("venue_id")
      .eq("venue_id", orderCheck.venue_id)
      .eq("owner_user_id", user.id)
      .maybeSingle();

    const { data: staffAccess } = await supabase
      .from("user_venue_roles")
      .select("role")
      .eq("venue_id", orderCheck.venue_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!venueAccess && !staffAccess) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    // Step 3: Attempt to update order
    const updateData = {
      payment_status: "TILL",
      payment_method: "till",
      updated_at: new Date().toISOString(),
    };

    const { data: order, error: updateError } = await supabase
      .from("orders")
      .update(updateData)
      .eq("id", order_id)
      .select()
      .single();

    if (updateError || !order) {
      console.error("[PAY TILL] ❌ Update failed:", {
        orderId: order_id,
        error: updateError,
        fullError: JSON.stringify(updateError, null, 2),
      });
      logger.error("❌ [PAY TILL] Failed to update order", {
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

    logger.info("✅ [PAY TILL] Order marked for till payment successfully", {
      orderId: order.id,
      tableNumber: order.table_number,
      total: order.total_amount,
      orderNumber: order.order_number,
    });

    const response = {
      success: true,
      order_number: order.order_number,
      data: {
        order_id: order.id,
        payment_status: "TILL",
        payment_method: "till",
        total_amount: order.total_amount,
      },
    };

    return NextResponse.json(response);
  } catch (_error) {
    console.error("[PAY TILL] 💥 EXCEPTION CAUGHT:", {
      error: _error,
      message: _error instanceof Error ? _error.message : "Unknown error",
      stack: _error instanceof Error ? _error.stack : undefined,
    });

    logger.error("[PAY TILL] Error:", {
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
