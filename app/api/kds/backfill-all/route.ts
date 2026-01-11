import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";

import { withUnifiedAuth } from "@/lib/auth/unified-auth";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { createKDSTicketsWithAI } from "@/lib/orders/kds-tickets-unified";

export const runtime = "nodejs";

interface KDSStation {
  id: string;
  station_type: string;
  [key: string]: unknown;
}

export const POST = withUnifiedAuth(async (req: NextRequest, context) => {
  try {
    // CRITICAL: Rate limiting
    const rateLimitResult = await rateLimit(req, RATE_LIMITS.GENERAL);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        {
          error: "Too many requests",
          message: `Rate limit exceeded. Try again in ${Math.ceil((rateLimitResult.reset - Date.now()) / 1000)} seconds.`,
        },
        { status: 429 }
      );
    }

    const body = await req.json();
    const venueIdFromBody = body?.venueId || body?.venue_id;

    // Use venueId from context or body
    const finalVenueId = context.venueId || venueIdFromBody;

    if (!finalVenueId) {
      return NextResponse.json(
        {
          ok: false,
          error: "venueId is required",
        },
        { status: 400 }
      );
    }

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
              venue_id: finalVenueId,
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

      // Stations will be ensured by createKDSTicketsWithAI

      // Build query for orders based on scope
      let query = supabase
        .from("orders")
        .select(
          "id, venue_id, table_number, table_id, items, order_status, payment_status, created_at, customer_name"
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

          // Create tickets using unified AI-based function
          const items = Array.isArray(order.items) ? order.items : [];

          try {
            await createKDSTicketsWithAI(supabase, {
              id: order.id,
              venue_id: order.venue_id,
              items: items,
              customer_name: order.customer_name,
              table_number: order.table_number,
              table_id: order.table_id,
            });
            scopeTicketsCreated += items.length;
          } catch (ticketError) {

            scopeErrors.push(
              `Failed to create tickets for order ${order.id}: ${ticketError instanceof Error ? ticketError.message : "Unknown error"}`
            );
            continue;
          }

          scopeOrdersProcessed++;

        } catch (_error) {

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

    }

    return NextResponse.json({
      ok: true,
      message: "Comprehensive KDS backfill completed",
      total_orders_processed: totalOrdersProcessed,
      total_tickets_created: totalTicketsCreated,
      results,
    });
  } catch (_error) {

    return NextResponse.json(
      {
        ok: false,
        error: _error instanceof Error ? _error.message : "Comprehensive backfill failed",
      },
      { status: 500 }
    );
  }
});
