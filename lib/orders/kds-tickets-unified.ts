/**
 * Unified KDS Ticket Creation with AI Station Assignment
 * 
 * This is the single source of truth for creating KDS tickets.
 * All order creation and backfill operations should use this function.
 */

import { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "@/lib/logger";

export interface OrderForKDSTickets {
  id: string;
  venue_id: string;
  items?: Array<{
    item_name?: string;
    quantity?: string | number;
    specialInstructions?: string;
    modifiers?: unknown;
  }>;
  customer_name?: string;
  table_number?: number | null;
  table_id?: string;
}

interface KDSStation {
  id: string;
  station_type: string;
  station_name?: string;
}

/**
 * Creates KDS tickets for an order with AI-based station assignment
 * Falls back to keyword-based assignment if AI is unavailable
 */
export async function createKDSTicketsWithAI(
  supabase: SupabaseClient,
  order: OrderForKDSTickets
): Promise<void> {
  try {
    logger.debug("[KDS TICKETS] Starting KDS ticket creation", {
      orderId: order.id,
      venueId: order.venue_id,
      itemCount: Array.isArray(order.items) ? order.items.length : 0,
      tableNumber: order.table_number,
      tableId: order.table_id,
      customerName: order.customer_name,
    });

    // Step 1: Ensure KDS stations exist for this venue
    let existingStations = await ensureKDSStations(supabase, order.venue_id);

    if (!existingStations || existingStations.length === 0) {
      throw new Error("No KDS stations available");
    }

    // Step 2: Get expo station as default
    const expoStation =
      existingStations.find((s) => s.station_type === "expo") || existingStations[0];

    if (!expoStation) {
      throw new Error("No KDS station available");
    }

    // Step 3: Get table label
    const tableLabel = await getTableLabel(supabase, order);

    // Step 4: Create tickets for each order item with AI assignment
    const items = Array.isArray(order.items) ? order.items : [];

    // Get the next ticket number for this venue
    const { data: lastTicket } = await supabase
      .from("kds_tickets")
      .select("ticket_number")
      .eq("venue_id", order.venue_id)
      .order("ticket_number", { ascending: false })
      .limit(1)
      .maybeSingle();

    let nextTicketNumber = (lastTicket?.ticket_number || 0) + 1;

    for (const item of items) {
      const itemName = item.item_name || "Unknown Item";
      
      // Use AI to assign station, fallback to keyword matching
      const assignedStation = await assignStationWithAI(
        itemName,
        existingStations,
        expoStation,
        order.venue_id
      );

      const ticketData = {
        venue_id: order.venue_id,
        order_id: order.id,
        station_id: assignedStation.id,
        ticket_number: nextTicketNumber++,
        item_name: itemName,
        quantity:
          typeof item.quantity === "string"
            ? parseInt(item.quantity)
            : item.quantity || 1,
        special_instructions: item.specialInstructions || null,
        modifiers: item.modifiers || null,
        table_number: order.table_number,
        table_label: tableLabel,
        status: "new",
      };

      const { error: ticketError } = await supabase.from("kds_tickets").insert(ticketData);

      if (ticketError) {
        logger.error("[KDS TICKETS] Failed to create ticket for item:", {
          error: { item, context: ticketError },
          orderId: order.id,
          venueId: order.venue_id,
          ticketData,
          errorDetails: {
            code: ticketError.code,
            message: ticketError.message,
            details: ticketError.details,
            hint: ticketError.hint,
          },
        });
        // Convert to proper Error with details
        const errorMsg = `KDS ticket insert failed: ${ticketError.message || ticketError.code || 'Unknown error'}`;
        const error = new Error(errorMsg);
        (error as unknown as { details: unknown }).details = ticketError;
        throw error;
      }
    }

    logger.debug("[KDS TICKETS] Successfully created KDS tickets", {
      data: { count: items.length, orderId: order.id },
    });
  } catch (error) {
    logger.error("[KDS TICKETS] Error creating KDS tickets:", {
      error: error instanceof Error ? error.message : JSON.stringify(error),
      orderId: order.id,
      venueId: order.venue_id,
      fullError: error,
      stack: error instanceof Error ? error.stack : undefined,
    });
    throw error;
  }
}

/**
 * Ensures KDS stations exist for a venue, creates defaults if needed
 */
async function ensureKDSStations(
  supabase: SupabaseClient,
  venueId: string
): Promise<KDSStation[]> {
  let { data: existingStations } = await supabase
    .from("kds_stations")
    .select("id, station_type, station_name")
    .eq("venue_id", venueId)
    .eq("is_active", true);

  if (!existingStations || existingStations.length === 0) {
    logger.debug("[KDS TICKETS] No stations found, creating default stations for venue", {
      extra: { venueId },
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
          venue_id: venueId,
          station_name: station.name,
          station_type: station.type,
          display_order: station.order,
          color_code: station.color,
          is_active: true,
        },
        {
          onConflict: "venue_id,station_name",
        }
      );
    }

    // Fetch stations again
    const { data: stations } = await supabase
      .from("kds_stations")
      .select("id, station_type, station_name")
      .eq("venue_id", venueId)
      .eq("is_active", true);

    if (!stations || stations.length === 0) {
      throw new Error("Failed to create KDS stations");
    }

    existingStations = stations;
  }

  return existingStations as KDSStation[];
}

/**
 * Gets table label from table_id or table_number
 */
async function getTableLabel(
  supabase: SupabaseClient,
  order: OrderForKDSTickets
): Promise<string> {
  const customerName = order.customer_name;
  let tableLabel = customerName || "Guest";

  if (order.table_id) {
    const { data: tableData } = await supabase
      .from("tables")
      .select("label")
      .eq("id", order.table_id)
      .single();

    if (tableData?.label) {
      tableLabel = tableData.label;
    }
  } else if (order.table_number) {
    tableLabel = `Table ${order.table_number}`;
  }

  return tableLabel;
}

/**
 * Assigns a station to an item using AI, with keyword fallback
 */
async function assignStationWithAI(
  itemName: string,
  stations: KDSStation[],
  defaultStation: KDSStation,
  venueId: string
): Promise<KDSStation> {
  let assignedStation = defaultStation;

  // Try AI-based assignment (with timeout to prevent blocking)
  try {
    const stationTypes = stations.map((s) => s.station_type || "expo");
    const stationNames = stations.map((s) => s.station_name || "Expo");

    // Call LLM API with timeout
    const llmPromise = fetch(
      `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/ai/simple-chat`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: `Menu item: "${itemName}". Available stations: ${stationNames.join(", ")} (types: ${stationTypes.join(", ")}). Return ONLY the station type (barista/grill/fryer/cold/expo) - no other text.`,
          venueId,
        }),
      }
    );

    const timeoutPromise = new Promise<Response>((_, reject) =>
      setTimeout(() => reject(new Error("LLM timeout")), 2000)
    );

    const llmResponse = await Promise.race([llmPromise, timeoutPromise]);

    if (llmResponse.ok) {
      const llmResult = await llmResponse.json();
      const suggestedType = (llmResult.response || "")
        .toLowerCase()
        .trim()
        .replace(/[^a-z]/g, "");

      // Find station matching LLM suggestion
      const suggestedStation = stations.find(
        (s) => (s.station_type || "").toLowerCase() === suggestedType
      );

      if (suggestedStation) {
        assignedStation = suggestedStation;
        logger.debug("[KDS TICKETS] LLM assigned station", {
          item: itemName,
          station: assignedStation.station_type,
        });
        return assignedStation;
      }
    }
  } catch (llmError) {
    // LLM failed or timed out - will use keyword fallback
    logger.debug("[KDS TICKETS] LLM unavailable, using keyword fallback", {
      item: itemName,
    });
  }

  // Fallback: Keyword-based routing if AI didn't assign
  const itemNameLower = itemName.toLowerCase();

  if (
    itemNameLower.includes("coffee") ||
    itemNameLower.includes("latte") ||
    itemNameLower.includes("cappuccino") ||
    itemNameLower.includes("espresso") ||
    itemNameLower.includes("tea") ||
    itemNameLower.includes("drink")
  ) {
    const baristaStation = stations.find((s) => s.station_type === "barista");
    if (baristaStation) return baristaStation;
  } else if (
    itemNameLower.includes("burger") ||
    itemNameLower.includes("steak") ||
    itemNameLower.includes("chicken") ||
    itemNameLower.includes("grill")
  ) {
    const grillStation = stations.find((s) => s.station_type === "grill");
    if (grillStation) return grillStation;
  } else if (
    itemNameLower.includes("fries") ||
    itemNameLower.includes("chips") ||
    itemNameLower.includes("fried") ||
    itemNameLower.includes("fryer")
  ) {
    const fryerStation = stations.find((s) => s.station_type === "fryer");
    if (fryerStation) return fryerStation;
  } else if (
    itemNameLower.includes("salad") ||
    itemNameLower.includes("sandwich") ||
    itemNameLower.includes("cold")
  ) {
    const coldStation = stations.find((s) => s.station_type === "cold");
    if (coldStation) return coldStation;
  }

  return assignedStation;
}
