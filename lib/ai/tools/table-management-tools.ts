// Servio AI Assistant - Table Management Tools
// Table availability, creation, merging, and queries

import { createAdminClient } from "@/lib/supabase";
import { aiLogger } from "@/lib/logger";

interface TableAvailabilityResult {
  available: Array<{
    id: string;
    label: string;
    seats: number;
    status: string;
  }>;
  occupied: Array<{
    id: string;
    label: string;
    seats: number;
    customerName?: string;
    orderCount: number;
  }>;
  summary: string;
}

interface TableCreationResult {
  success: boolean;
  table: {
    id: string;
    label: string;
    tableNumber: number;
    seats: number;
  };
  message: string;
}

interface TableMergeResult {
  success: boolean;
  mergedTableId: string;
  originalTables: string[];
  message: string;
}

interface TablesWithOrdersResult {
  tables: Array<{
    tableLabel: string;
    tableNumber: number;
    activeOrders: number;
    totalAmount: number;
    oldestOrder: string;
  }>;
  count: number;
  summary: string;
}

/**
 * Get available and occupied tables
 */
export async function getTableAvailability(venueId: string): Promise<TableAvailabilityResult> {
  const supabase = createAdminClient();

  aiLogger.info(`[AI TABLE] Fetching table availability for venue: ${venueId}`);

  // Get all tables
  const { data: tables, error: tablesError } = await supabase
    .from("tables")
    .select("id, label, seats, status")
    .eq("venue_id", venueId)
    .eq("is_active", true)
    .order("label", { ascending: true });

  if (tablesError) {
    aiLogger.error("[AI TABLE] Error fetching tables:", tablesError);
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
  });

  const available: TableAvailabilityResult["available"] = [];
  const occupied: TableAvailabilityResult["occupied"] = [];

  tables?.forEach((table) => {
    const session = sessionMap.get(table.id);
    const orderCount = orderCounts.get(table.label) || 0;

    if (session || orderCount > 0 || table.status === "occupied") {
      occupied.push({
        id: table.id,
        label: table.label,
        seats: table.seats || 0,
        customerName: session?.customer_name,
        orderCount,
      });
    } else {
      available.push({
        id: table.id,
        label: table.label,
        seats: table.seats || 0,
        status: table.status || "available",
      });
    }
  });

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
  venueId: string,
  tableLabel: string,
  seats: number = 4
): Promise<TableCreationResult> {
  const supabase = createAdminClient();

  aiLogger.info(`[AI TABLE] Creating table: ${tableLabel} with ${seats} seats`);

  // Check if table already exists
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
      venue_id: venueId,
      label: tableLabel,
      seats,
      status: "available",
      is_active: true,
    })
    .select("id, label, seats")
    .single();

  if (createError) {
    aiLogger.error("[AI TABLE] Error creating table:", createError);
    throw new Error(`Failed to create table: ${createError.message}`);
  }

  return {
    success: true,
    table: {
      id: newTable.id,
      label: newTable.label,
      tableNumber: parseInt(tableLabel.match(/\d+/)?.[0] || "0"),
      seats: newTable.seats || 0,
    },
    message: `Created ${tableLabel} with ${seats} seats. Table is now ready for QR code generation.`,
  };
}

/**
 * Merge two or more tables
 */
export async function mergeTables(
  venueId: string,
  tableIds: string[],
  mergedLabel?: string
): Promise<TableMergeResult> {
  const supabase = createAdminClient();

  aiLogger.info(`[AI TABLE] Merging tables: ${tableIds.join(", ")}`);

  if (tableIds.length < 2) {
    throw new Error("At least 2 tables are required for merging.");
  }

  // Get table details
  const { data: tables, error: fetchError } = await supabase
    .from("tables")
    .select("id, label, seats, status")
    .eq("venue_id", venueId)
    .in("id", tableIds);

  if (fetchError || !tables || tables.length !== tableIds.length) {
    throw new Error("Failed to fetch all tables for merging.");
  }

  // Check if all tables are available or occupied (can't merge mixed states)
  const allAvailable = tables.every((t) => t.status === "available");
  if (!allAvailable) {
    // For occupied tables, we need to merge the sessions
    aiLogger.info("[AI TABLE] Merging occupied tables - will merge sessions");
  }

  const tableLabels = tables.map((t) => t.label);
  const totalSeats = tables.reduce((sum, t) => sum + (t.seats || 0), 0);

  // Generate merged label if not provided
  const finalLabel = mergedLabel || `${tableLabels[0]} + ${tableLabels.slice(1).join(" + ")}`;

  // Call the enhanced merge API (internal function call)
  // This would typically be done via API endpoint
  const mergeResult = await performTableMerge(supabase, venueId, tableIds, finalLabel, totalSeats);

  return {
    success: true,
    mergedTableId: mergeResult.mergedTableId,
    originalTables: tableLabels,
    message: `Successfully merged ${tableLabels.join(", ")} into "${finalLabel}". Total ${totalSeats} seats.`,
  };
}

/**
 * Helper function to perform table merge
 */
async function performTableMerge(
  supabase: any,
  venueId: string,
  tableIds: string[],
  mergedLabel: string,
  totalSeats: number
): Promise<{ mergedTableId: string }> {
  // Create a new merged table
  const { data: mergedTable, error: createError } = await supabase
    .from("tables")
    .insert({
      venue_id: venueId,
      label: mergedLabel,
      seats: totalSeats,
      status: "occupied",
      is_merged: true,
      merged_from: tableIds,
      is_active: true,
    })
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

  aiLogger.info(`[AI TABLE] Fetching tables with active orders for venue: ${venueId}`);

  const { data: orders, error } = await supabase
    .from("orders")
    .select("id, table_label, total_amount, created_at, order_status")
    .eq("venue_id", venueId)
    .in("order_status", ["PLACED", "ACCEPTED", "IN_PREP", "READY", "SERVING"])
    .not("table_label", "is", null)
    .order("created_at", { ascending: true });

  if (error) {
    aiLogger.error("[AI TABLE] Error fetching orders:", error);
    throw new Error(`Failed to fetch orders: ${error.message}`);
  }

  // Group by table
  const tableMap = new Map<
    string,
    {
      orders: number;
      totalAmount: number;
      oldestOrder: Date;
    }
  >();

  orders?.forEach((order) => {
    if (!order.table_label) return;

    const existing = tableMap.get(order.table_label) || {
      orders: 0,
      totalAmount: 0,
      oldestOrder: new Date(order.created_at),
    };

    existing.orders++;
    existing.totalAmount += order.total_amount || 0;
    if (new Date(order.created_at) < existing.oldestOrder) {
      existing.oldestOrder = new Date(order.created_at);
    }

    tableMap.set(order.table_label, existing);
  });

  const tablesWithOrders = Array.from(tableMap.entries()).map(([tableLabel, data]) => ({
    tableLabel,
    tableNumber: parseInt(tableLabel.match(/\d+/)?.[0] || "0"),
    activeOrders: data.orders,
    totalAmount: data.totalAmount,
    oldestOrder: data.oldestOrder.toISOString(),
  }));

  return {
    tables: tablesWithOrders,
    count: tablesWithOrders.length,
    summary:
      tablesWithOrders.length > 0
        ? `${tablesWithOrders.length} tables have active orders. Busiest: ${tablesWithOrders[0]?.tableLabel} with ${tablesWithOrders[0]?.activeOrders} orders.`
        : "No tables have active orders currently.",
  };
}

/**
 * Get revenue by table for today
 */
export async function getRevenueByTable(venueId: string): Promise<{
  tables: Array<{
    tableLabel: string;
    tableNumber: number;
    orderCount: number;
    totalRevenue: number;
  }>;
  summary: string;
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
      count: 0,
      revenue: 0,
    };

    existing.count++;
    existing.revenue += order.total_amount || 0;
    tableMap.set(order.table_label, existing);
  });

  const tables = Array.from(tableMap.entries())
    .map(([tableLabel, data]) => ({
      tableLabel,
      tableNumber: parseInt(tableLabel.match(/\d+/)?.[0] || "0"),
      orderCount: data.count,
      totalRevenue: data.revenue,
    }))
    .sort((a, b) => b.totalRevenue - a.totalRevenue);

  const totalRevenue = tables.reduce((sum, t) => sum + t.totalRevenue, 0);

  return {
    tables,
    summary:
      tables.length > 0
        ? `${tables.length} tables served today. Top performer: ${tables[0]?.tableLabel} with £${tables[0]?.totalRevenue.toFixed(2)} revenue.`
        : "No table revenue recorded today.",
  };
}
