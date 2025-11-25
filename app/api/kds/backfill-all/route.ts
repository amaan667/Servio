import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";
import { logger } from "@/lib/logger";
import { requireVenueAccessForAPI } from "@/lib/auth/api";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";

interface KDSStation {
  id: string;
  station_type: string;
  [key: string]: unknown;
}

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {

    // CRITICAL: Authentication and venue access verification
    const { searchParams } = new URL(req.url);
    let venueId = searchParams.get('venueId') || searchParams.get('venue_id');
    
    if (!venueId) {
      try {
        const body = await req.clone().json();
        venueId = body?.venueId || body?.venue_id;
      } catch {
        // Body parsing failed
      }
    }
    
    if (venueId) {
      const venueAccessResult = await requireVenueAccessForAPI(venueId);
      if (!venueAccessResult.success) {
        return venueAccessResult.response;
      }
    } else {
      // Fallback to basic auth if no venueId
      const { requireAuthForAPI } = await import('@/lib/auth/api');
      const authResult = await requireAuthForAPI();
      if (authResult.error || !authResult.user) {
        return NextResponse.json(
          { error: 'Unauthorized', message: authResult.error || 'Authentication required' },
          { status: 401 }
        );
      }
    }

    // CRITICAL: Rate limiting
    const rateLimitResult = await rateLimit(req, RATE_LIMITS.GENERAL);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        {
          error: 'Too many requests',
          message: `Rate limit exceeded. Try again in ${Math.ceil((rateLimitResult.reset - Date.now()) / 1000)} seconds.`,
        },
        { status: 429 }
      );
    }

    const body = await req.json();
    const venueIdFromBody = body?.venueId || body?.venue_id;

    if (!venueIdFromBody) {
      return NextResponse.json(
        {
          ok: false,
          error: "venueId is required",
        },
        { status: 400 }
      );
    }

    // Use venueId from auth check or body
    const finalVenueId = venueId || venueIdFromBody;

    const supabase = await createClient();

    let totalOrdersProcessed = 0;
    let totalTicketsCreated = 0;
    const results = [];

    // Process different scopes
    const scopes = ["live", "today"];

    for (const scope of scopes) {

      // First, ensure KDS stations exist for this venue
      const { data: existingStations } = await supabase
        .from("kds_stations")
        .select("id, station_type")
        .eq("venue_id", finalVenueId)
        .eq("is_active", true);

      if (!existingStations || existingStations.length === 0) {
        logger.debug("[KDS BACKFILL ALL] No stations found, creating default stations for venue", {
          extra: { value: venueId },
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
          .select("id, station_type")
          .eq("venue_id", finalVenueId)
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
        existingStations.find((s: KDSStation) => s.station_type === "expo") || existingStations[0];

      if (!expoStation) {
        throw new Error("No KDS station available");
      }

      // Build query for orders based on scope
      let query = supabase
        .from("orders")
        .select(
          "id, venue_id, table_number, table_id, items, order_status, payment_status, created_at"
        )
        .eq("venue_id", finalVenueId)
        .in("payment_status", ["PAID", "UNPAID"]) // Only active orders
        .in("order_status", ["PLACED", "IN_PREP", "READY"]) // Only orders that need preparation
        .order("created_at", { ascending: false });

      // Apply time filtering based on scope
      if (scope === "live") {
        // Live orders: last 30 minutes only
        const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
        query = query.gte("created_at", thirtyMinutesAgo.toISOString());
      } else if (scope === "today") {
        // Today's orders: from start of today until now
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        query = query.gte("created_at", todayStart.toISOString());
      }

      const { data: orders, error: ordersError } = await query;

      if (ordersError) {
        logger.error(`[KDS BACKFILL ALL] Error fetching orders for ${scope}:`, {
          error: ordersError.message,
        });
        results.push({ scope, error: ordersError.message });
        continue;
      }

      if (!orders || orders.length === 0) {
        results.push({ scope, orders_processed: 0, tickets_created: 0 });
        continue;
      }


      let scopeOrdersProcessed = 0;
      let scopeTicketsCreated = 0;
      const scopeErrors: string[] = [];

      // Process each order
      for (const order of orders) {
        try {
          // Check if this order already has KDS tickets
          const { data: existingTickets } = await supabase
            .from("kds_tickets")
            .select("id")
            .eq("order_id", order.id)
            .limit(1);

          if (existingTickets && existingTickets.length > 0) {
            continue;
          }

          // Create tickets for each order item
          const items = Array.isArray(order.items) ? order.items : [];

          for (const item of items) {
            const ticketData = {
              venue_id: order.venue_id,
              order_id: order.id,
              station_id: expoStation.id,
              item_name: item.item_name || "Unknown Item",
              quantity: parseInt(item.quantity) || 1,
              special_instructions: item.specialInstructions || null,
              table_number: order.table_number,
              table_label: order.table_id || order.table_number?.toString() || "Unknown",
              status: "new",
            };

            const { error: ticketError } = await supabase
              .from("kds_tickets")
              .insert(ticketData);

            if (ticketError) {
              logger.error("[KDS BACKFILL ALL] Failed to create ticket for item:", {
                error: { item, context: ticketError.message },
              });
              scopeErrors.push(
                `Failed to create ticket for order ${order.id}: ${ticketError.message}`
              );
              continue;
            }

            scopeTicketsCreated++;
          }

          scopeOrdersProcessed++;
          logger.debug(
            `[KDS BACKFILL ALL] Processed order ${order.id} with ${items.length} items for ${scope}`
          );
        } catch (_error) {
          logger.error(`[KDS BACKFILL ALL] Error processing order ${order.id} for ${scope}:`, {
            error: _error instanceof Error ? _error.message : "Unknown _error",
          });
          scopeErrors.push(
            `Error processing order ${order.id}: ${_error instanceof Error ? _error.message : "Unknown _error"}`
          );
        }
      }

      totalOrdersProcessed += scopeOrdersProcessed;
      totalTicketsCreated += scopeTicketsCreated;

      results.push({
        scope,
        orders_processed: scopeOrdersProcessed,
        tickets_created: scopeTicketsCreated,
        errors: scopeErrors.length > 0 ? scopeErrors : undefined,
      });

      logger.debug(
        `[KDS BACKFILL ALL] Completed ${scope} scope: ${scopeOrdersProcessed} orders, ${scopeTicketsCreated} tickets`
      );
    }

    logger.debug("[KDS BACKFILL ALL] Comprehensive backfill completed:", {
      totalOrdersProcessed,
      totalTicketsCreated,
      results,
    });

    return NextResponse.json({
      ok: true,
      message: "Comprehensive KDS backfill completed",
      total_orders_processed: totalOrdersProcessed,
      total_tickets_created: totalTicketsCreated,
      results,
    });
  } catch (_error) {
    logger.error("[KDS BACKFILL ALL] Unexpected error:", {
      error: _error instanceof Error ? _error.message : "Unknown _error",
    });
    return NextResponse.json(
      {
        ok: false,
        error: _error instanceof Error ? _error.message : "Comprehensive backfill failed",
      },
      { status: 500 }
    );
  }
}
