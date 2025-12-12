import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { cleanupTableOnOrderCompletion } from "@/lib/table-cleanup";
import { logger } from "@/lib/logger";
import { apiErrors } from "@/lib/api/standard-response";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { venueId, orderIds } = await req.json();

    if (!venueId) {
      return apiErrors.badRequest("Venue ID is required");
    }

    // Use admin client - no authentication required for Live Orders feature
    const supabase = createAdminClient();

    // If no specific order IDs provided, get all active orders for the venue
    let targetOrderIds = orderIds;
    if (!targetOrderIds || targetOrderIds.length === 0) {
      const { data: activeOrders, error: fetchError } = await supabase
        .from("orders")
        .select("id")
        .eq("venue_id", venueId)
        .in("order_status", ["PLACED", "IN_PREP", "READY", "SERVING"]);

      if (fetchError) {
        logger.error("[BULK COMPLETE] Error fetching active orders:", { value: fetchError });
        return apiErrors.internal("Failed to fetch active orders");
      }

      targetOrderIds = activeOrders?.map((order) => order.id) || [];
    }

    if (targetOrderIds.length === 0) {
      return NextResponse.json({
        success: true,
        completedCount: 0,
        message: "No active orders to complete",
      });
    }

    // CRITICAL: Verify all orders are PAID before bulk completing
    const { data: ordersToComplete, error: fetchError } = await supabase
      .from("orders")
      .select("id, payment_status, order_status")
      .in("id", targetOrderIds)
      .eq("venue_id", venueId);

    if (fetchError) {
      logger.error("[BULK COMPLETE] Error fetching orders:", { value: fetchError });
      return apiErrors.internal("Failed to fetch orders");
    }

    // Filter out unpaid orders
    const unpaidOrders = ordersToComplete?.filter((order) => order.payment_status !== "PAID") || [];

    if (unpaidOrders.length > 0) {
      return NextResponse.json(
        {
          error: `Cannot complete ${unpaidOrders.length} unpaid order(s). All orders must be PAID before completion.`,
          unpaid_order_ids: unpaidOrders.map((o) => o.id),
        },
        { status: 400 }
      );
    }

    // Filter to only completable statuses
    const completableStatuses = ["SERVED", "READY", "SERVING"];
    const nonCompletableOrders =
      ordersToComplete?.filter((order) => !completableStatuses.includes(order.order_status)) || [];

    if (nonCompletableOrders.length > 0) {
      logger.warn("[BULK COMPLETE] Some orders not in completable status", {
        order_ids: nonCompletableOrders.map((o) => o.id),
      });
      // Continue with completable orders only
      const completableOrderIds =
        ordersToComplete
          ?.filter((order) => completableStatuses.includes(order.order_status))
          .map((o) => o.id) || [];

      if (completableOrderIds.length === 0) {
        return NextResponse.json(
          {
            error: "No orders in completable status (must be SERVED, READY, or SERVING)",
          },
          { status: 400 }
        );
      }

      targetOrderIds = completableOrderIds;
    }

    // Update all orders to COMPLETED status
    const { data: updatedOrders, error: updateError } = await supabase
      .from("orders")
      .update({
        order_status: "COMPLETED",
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .in("id", targetOrderIds)
      .eq("venue_id", venueId)
      .select("id, table_id, table_number, source");

    if (updateError) {
      logger.error("[BULK COMPLETE] Error updating orders:", { value: updateError });
      return apiErrors.internal("Failed to update orders");
    }

    // Handle table cleanup for completed orders
    if (updatedOrders && updatedOrders.length > 0) {
      // Get all unique table identifiers from completed orders
      const tableCleanupTasks = [];

      for (const order of updatedOrders) {
        if (order.table_id || order.table_number) {
          tableCleanupTasks.push(
            cleanupTableOnOrderCompletion({
              venueId: venueId, // Use the venueId from the request parameter
              tableId: order.table_id,
              tableNumber: order.table_number,
            })
          );
        }
      }

      // Execute all cleanup tasks in parallel
      const cleanupResults = await Promise.allSettled(tableCleanupTasks);

      // Log results
      cleanupResults.forEach((result, index) => {
        if (result.status === "fulfilled") {
          if (result.value.success) {
            logger.debug(
              `[BULK COMPLETE] Table cleanup ${index + 1} successful:`,
              result.value.details
            );
          } else {
            logger.error(`[BULK COMPLETE] Table cleanup ${index + 1} failed:`, result.value.error);
          }
        } else {
          logger.error(`[BULK COMPLETE] Table cleanup ${index + 1} rejected:`, result.reason);
        }
      });

      // Legacy table deletion logic (commented out - use cleanup instead)
      /*
      const tableIds = [...new Set(updatedOrders
        .filter(order => order.table_id)
        .map(order => order.table_id)
      )];
      
      for (const tableId of tableIds) {
        try {
          
          // Get table details first
          const { data: tableDetails, error: tableDetailsError } = await supabase
            .from('tables')
            .select('id, label, venue_id')
            .eq('id', tableId)
            .eq('venue_id', venueId)
            .single();

          if (tableDetailsError) {
            logger.error('[BULK COMPLETE] Error fetching table details:', { value: tableDetailsError });
            continue; // Skip this table if we can't get details
          }

          // Clear table_id references in orders to avoid foreign key constraint issues
          const { error: clearTableRefsError } = await supabase
            .from('orders')
            .update({ table_id: null })
            .eq('table_id', tableId)
            .eq('venue_id', venueId);

          if (clearTableRefsError) {
            logger.error('[BULK COMPLETE] Error clearing table references in orders:', { value: clearTableRefsError });
            logger.warn('[BULK COMPLETE] Proceeding with table deletion despite table reference clear failure');
          } else {
      // Intentionally empty
    }

          // Delete table sessions first
          const { error: deleteSessionError } = await supabase
            .from('table_sessions')
            .delete()
            .eq('table_id', tableId)
            .eq('venue_id', venueId);

          if (deleteSessionError) {
            logger.error('[BULK COMPLETE] Error deleting table sessions:', { value: deleteSessionError });
            logger.warn('[BULK COMPLETE] Proceeding with table deletion despite session deletion failure');
          } else {
      // Intentionally empty
    }
          
          // Clean up table runtime state
          const { error: deleteRuntimeError } = await supabase
            .from('table_runtime_state')
            .delete()
            .eq('table_id', tableId)
            .eq('venue_id', venueId);

          if (deleteRuntimeError) {
            logger.error('[BULK COMPLETE] Error deleting table runtime state:', { value: deleteRuntimeError });
            logger.warn('[BULK COMPLETE] Proceeding with table deletion despite runtime state deletion failure');
          } else {
      // Intentionally empty
    }
          
          // Clean up group sessions for this table
          const { error: deleteGroupSessionError } = await supabase
            .from('table_group_sessions')
            .delete()
            .eq('table_number', tableDetails.label) // Use table label to match group sessions
            .eq('venue_id', venueId);

          if (deleteGroupSessionError) {
            logger.error('[BULK COMPLETE] Error deleting group sessions:', { value: deleteGroupSessionError });
            logger.warn('[BULK COMPLETE] Proceeding with table deletion despite group session deletion failure');
          } else {
      // Intentionally empty
    }

          // Finally, delete the table itself
          const { error: deleteTableError } = await supabase
            .from('tables')
            .delete()
            .eq('id', tableId)
            .eq('venue_id', venueId);

          if (deleteTableError) {
            logger.error('[BULK COMPLETE] Error deleting table:', { value: deleteTableError });
            logger.error('[BULK COMPLETE] Error details:', {
              message: deleteTableError.message,
              details: deleteTableError.details,
              hint: deleteTableError.hint,
              code: deleteTableError.code
            });
          } else {
      // Intentionally empty
    }
          
        } catch (tableError) {
          logger.error('[BULK COMPLETE] Error handling table cleanup for table:', { error: tableId, context: tableError });
        }
      }
      */
    }

    return NextResponse.json({
      success: true,
      completedCount: updatedOrders?.length || 0,
      message: `Successfully completed ${updatedOrders?.length || 0} orders and cleaned up tables`,
    });
  } catch (_error) {
    logger.error("[BULK COMPLETE] Unexpected error:", {
      error: _error instanceof Error ? _error.message : "Unknown _error",
    });
    return apiErrors.internal("Internal server error");
  }
}
