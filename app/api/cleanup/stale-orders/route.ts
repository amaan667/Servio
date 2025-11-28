import { NextRequest, NextResponse } from "next/server";
import { createClient, getAuthenticatedUser } from "@/lib/supabase";
import { cleanupTableOnOrderCompletion } from "@/lib/table-cleanup";
import { logger } from "@/lib/logger";
import { success, apiErrors, isZodError, handleZodError } from '@/lib/api/standard-response';

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const { venueId, hoursThreshold = 4, closeAll = false } = await req.json();

    if (!venueId) {
      return apiErrors.badRequest('Venue ID is required');
    }

    const { user } = await getAuthenticatedUser();
    if (!user) {
      return apiErrors.unauthorized('Not authenticated');
    }

    const supabase = await createClient();

    // Verify venue ownership
    const { data: venue, error: venueError } = await supabase
      .from("venues")
      .select("venue_id")
      .eq("venue_id", venueId)
      .eq("owner_user_id", user.id)
      .single();

    if (venueError || !venue) {
      return apiErrors.forbidden('Venue not found or access denied');
    }

    // Find stale orders
    let staleOrdersQuery = supabase
      .from("orders")
      .select("id, table_id, table_number, venue_id, customer_name, order_status, created_at")
      .eq("venue_id", venueId)
      .in("order_status", ["PLACED", "ACCEPTED", "IN_PREP", "READY", "SERVING"]);

    if (!closeAll) {
      // Only get orders older than the threshold
      const cutoffTime = new Date(Date.now() - hoursThreshold * 60 * 60 * 1000);
      staleOrdersQuery = staleOrdersQuery.lt("created_at", cutoffTime.toISOString());
    }

    const { data: staleOrders, error: fetchError } = await staleOrdersQuery;

    if (fetchError) {
      logger.error("[STALE ORDERS CLEANUP] Error fetching stale orders:", {
        error: fetchError.message || "Unknown error",
      });
      return apiErrors.internal('Failed to fetch orders');
    }

    if (!staleOrders || staleOrders.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No stale orders found",
        completedCount: 0,
        cleanedTables: 0,
      });
    }


    // Update orders to completed
    const orderIds = staleOrders.map((order) => order.id);
    const { error: updateError } = await supabase
      .from("orders")
      .update({
        order_status: "COMPLETED",
        updated_at: new Date().toISOString(),
      })
      .in("id", orderIds);

    if (updateError) {
      logger.error("[STALE ORDERS CLEANUP] Error updating orders:", {
        error: updateError.message || "Unknown error",
      });
      return apiErrors.internal('Failed to update orders');
    }

    // Clean up tables for each order
    const tableCleanupTasks = [];
    const uniqueTables = new Set();

    for (const order of staleOrders) {
      if (order.table_id || order.table_number) {
        const tableKey = order.table_id || order.table_number;
        if (!uniqueTables.has(tableKey)) {
          uniqueTables.add(tableKey);
          tableCleanupTasks.push(
            cleanupTableOnOrderCompletion({
              venueId: order.venue_id,
              tableId: order.table_id,
              tableNumber: order.table_number,
            })
          );
        }
      }
    }

    // Execute table cleanup in parallel
    const cleanupResults = await Promise.allSettled(tableCleanupTasks);

    let successfulCleanups = 0;
    cleanupResults.forEach((result, index) => {
      if (result.status === "fulfilled" && result.value.success) {
        successfulCleanups++;
      } else {
        logger.error(
          `[STALE ORDERS CLEANUP] Table cleanup ${index + 1} failed:`,
          result.status === "fulfilled" ? result.value.error : result.reason
        );
      }
    });

    logger.debug(
      `[STALE ORDERS CLEANUP] Completed ${staleOrders.length} orders and cleaned ${successfulCleanups} tables`
    );

    return NextResponse.json({
      success: true,
      message: `Successfully cleaned up ${staleOrders.length} stale orders and ${successfulCleanups} tables`,
      completedCount: staleOrders.length,
      cleanedTables: successfulCleanups,
      orders: staleOrders.map((order) => ({
        id: order.id,
        table: order.table_number || order.table_id,
        customer: order.customer_name,
        hoursOpen:
          Math.round(
            ((Date.now() - new Date(order.created_at).getTime()) / (1000 * 60 * 60)) * 10
          ) / 10,
      })),
    });
  } catch (_error) {
    logger.error("[STALE ORDERS CLEANUP] Unexpected error:", {
      error: _error instanceof Error ? _error.message : "Unknown _error",
    });
    return apiErrors.internal('Internal server error');
  }
}
