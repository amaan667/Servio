import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { logger } from "@/lib/logger";

/**
 * POST /api/orders/close-table-session
 * Closes table session when order is completed/served
 */
export async function POST(req: NextRequest) {
  try {
    const { orderId } = await req.json();

    if (!orderId) {
      return NextResponse.json({ error: "orderId is required" }, { status: 400 });
    }

    const supabase = createAdminClient();

    // Get order details
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("venue_id, table_id, table_number")
      .eq("id", orderId)
      .single();

    if (orderError || !order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    logger.info("[CLOSE TABLE SESSION] Closing table session for order", {
      orderId,
      tableId: order.table_id,
      tableNumber: order.table_number,
    });

    // Close any active table sessions for this table
    if (order.table_id) {
      const { error: sessionCloseError } = await supabase
        .from("table_sessions")
        .update({
          status: "CLOSED",
          closed_at: new Date().toISOString(),
        })
        .eq("venue_id", order.venue_id)
        .eq("table_id", order.table_id)
        .is("closed_at", null);

      if (sessionCloseError) {
        logger.error("[CLOSE TABLE SESSION] Error closing table session:", sessionCloseError);
      } else {
        // Session closed successfully
      }
    }

    // Update table runtime state to FREE
    if (order.table_number) {
      const { error: runtimeError } = await supabase
        .from("table_runtime_state")
        .update({
          primary_status: "FREE",
          updated_at: new Date().toISOString(),
        })
        .eq("venue_id", order.venue_id)
        .eq("table_number", order.table_number);

      if (runtimeError) {
        logger.error("[CLOSE TABLE SESSION] Error updating table runtime state:", runtimeError);
      } else {
        // Runtime state updated successfully
      }
    }

    return NextResponse.json({
      success: true,
      message: "Table session closed successfully",
    });
  } catch (_error) {
    logger.error(
      "[CLOSE TABLE SESSION] Unexpected error:",
      _error instanceof Error ? _error : { error: String(_error) }
    );
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
