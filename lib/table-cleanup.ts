
/**
 * Centralized table cleanup utilities
 * Ensures consistent table state management when orders are completed
 */

import { createClient } from "@/lib/supabase";

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

    // Check ALL orders on this table to see if any are still active
    // Active orders are those with completion_status = 'OPEN' (unified lifecycle)
    // Fallback to checking order_status if completion_status column doesn't exist yet
    let allOrdersQuery = supabase
      .from("orders")
      .select("id, order_status, completion_status, table_id, table_number")
      .eq("venue_id", venueId);

    // Filter by table identifier
    if (tableId) {
      allOrdersQuery = allOrdersQuery.eq("table_id", tableId);
    } else if (tableNumber) {
      allOrdersQuery = allOrdersQuery.eq("table_number", tableNumber);
    }

    // Try completion_status first (unified lifecycle)
    // Check for orders that are still OPEN (not completed)
    let result = await allOrdersQuery.eq("completion_status", "OPEN");
    let activeOrders = result.data;
    let activeOrdersError = result.error;

    // If completion_status column doesn't exist, fall back to order_status check
    if (activeOrdersError && activeOrdersError.message?.includes("completion_status")) {

      let fallbackQuery = supabase
        .from("orders")
        .select("id, order_status, table_id, table_number")
        .eq("venue_id", venueId)
        .in("order_status", ["PLACED", "ACCEPTED", "IN_PREP", "READY", "SERVING", "SERVED"]);

      if (tableId) {
        fallbackQuery = fallbackQuery.eq("table_id", tableId);
      } else if (tableNumber) {
        fallbackQuery = fallbackQuery.eq("table_number", tableNumber);
      }

      const fallbackResult = await fallbackQuery;
      // Map fallback results to include completion_status as null for type compatibility
      activeOrders = fallbackResult.data
        ? (fallbackResult.data.map((o) => ({
            ...o,
            completion_status: null as string | null,
          })) as Array<{
            id: string;
            order_status: string;
            completion_status: string | null;
            table_id: string | null;
            table_number: number | null;
          }>)
        : null;
      activeOrdersError = fallbackResult.error;
    }

    if (activeOrdersError) {

      return { success: false, error: "Failed to check active orders" };
    }

    // If there are still active orders on this table, don't clean up the table
    // Only set table to FREE when ALL orders on the table are completed
    if (activeOrders && activeOrders.length > 0) {

      return {
        success: true,
        details: { sessionsCleared: 0, runtimeStateCleared: false },
      };
    }

    let sessionsCleared = 0;
    let runtimeStateCleared = false;

    // 1. Clear ALL table sessions for this table (not just open ones)
    // This ensures tables are freed even if sessions weren't properly closed
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
      .in("status", ["ACTIVE", "OCCUPIED"]); // Update both ACTIVE and OCCUPIED sessions

    if (tableId) {
      sessionQuery = sessionQuery.eq("table_id", tableId);
    } else if (tableNumber) {
      sessionQuery = sessionQuery.eq("table_number", tableNumber);
    }

    const { data: sessionData, error: sessionClearError } = await sessionQuery.select();

    if (sessionClearError) { /* Condition handled */ } else {
      sessionsCleared = sessionData?.length || 0;
      if (sessionsCleared > 0) { /* Condition handled */ }
    }

    // 2. Clear table runtime state - update ALL matching records to ensure table is FREE
    if (tableNumber) {
      const { data: runtimeData, error: runtimeClearError } = await supabase
        .from("table_runtime_state")
        .update({
          primary_status: "FREE",
          order_id: null,
          updated_at: new Date().toISOString(),
        })
        .eq("venue_id", venueId)
        .eq("label", `Table ${tableNumber}`)
        .select();

      if (runtimeClearError) { /* Condition handled */ } else {
        runtimeStateCleared = true;
        if (runtimeData && runtimeData.length > 0) { /* Condition handled */ }
      }
    }

    // 3. If we have a table_id, also try to clear by table_id in runtime state
    if (tableId) {
      const { data: runtimeDataById, error: runtimeClearErrorById } = await supabase
        .from("table_runtime_state")
        .update({
          primary_status: "FREE",
          order_id: null,
          updated_at: new Date().toISOString(),
        })
        .eq("venue_id", venueId)
        .eq("table_id", tableId)
        .select();

      if (runtimeClearErrorById) { /* Condition handled */ } else {
        runtimeStateCleared = true;
        if (runtimeDataById && runtimeDataById.length > 0) { /* Condition handled */ }
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

    // Try completion_status first (unified lifecycle), fallback to order_status
    let query = supabase.from("orders").select("id", { count: "exact" }).eq("venue_id", venueId);

    if (orderId) {
      query = query.neq("id", orderId);
    }

    if (tableId) {
      query = query.eq("table_id", tableId);
    } else if (tableNumber) {
      query = query.eq("table_number", tableNumber);
    }

    // Try completion_status first
    let result = await query.eq("completion_status", "OPEN");
    let count = result.count;
    let error = result.error;

    // If completion_status column doesn't exist, fall back to order_status check
    if (error && (error.message?.includes("completion_status") || error.code === "PGRST116")) {

      let fallbackQuery = supabase
        .from("orders")
        .select("id", { count: "exact" })
        .eq("venue_id", venueId)
        .in("order_status", ["PLACED", "ACCEPTED", "IN_PREP", "READY", "SERVING"]);

      if (orderId) {
        fallbackQuery = fallbackQuery.neq("id", orderId);
      }

      if (tableId) {
        fallbackQuery = fallbackQuery.eq("table_id", tableId);
      } else if (tableNumber) {
        fallbackQuery = fallbackQuery.eq("table_number", tableNumber);
      }

      const fallbackResult = await fallbackQuery;
      count = fallbackResult.count;
      error = fallbackResult.error;
    }

    if (error) {

      return { hasActive: false, count: 0, error: error.message };
    }

    return {
      hasActive: (count || 0) > 0,
      count: count || 0,
    };
  } catch (_error) {

    return {
      hasActive: false,
      count: 0,
      error: _error instanceof Error ? _error.message : "Unknown _error",
    };
  }
}
