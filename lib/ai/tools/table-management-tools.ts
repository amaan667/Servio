// Servio AI Assistant - Table Management Tools
// Table availability, creation, merging, and queries

import { createAdminClient } from "@/lib/supabase";
import type { SupabaseClient } from "@supabase/supabase-js";

interface TableAvailabilityResult {

  }>;

  }>;

}

interface TableCreationResult {

  };

}

interface TableMergeResult {

}

interface TablesWithOrdersResult {

  }>;

}

/**
 * Get available and occupied tables
 */
export async function getTableAvailability(venueId: string): Promise<TableAvailabilityResult> {
  const supabase = createAdminClient();

  

  // Get all tables
  const { data: tables, error: tablesError } = await supabase
    .from("tables")
    .select("id, label, seat_count, status")
    .eq("venue_id", venueId)
    .eq("is_active", true)
    .order("label", { ascending: true });

  if (tablesError) {
    
    throw new Error(`Failed to fetch tables: ${tablesError.message}`);
  }

  // Get active sessions to determine occupancy
  const { data: sessions } = await supabase
    .from("table_sessions")
    .select("table_id, customer_name")
    .eq("venue_id", venueId)
    .eq("status", "active");

  const sessionMap = new Map(sessions?.map((s) => [s.table_id, s]) || []);

  // Get active orders per table (by label)
  const { data: activeOrders } = await supabase
    .from("orders")
    .select("table_label")
    .eq("venue_id", venueId)
    .in("order_status", ["PLACED", "ACCEPTED", "IN_PREP", "READY", "SERVING"]);

  const orderCounts = new Map<string, number>();
  activeOrders?.forEach((order) => {
    if (order.table_label) {
      orderCounts.set(order.table_label, (orderCounts.get(order.table_label) || 0) + 1);
    }

  const available: TableAvailabilityResult["available"] = [];
  const occupied: TableAvailabilityResult["occupied"] = [];

  tables?.forEach((table) => {
    const session = sessionMap.get(table.id);
    const orderCount = orderCounts.get(table.label) || 0;

    if (session || orderCount > 0 || table.status === "occupied") {
      occupied.push({

        orderCount,

    } else {
      available.push({

    }

  return {
    available,
    occupied,
    summary: `${available.length} tables available, ${occupied.length} tables occupied. Total capacity: ${available.length + occupied.length} tables.`,
  };
}

/**
 * Create a new table
 */
export async function createTable(

  const { data: existingTable } = await supabase
    .from("tables")
    .select("id, label")
    .eq("venue_id", venueId)
    .eq("label", tableLabel)
    .eq("is_active", true)
    .maybeSingle();

  if (existingTable) {
    throw new Error(`Table "${tableLabel}" already exists.`);
  }

  // Create the table
  const { data: newTable, error: createError } = await supabase
    .from("tables")
    .insert({

    .select("id, label, seat_count")
    .single();

  if (createError) {
    
    throw new Error(`Failed to create table: ${createError.message}`);
  }

  return {

    },
    message: `Created ${tableLabel} with ${seats} seats. Table is now ready for QR code generation.`,
  };
}

/**
 * Merge two or more tables
 */
export async function mergeTables(

  mergedLabel?: string
): Promise<TableMergeResult> {
  const supabase = createAdminClient();

  }`);

  if (tableIds.length < 2) {
    throw new Error("At least 2 tables are required for merging.");
  }

  // Get table details
  const { data: tables, error: fetchError } = await supabase
    .from("tables")
    .select("id, label, seat_count, status")
    .eq("venue_id", venueId)
    .in("id", tableIds);

  if (fetchError || !tables || tables.length !== tableIds.length) {
    throw new Error("Failed to fetch all tables for merging.");
  }

  // Check if all tables are available or occupied (can't merge mixed states)
  const allAvailable = tables.every((t) => t.status === "available");
  if (!allAvailable) {
    // For occupied tables, we need to merge the sessions
    
  }

  const tableLabels = tables.map((t) => t.label);
  const totalSeats = tables.reduce((sum, t) => sum + (t.seat_count || 0), 0);

  // Generate merged label if not provided
  const finalLabel = mergedLabel || `${tableLabels[0]} + ${tableLabels.slice(1).join(" + ")}`;

  // Call the enhanced merge API (internal function call)
  // This would typically be done via API endpoint
  const mergeResult = await performTableMerge(supabase, venueId, tableIds, finalLabel, totalSeats);

  return {

    message: `Successfully merged ${tableLabels.join(", ")} into "${finalLabel}". Total ${totalSeats} seats.`,
  };
}

/**
 * Helper function to perform table merge
 */
async function performTableMerge(

): Promise<{ mergedTableId: string }> {
  // Create a new merged table
  const { data: mergedTable, error: createError } = await supabase
    .from("tables")
    .insert({

    .select("id")
    .single();

  if (createError) {
    throw new Error(`Failed to create merged table: ${createError.message}`);
  }

  // Mark original tables as inactive
  await supabase
    .from("tables")
    .update({ is_active: false, merged_into: mergedTable.id })
    .in("id", tableIds);

  return { mergedTableId: mergedTable.id };
}

/**
 * Get tables with active orders
 */
export async function getTablesWithActiveOrders(venueId: string): Promise<TablesWithOrdersResult> {
  const supabase = createAdminClient();

  

  const { data: orders, error } = await supabase
    .from("orders")
    .select("id, table_label, total_amount, created_at, order_status")
    .eq("venue_id", venueId)
    .in("order_status", ["PLACED", "ACCEPTED", "IN_PREP", "READY", "SERVING"])
    .not("table_label", "is", null)
    .order("created_at", { ascending: true });

  if (error) {
    
    throw new Error(`Failed to fetch orders: ${error.message}`);
  }

  // Group by table
  const tableMap = new Map<
    string,
    {

    }
  >();

  orders?.forEach((order) => {
    if (!order.table_label) return;

    const existing = tableMap.get(order.table_label) || {

    };

    existing.orders++;
    existing.totalAmount += order.total_amount || 0;
    if (new Date(order.created_at) < existing.oldestOrder) {
      existing.oldestOrder = new Date(order.created_at);
    }

    tableMap.set(order.table_label, existing);

  const tablesWithOrders = Array.from(tableMap.entries()).map(([tableLabel, data]) => ({
    tableLabel,

  }));

  return {

        ? `${tablesWithOrders.length} tables have active orders. Busiest: ${tablesWithOrders[0]?.tableLabel} with ${tablesWithOrders[0]?.activeOrders} orders.`

  };
}

/**
 * Get revenue by table for today
 */
export async function getRevenueByTable(venueId: string): Promise<{

  }>;

}> {
  const supabase = createAdminClient();

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const { data: orders, error } = await supabase
    .from("orders")
    .select("table_label, total_amount")
    .eq("venue_id", venueId)
    .gte("created_at", startOfDay.toISOString())
    .not("order_status", "in", '("CANCELLED","REFUNDED")')
    .not("table_label", "is", null);

  if (error) {
    throw new Error(`Failed to fetch orders: ${error.message}`);
  }

  const tableMap = new Map<string, { count: number; revenue: number }>();

  orders?.forEach((order) => {
    if (!order.table_label) return;

    const existing = tableMap.get(order.table_label) || {

    };

    existing.count++;
    existing.revenue += order.total_amount || 0;
    tableMap.set(order.table_label, existing);

  const tables = Array.from(tableMap.entries())
    .map(([tableLabel, data]) => ({
      tableLabel,

    }))
    .sort((a, b) => b.totalRevenue - a.totalRevenue);

  const totalRevenue = tables.reduce((sum, t) => sum + t.totalRevenue, 0);

  return {
    tables,

        ? `${tables.length} tables served today. Top performer: ${tables[0]?.tableLabel} with £${tables[0]?.totalRevenue.toFixed(2)} revenue.`

  };
}
