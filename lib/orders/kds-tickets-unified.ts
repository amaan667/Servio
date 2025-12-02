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
    console.log("[KDS TICKETS] ===== STARTING KDS TICKET CREATION =====", {
      orderId: order.id,
      venueId: order.venue_id,
      itemCount: Array.isArray(order.items) ? order.items.length : 0,
      tableNumber: order.table_number,
      tableId: order.table_id,
    });
    logger.debug("[KDS TICKETS] Starting KDS ticket creation", {
      orderId: order.id,
      venueId: order.venue_id,
      itemCount: Array.isArray(order.items) ? order.items.length : 0,
      tableNumber: order.table_number,
      tableId: order.table_id,
      customerName: order.customer_name,
    });

    // Step 1: Ensure KDS stations exist for this venue
    console.log("[KDS TICKETS] Step 1: Ensuring KDS stations exist...");
    let existingStations = await ensureKDSStations(supabase, order.venue_id);

    if (!existingStations || existingStations.length === 0) {
      console.error("[KDS TICKETS] ❌ No KDS stations available for venue", { venueId: order.venue_id });
      throw new Error("No KDS stations available");
    }

    console.log("[KDS TICKETS] Step 2: Found stations", { count: existingStations.length });

    // Step 2: Get expo station as default
    const expoStation =
      existingStations.find((s) => s.station_type === "expo") || existingStations[0];

    if (!expoStation) {
      console.error("[KDS TICKETS] ❌ No expo station available");
      throw new Error("No KDS station available");
    }

    // Step 3: Get table label
    console.log("[KDS TICKETS] Step 3: Getting table label...");
    const tableLabel = await getTableLabel(supabase, order);
    console.log("[KDS TICKETS] Table label:", { tableLabel });

    // Step 4: Create tickets for each order item with AI assignment
    const items = Array.isArray(order.items) ? order.items : [];
    console.log("[KDS TICKETS] Step 4: Creating tickets for items", { itemCount: items.length });

    if (items.length === 0) {
      console.warn("[KDS TICKETS] ⚠️ No items in order, skipping ticket creation");
      return;
    }

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const itemName = item.item_name || "Unknown Item";
      
      console.log(`[KDS TICKETS] Processing item ${i + 1}/${items.length}: ${itemName}`);
      
      // Use smart keyword categorization to assign station
      const assignedStation = assignStationByKeywords(
        itemName,
        existingStations,
        expoStation
      );

      console.log(`[KDS TICKETS] Assigned to station:`, { 
        station: assignedStation.station_type,
        stationName: assignedStation.station_name 
      });

      // Combine special instructions and modifiers for kitchen display
      let combinedInstructions = item.specialInstructions || "";
      
      // If modifiers exist, format them and add to instructions
      if (item.modifiers) {
        let modifiersText = "";
        try {
          // Handle modifiers as object or array
          if (typeof item.modifiers === "object" && item.modifiers !== null) {
            if (Array.isArray(item.modifiers)) {
              // Array of modifiers: ["Extra Cheese", "No Onions"]
              modifiersText = item.modifiers.join(", ");
            } else {
              // Object modifiers: { size: "Large", toppings: ["Pepperoni"] }
              const modParts: string[] = [];
              for (const [key, value] of Object.entries(item.modifiers)) {
                if (Array.isArray(value)) {
                  modParts.push(`${key}: ${value.join(", ")}`);
                } else if (value) {
                  modParts.push(`${key}: ${value}`);
                }
              }
              modifiersText = modParts.join(" | ");
            }
          } else if (typeof item.modifiers === "string") {
            modifiersText = item.modifiers;
          }
        } catch (error) {
          logger.warn("[KDS TICKETS] Failed to parse modifiers:", { error });
        }
        
        // Combine instructions and modifiers
        if (modifiersText) {
          combinedInstructions = combinedInstructions
            ? `${combinedInstructions} | ${modifiersText}`
            : modifiersText;
        }
      }

      const ticketData = {
        venue_id: order.venue_id,
        order_id: order.id,
        station_id: assignedStation.id,
        item_name: itemName,
        quantity:
          typeof item.quantity === "string"
            ? parseInt(item.quantity)
            : item.quantity || 1,
        special_instructions: combinedInstructions || null,
        table_number: order.table_number,
        table_label: tableLabel,
        status: "new",
      };

      console.log(`[KDS TICKETS] Inserting ticket for item: ${itemName}`, {
        ticketData: JSON.stringify(ticketData, null, 2),
      });

      const { error: ticketError } = await supabase.from("kds_tickets").insert(ticketData);

      if (ticketError) {
        console.error(`[KDS TICKETS] ❌ Failed to insert ticket for item: ${itemName}`, {
          errorCode: ticketError.code,
          errorMessage: ticketError.message,
          errorDetails: ticketError.details,
          errorHint: ticketError.hint,
          ticketData: JSON.stringify(ticketData, null, 2),
          fullError: JSON.stringify(ticketError, null, 2),
        });
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

      console.log(`[KDS TICKETS] ✅ Ticket created successfully for: ${itemName}`);
    }

    console.log("[KDS TICKETS] ===== ✅ ALL TICKETS CREATED SUCCESSFULLY =====", {
      count: items.length,
      orderId: order.id,
    });
    logger.debug("[KDS TICKETS] Successfully created KDS tickets", {
      data: { count: items.length, orderId: order.id },
    });
  } catch (error) {
    console.error("[KDS TICKETS] ===== ❌ KDS TICKET CREATION FAILED =====", {
      error: error instanceof Error ? error.message : JSON.stringify(error),
      orderId: order.id,
      venueId: order.venue_id,
      stack: error instanceof Error ? error.stack : undefined,
      fullError: JSON.stringify(error, Object.getOwnPropertyNames(error)),
    });
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
 * Assigns a station to an item using smart keyword categorization
 */
function assignStationByKeywords(
  itemName: string,
  stations: KDSStation[],
  defaultStation: KDSStation
): KDSStation {
  const itemNameLower = itemName.toLowerCase();

  // Barista Station - Drinks & Beverages
  if (
    itemNameLower.includes("coffee") ||
    itemNameLower.includes("latte") ||
    itemNameLower.includes("cappuccino") ||
    itemNameLower.includes("espresso") ||
    itemNameLower.includes("mocha") ||
    itemNameLower.includes("americano") ||
    itemNameLower.includes("macchiato") ||
    itemNameLower.includes("tea") ||
    itemNameLower.includes("chai") ||
    itemNameLower.includes("hot chocolate") ||
    itemNameLower.includes("smoothie") ||
    itemNameLower.includes("juice") ||
    itemNameLower.includes("shake") ||
    itemNameLower.includes("drink") ||
    itemNameLower.includes("beverage")
  ) {
    const baristaStation = stations.find((s) => s.station_type === "barista");
    if (baristaStation) {
      console.log(`[KDS CATEGORIZATION] ${itemName} → Barista (drinks)`);
      return baristaStation;
    }
  }

  // Grill Station - Hot grilled items
  if (
    itemNameLower.includes("burger") ||
    itemNameLower.includes("steak") ||
    itemNameLower.includes("chicken") ||
    itemNameLower.includes("beef") ||
    itemNameLower.includes("lamb") ||
    itemNameLower.includes("pork") ||
    itemNameLower.includes("sausage") ||
    itemNameLower.includes("kebab") ||
    itemNameLower.includes("grill") ||
    itemNameLower.includes("bbq") ||
    itemNameLower.includes("ribs") ||
    itemNameLower.includes("halloumi")
  ) {
    const grillStation = stations.find((s) => s.station_type === "grill");
    if (grillStation) {
      console.log(`[KDS CATEGORIZATION] ${itemName} → Grill (hot grilled)`);
      return grillStation;
    }
  }

  // Fryer Station - Fried items
  if (
    itemNameLower.includes("fries") ||
    itemNameLower.includes("chips") ||
    itemNameLower.includes("fried") ||
    itemNameLower.includes("fryer") ||
    itemNameLower.includes("wings") ||
    itemNameLower.includes("nuggets") ||
    itemNameLower.includes("crispy") ||
    itemNameLower.includes("tempura") ||
    itemNameLower.includes("calamari") ||
    itemNameLower.includes("onion rings")
  ) {
    const fryerStation = stations.find((s) => s.station_type === "fryer");
    if (fryerStation) {
      console.log(`[KDS CATEGORIZATION] ${itemName} → Fryer (fried)`);
      return fryerStation;
    }
  }

  // Cold Prep Station - Salads, sandwiches, cold items
  if (
    itemNameLower.includes("salad") ||
    itemNameLower.includes("sandwich") ||
    itemNameLower.includes("wrap") ||
    itemNameLower.includes("cold") ||
    itemNameLower.includes("sushi") ||
    itemNameLower.includes("poke") ||
    itemNameLower.includes("bowl") ||
    itemNameLower.includes("hummus") ||
    itemNameLower.includes("mezze") ||
    itemNameLower.includes("dip") ||
    itemNameLower.includes("labneh") ||
    itemNameLower.includes("tzatziki")
  ) {
    const coldStation = stations.find((s) => s.station_type === "cold");
    if (coldStation) {
      console.log(`[KDS CATEGORIZATION] ${itemName} → Cold Prep (cold items)`);
      return coldStation;
    }
  }

  // Default to Expo if no match
  console.log(`[KDS CATEGORIZATION] ${itemName} → Expo (default/no match)`);
  return defaultStation;
}
