import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase";

import { createUnifiedHandler } from "@/lib/api/unified-handler";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { success, apiErrors } from "@/lib/api/standard-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Clear tables for all completed/cancelled orders
 * Call: POST /api/tables/clear-completed
 */
export const POST = createUnifiedHandler(
  async (_req: NextRequest, context) => {
    // Get venueId from context
    const venueId = context.venueId;

    if (!venueId) {
      return apiErrors.badRequest("venue_id is required");
    }

    // Business logic - Find completed orders and clear their table sessions
    const supabase = createAdminClient();

    // Find all orders that are completed or cancelled and have a table
    const { data: completedOrders, error: ordersError } = await supabase
      .from("orders")
      .select("id, table_id, table_number")
      .eq("venue_id", venueId)
      .in("order_status", ["COMPLETED", "CANCELLED"]);

    if (ordersError) {
      return apiErrors.database("Failed to fetch completed orders");
    }

    if (!completedOrders || completedOrders.length === 0) {
      return success({
        message: "No completed orders found",
        cleared: 0,
        orderIds: [],
      });
    }

    const orderIds = completedOrders.map((o) => o.id);
    const tableIds = completedOrders.map((o) => o.table_id).filter((id): id is string => !!id);

    if (tableIds.length === 0) {
      return success({
        message: "No tables to clear",
        cleared: 0,
        orderIds,
      });
    }

    // Close table sessions for these tables
    const { data: clearedSessions, error: clearError } = await supabase
      .from("table_sessions")
      .update({
        closed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .in("table_id", tableIds)
      .eq("venue_id", venueId)
      .is("closed_at", null)
      .select();

    if (clearError) {
      return apiErrors.database("Failed to clear table sessions");
    }

    return success({
      message: `Cleared ${clearedSessions?.length || 0} table sessions`,
      cleared: clearedSessions?.length || 0,
      orderIds,
    });
  },
  {
    requireVenueAccess: true,
    rateLimit: RATE_LIMITS.GENERAL,
  }
);
