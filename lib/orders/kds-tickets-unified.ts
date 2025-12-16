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
    menu_item_id?: string | null;
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
  const baseContext = {
    orderId: order.id,
    venueId: order.venue_id,
    tableNumber: order.table_number,
    tableId: order.table_id,
    customerName: order.customer_name,
  };

  try {
    logger.info("[KDS TICKETS] Starting KDS ticket creation", {
      ...baseContext,
      itemCount: Array.isArray(order.items) ? order.items.length : 0,
    });

    // Step 1: Ensure KDS stations exist for this venue
    logger.debug("[KDS TICKETS] Step 1: ensuring KDS stations exist", baseContext);
    let existingStations = await ensureKDSStations(supabase, order.venue_id);

    if (!existingStations || existingStations.length === 0) {
      logger.error("[KDS TICKETS] No KDS stations available for venue", baseContext);
      throw new Error("No KDS stations available");
    }

    logger.debug("[KDS TICKETS] Step 2: stations found", {
      ...baseContext,
      stationCount: existingStations.length,
    });

    // Step 2: Get expo station as default
    const expoStation =
      existingStations.find((s) => s.station_type === "expo") || existingStations[0];

    if (!expoStation) {
      logger.error("[KDS TICKETS] No expo station available", baseContext);
      throw new Error("No KDS station available");
    }

    // Step 3: Get table label
    logger.debug("[KDS TICKETS] Step 3: resolving table label", baseContext);
    const tableLabel = await getTableLabel(supabase, order);
    logger.info("[KDS TICKETS] Table label resolved", { ...baseContext, tableLabel });

    // Step 4: Create tickets for each order item with AI assignment
    const items = Array.isArray(order.items) ? order.items : [];
    logger.info("[KDS TICKETS] Creating tickets for items", {
      ...baseContext,
      itemCount: items.length,
    });

    if (items.length === 0) {
      logger.warn("[KDS TICKETS] No items in order, skipping ticket creation", baseContext);
      return;
    }

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const itemName = item.item_name || "Unknown Item";
      const menuItemId = item.menu_item_id;

      logger.debug("[KDS TICKETS] Processing item", {
        ...baseContext,
        itemName,
        menuItemId,
        itemIndex: i + 1,
        totalItems: items.length,
      });

      // Step 1: Try to get station from menu item's category (category-based assignment)
      let assignedStation: KDSStation | null = null;
      if (menuItemId) {
        try {
          // First, get the menu item to find its category
          const { data: menuItem } = await supabase
            .from("menu_items")
            .select("category, name")
            .eq("id", menuItemId)
            .eq("venue_id", order.venue_id)
            .single();

          if (menuItem && menuItem.category) {
            // Check category-based station assignment
            const { data: categoryStation } = await supabase
              .from("kds_station_categories")
              .select("station_id")
              .eq("venue_id", order.venue_id)
              .eq("menu_category", menuItem.category)
              .eq("is_active", true)
              .maybeSingle();

            if (categoryStation?.station_id) {
              const stationFromCategory = existingStations.find((s) => s.id === categoryStation.station_id);
              if (stationFromCategory) {
                assignedStation = stationFromCategory;
                logger.debug("[KDS TICKETS] Station assigned from category", {
                  ...baseContext,
                  itemName,
                  menuItemId,
                  category: menuItem.category,
                  stationId: categoryStation.station_id,
                  stationType: stationFromCategory.station_type,
                });
              }
            }
          }
        } catch (error) {
          logger.debug("[KDS TICKETS] Failed to lookup menu item/category station, falling back to keywords", {
            ...baseContext,
            itemName,
            menuItemId,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      // Step 2: Fall back to keyword-based assignment if no category/menu item station found
      if (!assignedStation) {
        assignedStation = assignStationByKeywords(itemName, existingStations, expoStation);
      }

      logger.debug("[KDS TICKETS] Assigned station", {
        ...baseContext,
        itemName,
        station: assignedStation.station_type,
        stationName: assignedStation.station_name,
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
        quantity: typeof item.quantity === "string" ? parseInt(item.quantity) : item.quantity || 1,
        special_instructions: combinedInstructions || null,
        table_number: order.table_number,
        table_label: tableLabel,
        status: "new",
      };

      logger.info("[KDS TICKETS] Inserting ticket for item", {
        ...baseContext,
        itemName,
        ticketData,
      });

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
        const errorMsg = `KDS ticket insert failed: ${ticketError.message || ticketError.code || "Unknown error"}`;
        const error = new Error(errorMsg);
        (error as unknown as { details: unknown }).details = ticketError;
        throw error;
      }

      logger.info("[KDS TICKETS] Ticket created successfully", {
        ...baseContext,
        itemName,
        stationId: assignedStation.id,
      });
    }

    logger.info("[KDS TICKETS] All tickets created successfully", {
      ...baseContext,
      itemCount: items.length,
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
async function ensureKDSStations(supabase: SupabaseClient, venueId: string): Promise<KDSStation[]> {
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
async function getTableLabel(supabase: SupabaseClient, order: OrderForKDSTickets): Promise<string> {
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
  // Check for drink-related keywords FIRST (before checking "bowl" which could match Cold Prep)
  if (
    itemNameLower.includes("coffee") ||
    itemNameLower.includes("latte") ||
    itemNameLower.includes("cappuccino") ||
    itemNameLower.includes("espresso") ||
    itemNameLower.includes("mocha") ||
    itemNameLower.includes("americano") ||
    itemNameLower.includes("macchiato") ||
    itemNameLower.includes("tea") ||
    itemNameLower.includes("matcha") ||
    itemNameLower.includes("chai") ||
    itemNameLower.includes("hot chocolate") ||
    itemNameLower.includes("smoothie") ||
    itemNameLower.includes("juice") ||
    itemNameLower.includes("shake") ||
    itemNameLower.includes("drink") ||
    itemNameLower.includes("beverage") ||
    itemNameLower.includes("yogurt") ||
    itemNameLower.includes("acai") ||
    itemNameLower.includes("parfait")
  ) {
    const baristaStation = stations.find((s) => s.station_type === "barista");
    if (baristaStation) {
      logger.debug("[KDS CATEGORIZATION] Station match", {
        itemName,
        station: "barista",
      });
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
    itemNameLower.includes("halloumi") ||
    itemNameLower.includes("patty") ||
    itemNameLower.includes("meat") ||
    itemNameLower.includes("bacon") ||
    itemNameLower.includes("pancake") ||
    itemNameLower.includes("waffle") ||
    itemNameLower.includes("toast") ||
    itemNameLower.includes("croissant") ||
    itemNameLower.includes("bagel")
  ) {
    const grillStation = stations.find((s) => s.station_type === "grill");
    if (grillStation) {
      logger.debug("[KDS CATEGORIZATION] Station match", {
        itemName,
        station: "grill",
      });
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
      logger.debug("[KDS CATEGORIZATION] Station match", {
        itemName,
        station: "fryer",
      });
      return fryerStation;
    }
  }

  // Cold Prep Station - Salads, sandwiches, cold items
  // NOTE: "bowl" is checked here, but drink bowls (matcha, yogurt, acai) are caught by Barista first
  if (
    itemNameLower.includes("salad") ||
    itemNameLower.includes("sandwich") ||
    itemNameLower.includes("wrap") ||
    itemNameLower.includes("cold") ||
    itemNameLower.includes("sushi") ||
    itemNameLower.includes("poke") ||
    // Only match "bowl" if it's NOT a drink bowl (matcha, yogurt, acai already caught by Barista)
    (itemNameLower.includes("bowl") &&
      !itemNameLower.includes("matcha") &&
      !itemNameLower.includes("yogurt") &&
      !itemNameLower.includes("acai") &&
      !itemNameLower.includes("parfait")) ||
    itemNameLower.includes("hummus") ||
    itemNameLower.includes("mezze") ||
    itemNameLower.includes("dip") ||
    itemNameLower.includes("labneh") ||
    itemNameLower.includes("tzatziki") ||
    itemNameLower.includes("avo") ||
    itemNameLower.includes("avocado") ||
    itemNameLower.includes("loaded")
  ) {
    const coldStation = stations.find((s) => s.station_type === "cold");
    if (coldStation) {
      logger.debug("[KDS CATEGORIZATION] Station match", {
        itemName,
        station: "cold",
      });
      return coldStation;
    }
  }

  // Default to Expo if no match
  logger.debug("[KDS CATEGORIZATION] Station fallback", {
    itemName,
    station: "expo",
  });
  return defaultStation;
}
