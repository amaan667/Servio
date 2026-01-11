import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { cleanupTableOnOrderCompletion } from "@/lib/table-cleanup";

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

    // CRITICAL: Verify all orders are paid before bulk completing
    const { data: ordersToComplete, error: fetchError } = await supabase
      .from("orders")
      .select("id, payment_status, order_status")
      .in("id", targetOrderIds)
      .eq("venue_id", venueId);

    if (fetchError) {

      return apiErrors.internal("Failed to fetch orders");
    }

    // Filter out unpaid orders
    const unpaidOrders =
      ordersToComplete?.filter(
        (order) => !["PAID", "TILL"].includes((order.payment_status || "").toUpperCase())
      ) || [];

    if (unpaidOrders.length > 0) {
      return NextResponse.json(
        {
          error: `Cannot complete ${unpaidOrders.length} unpaid order(s). All orders must be PAID or TILL before completion.`,
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

    // Update all orders to COMPLETED using unified lifecycle RPC (atomic eligibility check)
    // This ensures completion_status is set correctly and triggers any database-level cleanup
    const completedOrders: Array<{
      id: string;
      table_id?: string | null;
      table_number?: number | null;
      source?: string;
    }> = [];

    for (const orderId of targetOrderIds) {
      try {
        const { data: completedRows, error: completeError } = await supabase.rpc(
          "orders_complete",
          {
            p_order_id: orderId,
            p_venue_id: venueId,
            p_forced: false,
            p_forced_by: null,
            p_forced_reason: null,
          }
        );

        if (completeError) {

          // Fallback: try direct update if RPC fails (backward compatibility)
          const { data: fallbackOrder } = await supabase
            .from("orders")
            .select("id, table_id, table_number, source")
            .eq("id", orderId)
            .single();
          if (fallbackOrder) {
            await supabase
              .from("orders")
              .update({
                order_status: "COMPLETED",
                completion_status: "COMPLETED",
                completed_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              })
              .eq("id", orderId);
            completedOrders.push(fallbackOrder);
          }
        } else {
          // Get order details for cleanup
          const { data: orderData } = await supabase
            .from("orders")
            .select("id, table_id, table_number, source")
            .eq("id", orderId)
            .single();
          if (orderData) {
            completedOrders.push(orderData);
          }
        }
      } catch (error) { /* Error handled silently */ }
    }

    const updatedOrders = completedOrders;

    // Handle table cleanup for completed orders
    if (updatedOrders && updatedOrders.length > 0) {
      // Get all unique table identifiers from completed orders
      const tableCleanupTasks = [];

      for (const order of updatedOrders) {
        if (order.table_id || order.table_number) {
          tableCleanupTasks.push(
            cleanupTableOnOrderCompletion({
              venueId: venueId, // Use the venueId from the request parameter
              tableId: order.table_id || undefined,
              tableNumber: order.table_number?.toString() || undefined,
            })
          );
        }
      }

      // Execute all cleanup tasks in parallel
      const cleanupResults = await Promise.allSettled(tableCleanupTasks);

      // Log results
      cleanupResults.forEach((result) => {
        if (result.status === "fulfilled") {
          if (result.value.success) { /* Condition handled */ } else { /* Else case handled */ }
        } else { /* Else case handled */ }
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
            continue; // Skip this table if we can't get details
          }

          // Clear table_id references in orders to avoid foreign key constraint issues
          const { error: clearTableRefsError } = await supabase
            .from('orders')
            .update({ table_id: null })
            .eq('table_id', tableId)
            .eq('venue_id', venueId);

          if (clearTableRefsError) {
            // Error handled silently
          }

          // Delete table sessions first
          const { error: deleteSessionError } = await supabase
            .from('table_sessions')
            .delete()
            .eq('table_id', tableId)
            .eq('venue_id', venueId);

          if (deleteSessionError) {
            // Error handled silently
          }
          
          // Clean up table runtime state
          const { error: deleteRuntimeError } = await supabase
            .from('table_runtime_state')
            .delete()
            .eq('table_id', tableId)
            .eq('venue_id', venueId);

          if (deleteRuntimeError) {
            // Error handled silently
          }
          
          // Clean up group sessions for this table
          const { error: deleteGroupSessionError } = await supabase
            .from('table_group_sessions')
            .delete()
            .eq('table_number', tableDetails.label)
            .eq('venue_id', venueId);

          if (deleteGroupSessionError) {
            // Error handled silently
          }

          // Finally, delete the table itself
          const { error: deleteTableError } = await supabase
            .from('tables')
            .delete()
            .eq('id', tableId)
            .eq('venue_id', venueId);

          if (deleteTableError) {
            // Error handled silently
          }
          
        } catch (tableError) {
          // Error handled silently
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

    return apiErrors.internal("Internal server error");
  }
}
