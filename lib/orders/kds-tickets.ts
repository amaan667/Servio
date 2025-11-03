import { createSupabaseClient } from "@/lib/supabase";
import { logger } from "@/lib/logger";

/**
 * Creates KDS tickets for an order
 */
export async function createKDSTickets(
  supabase: Awaited<ReturnType<typeof createSupabaseClient>>,
  order: { id: string; venue_id: string; items?: Array<Record<string, unknown>> }
) {
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
          },
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
      existingStations.find(
        (s: Record<string, unknown>) => (s as { station_type?: string }).station_type === "expo"
      ) || existingStations[0];

    if (!expoStation) {
      throw new Error("No KDS station available");
    }

    // Create tickets for each order item
    const items = Array.isArray(order.items) ? (order.items as Array<Record<string, unknown>>) : [];

    for (const item of items) {
      const itemData = item as {
        item_name?: string;
        quantity?: string | number;
        specialInstructions?: string;
      };
      const ticketData = {
        venue_id: order.venue_id,
        order_id: order.id,
        station_id: (expoStation as { id: string }).id,
        item_name: itemData.item_name || "Unknown Item",
        quantity:
          typeof itemData.quantity === "string"
            ? parseInt(itemData.quantity)
            : itemData.quantity || 1,
        special_instructions: itemData.specialInstructions || null,
        table_number: (order as Record<string, unknown>).table_number as number | null,
        table_label:
          ((order as Record<string, unknown>).table_id as string) ||
          ((order as Record<string, unknown>).table_number as number | undefined)?.toString() ||
          "Unknown",
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
      error: _error instanceof Error ? _error.message : "Unknown error",
    });
    throw _error;
  }
}
