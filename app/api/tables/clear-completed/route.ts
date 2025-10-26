import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { apiLogger as logger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Clear tables for all completed/cancelled orders
 * Call: POST /api/tables/clear-completed
 */
export async function POST() {
  try {
    const admin = createAdminClient();

    // Get all completed/cancelled orders
    const { data: completedOrders } = await admin
      .from("orders")
      .select("id, venue_id, table_id, table_number, order_status")
      .in("order_status", ["COMPLETED", "CANCELLED", "REFUNDED"]);

    if (!completedOrders || completedOrders.length === 0) {
      return NextResponse.json({
        ok: true,
        message: "No tables to clear",
        cleared: 0,
      });
    }

    // Get order IDs
    const orderIds = completedOrders.map((o) => o.id);

    // Close table sessions for these orders
    const { data: clearedSessions, error: clearError } = await admin
      .from("table_sessions")
      .update({
        status: "FREE",
        order_id: null,
        closed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .in("order_id", orderIds)
      .is("closed_at", null)
      .select("id, table_id, venue_id");

    if (clearError) {
      return NextResponse.json({ ok: false, error: clearError.message }, { status: 500 });
    }

    logger.debug("[CLEAR COMPLETED TABLES] Cleared table sessions", {
      count: clearedSessions?.length || 0,
    });

    return NextResponse.json({
      ok: true,
      message: `Cleared ${clearedSessions?.length || 0} table sessions`,
      cleared: clearedSessions?.length || 0,
      orderIds: orderIds,
    });
  } catch (error) {
    logger.error("[CLEAR COMPLETED TABLES] Error:", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}
