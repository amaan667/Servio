import { errorToContext } from "@/lib/utils/error-to-context";

/**
 * Centralized table cleanup utilities
 * Ensures consistent table state management when orders are completed
 */

import { createClient } from "@/lib/supabase";
import { logger } from "@/lib/logger";

export interface TableCleanupParams {
  venueId: string;
  tableId?: string;
  tableNumber?: string;
  orderId?: string;
}

/**
 * Clean up table state when orders are completed
 * This function handles:
 * - Closing table sessions
 * - Clearing table runtime state
 * - Marking tables as FREE
 */
export async function cleanupTableOnOrderCompletion(params: TableCleanupParams): Promise<{
  success: boolean;
  error?: string;
  details?: {
    sessionsCleared: number;
    runtimeStateCleared: boolean;
  };
}> {
  const { venueId, tableId, tableNumber, orderId } = params;

  if (!tableId && !tableNumber) {
    return { success: false, error: "Either tableId or tableNumber must be provided" };
  }

  try {
    const supabase = await createClient();

    // First, check if there are unknown other active orders for this table
    // Active orders include all statuses except COMPLETED, CANCELLED, REFUNDED, EXPIRED
    let activeOrdersQuery = supabase
      .from("orders")
      .select("id, order_status, table_id, table_number")
      .eq("venue_id", venueId)
      .in("order_status", ["PLACED", "ACCEPTED", "IN_PREP", "READY", "SERVING", "SERVED"]);

    // Exclude the current order if provided
    if (orderId) {
      activeOrdersQuery = activeOrdersQuery.neq("id", orderId);
    }

    // Filter by table identifier
    if (tableId) {
      activeOrdersQuery = activeOrdersQuery.eq("table_id", tableId);
    } else if (tableNumber) {
      activeOrdersQuery = activeOrdersQuery.eq("table_number", tableNumber);
    }

    const { data: activeOrders, error: activeOrdersError } = await activeOrdersQuery;

    if (activeOrdersError) {
      logger.error("[TABLE CLEANUP] Error checking active orders:", activeOrdersError);
      return { success: false, error: "Failed to check active orders" };
    }

    // If there are still active orders, don't clean up the table
    if (activeOrders && activeOrders.length > 0) {
      logger.debug(
        `[TABLE CLEANUP] Table has ${activeOrders.length} active orders, skipping cleanup`
      );
      return {
        success: true,
        details: { sessionsCleared: 0, runtimeStateCleared: false },
      };
    }


    let sessionsCleared = 0;
    let runtimeStateCleared = false;

    // 1. Clear table sessions (close active sessions)
    const sessionUpdateData = {
      status: "FREE",
      order_id: null,
      closed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    let sessionQuery = supabase
      .from("table_sessions")
      .update(sessionUpdateData)
      .eq("venue_id", venueId)
      .is("closed_at", null);

    if (tableId) {
      sessionQuery = sessionQuery.eq("table_id", tableId);
    } else if (tableNumber) {
      sessionQuery = sessionQuery.eq("table_number", tableNumber);
    }

    const { data: sessionData, error: sessionClearError } = await sessionQuery.select();

    if (sessionClearError) {
      logger.error("[TABLE CLEANUP] Error clearing table sessions:", sessionClearError);
    } else {
      sessionsCleared = sessionData?.length || 0;
    }

    // 2. Clear table runtime state
    if (tableNumber) {
      const { error: runtimeClearError } = await supabase
        .from("table_runtime_state")
        .update({
          primary_status: "FREE",
          order_id: null,
          updated_at: new Date().toISOString(),
        })
        .eq("venue_id", venueId)
        .eq("label", `Table ${tableNumber}`);

      if (runtimeClearError) {
        logger.error("[TABLE CLEANUP] Error clearing table runtime state:", runtimeClearError);
      } else {
        runtimeStateCleared = true;
      }
    }

    // 3. If we have a table_id, also try to clear by table_id in runtime state
    if (tableId) {
      const { error: runtimeClearErrorById } = await supabase
        .from("table_runtime_state")
        .update({
          primary_status: "FREE",
          order_id: null,
          updated_at: new Date().toISOString(),
        })
        .eq("venue_id", venueId)
        .eq("table_id", tableId);

      if (runtimeClearErrorById) {
        logger.error(
          "[TABLE CLEANUP] Error clearing table runtime state by ID:",
          runtimeClearErrorById
        );
      } else {
        runtimeStateCleared = true;
      }
    }


    return {
      success: true,
      details: {
        sessionsCleared,
        runtimeStateCleared,
      },
    };
  } catch (_error) {
    logger.error("[TABLE CLEANUP] Unexpected _error during table cleanup:", errorToContext(_error));
    return {
      success: false,
      error: _error instanceof Error ? _error.message : "Unknown _error during table cleanup",
    };
  }
}

/**
 * Check if a table has unknown active orders
 */
export async function hasActiveOrders(params: TableCleanupParams): Promise<{
  hasActive: boolean;
  count: number;
  error?: string;
}> {
  const { venueId, tableId, tableNumber, orderId } = params;

  if (!tableId && !tableNumber) {
    return { hasActive: false, count: 0, error: "Either tableId or tableNumber must be provided" };
  }

  try {
    const supabase = await createClient();

    let query = supabase
      .from("orders")
      .select("id", { count: "exact" })
      .eq("venue_id", venueId)
      .in("order_status", ["PLACED", "ACCEPTED", "IN_PREP", "READY", "SERVING"]);

    if (orderId) {
      query = query.neq("id", orderId);
    }

    if (tableId) {
      query = query.eq("table_id", tableId);
    } else if (tableNumber) {
      query = query.eq("table_number", tableNumber);
    }

    const { count, error } = await query;

    if (error) {
      logger.error("[TABLE CLEANUP] Error checking active orders:", errorToContext(error));
      return { hasActive: false, count: 0, error: error.message };
    }

    return {
      hasActive: (count || 0) > 0,
      count: count || 0,
    };
  } catch (_error) {
    logger.error(
      "[TABLE CLEANUP] Unexpected _error checking active orders:",
      errorToContext(_error)
    );
    return {
      hasActive: false,
      count: 0,
      error: _error instanceof Error ? _error.message : "Unknown _error",
    };
  }
}
