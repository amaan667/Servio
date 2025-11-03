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
 */
export async function createKDSTickets(supabase: SupabaseClient, order: Order): Promise<void> {
  try {

    // First, ensure KDS stations exist for this venue
    const { data: existingStations } = await supabase
      .from("kds_stations")
      .select("id, station_type")
      .eq("venue_id", order.venue_id)
      .eq("is_active", true);

    if (!existingStations || existingStations.length === 0) {
      logger.debug("[KDS TICKETS] No stations found, creating default stations for venue", {
        extra: { venueId: order.venue_id },
      });

      // Create default stations
      const defaultStations = [
        { name: "Expo", type: "expo", order: 0, color: "#3b82f6" },
        { name: "Grill", type: "grill", order: 1, color: "#ef4444" },
        { name: "Fryer", type: "fryer", order: 2, color: "#f59e0b" },
        { name: "Barista", type: "barista", order: 3, color: "#8b5cf6" },
        { name: "Cold Prep", type: "cold", order: 4, color: "#06b6d4" },
      ];

      for (const station of defaultStations) {
        await supabase.from("kds_stations").upsert(
          {
            venue_id: order.venue_id,
            station_name: station.name,
            station_type: station.type,
            display_order: station.order,
            color_code: station.color,
            is_active: true,
          } as unknown as any,
          {
            onConflict: "venue_id,station_name",
          }
        );
      }

      // Fetch stations again
      const { data: stations } = await supabase
        .from("kds_stations")
        .select("id, station_type")
        .eq("venue_id", order.venue_id)
        .eq("is_active", true);

      if (!stations || stations.length === 0) {
        throw new Error("Failed to create KDS stations");
      }

      if (existingStations) {
        existingStations.push(...stations);
      }
    }

    // Get the expo station (default for all items)
    if (!existingStations || existingStations.length === 0) {
      throw new Error("No KDS stations available");
    }

    const expoStation =
      existingStations.find((s) => s.station_type === "expo") || existingStations[0];

    if (!expoStation) {
      throw new Error("No KDS station available");
    }

    // Create tickets for each order item
    const items = Array.isArray(order.items) ? order.items : [];

    for (const item of items) {
      const ticketData = {
        venue_id: order.venue_id,
        order_id: order.id,
        station_id: expoStation.id,
        item_name: item.item_name || "Unknown Item",
        quantity: typeof item.quantity === "string" ? parseInt(item.quantity) : item.quantity || 1,
        special_instructions: item.specialInstructions || null,
        table_number: order.table_number,
        table_label: order.table_id || order.table_number?.toString() || "Unknown",
        status: "new",
      };

      const { error: ticketError } = await supabase.from("kds_tickets").insert(ticketData);

      if (ticketError) {
        logger.error("[KDS TICKETS] Failed to create ticket for item:", {
          error: { item, context: ticketError },
        });
        throw ticketError;
      }
    }

    logger.debug("[KDS TICKETS] Successfully created KDS tickets", {
      data: { count: items.length, orderId: order.id },
    });
  } catch (_error) {
    logger.error("[KDS TICKETS] Error creating KDS tickets:", {
      error: _error instanceof Error ? _error.message : "Unknown _error",
    });
    throw _error;
  }
}

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
      status: "available",
    } as unknown as any)
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
