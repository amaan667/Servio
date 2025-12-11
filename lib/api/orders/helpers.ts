/**
 * Order API Helpers
 * Extracted from orders/route.ts for better modularity
 */

import { logger } from "@/lib/logger";
import type { Database } from "@/types/database";

type SupabaseClient = Awaited<ReturnType<typeof import("@/lib/supabase").createClient>>;

interface OrderItem {
  item_name?: string;
  quantity?: string | number;
  specialInstructions?: string;
  [key: string]: unknown;
}

interface Order {
  id: string;
  venue_id: string;
  table_number?: number | null;
  table_id?: string | null;
  items?: OrderItem[];
}

/**
 * Create KDS (Kitchen Display System) tickets for an order
 *
 * This is a re-export of the unified AI-based implementation.
 * All KDS ticket creation now uses AI for station assignment.
 */
export { createKDSTicketsWithAI as createKDSTickets } from "@/lib/orders/kds-tickets-unified";

/**
 * Validate table exists or create it
 */
export async function ensureTableExists(
  supabase: SupabaseClient,
  venueId: string,
  tableNumber: number
): Promise<{ tableId: string | null; autoCreated: boolean }> {
  // Check if table exists
  const { data: existingTable } = await supabase
    .from("tables")
    .select("id, venue_id, table_number")
    .eq("venue_id", venueId)
    .eq("table_number", tableNumber)
    .maybeSingle();

  if (existingTable) {
    return { tableId: existingTable.id, autoCreated: false };
  }

  // Table doesn't exist, create it
  const { data: newTable, error: createError } = await supabase
    .from("tables")
    .insert({
      venue_id: venueId,
      table_number: tableNumber,
      label: `Table ${tableNumber}`,
      capacity: 4,
      is_active: true,
      status: "available" as Database["public"]["Tables"]["tables"]["Insert"]["status"],
    })
    .select("id")
    .single();

  if (createError || !newTable) {
    logger.error("[TABLE] Failed to auto-create table:", { error: createError });
    return { tableId: null, autoCreated: false };
  }

  return { tableId: newTable.id, autoCreated: true };
}

/**
 * Check for duplicate orders (within last 5 minutes)
 */
export async function findDuplicateOrder(
  supabase: SupabaseClient,
  venueId: string,
  customerPhone: string,
  totalAmount: number
): Promise<Record<string, unknown> | null> {
  try {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .eq("venue_id", venueId)
      .eq("customer_phone", customerPhone)
      .eq("total_amount", totalAmount)
      .gte("created_at", fiveMinutesAgo)
      .order("created_at", { ascending: false })
      .limit(1);

    if (error) {
      logger.warn("[ORDER DUPLICATE CHECK] Failed:", { error: error.message });
      return null;
    }

    return data && data.length > 0 ? (data[0] as Record<string, unknown>) : null;
  } catch (_error) {
    logger.warn("[ORDER DUPLICATE CHECK] Error:", {
      error: _error instanceof Error ? _error.message : "Unknown",
    });
    return null;
  }
}
