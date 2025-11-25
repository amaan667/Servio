import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";
import { logger } from "@/lib/logger";
import { requireVenueAccessForAPI } from "@/lib/auth/api";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";

// Function to automatically backfill missing KDS tickets for orders
async function autoBackfillMissingTickets(venueId: string) {
  try {
    const supabase = await createClient();


    // Get today's orders that should have KDS tickets but don't
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const { data: ordersWithoutTickets } = await supabase
      .from("orders")
      .select("id")
      .eq("venue_id", venueId)
      .in("payment_status", ["PAID", "UNPAID"])
      .in("order_status", ["PLACED", "IN_PREP", "READY"])
      .gte("created_at", todayStart.toISOString())
      .not("id", "in", `(SELECT DISTINCT order_id FROM kds_tickets WHERE venue_id = '${venueId}')`);

    if (!ordersWithoutTickets || ordersWithoutTickets.length === 0) {
      return;
    }

    logger.debug(
      `[KDS AUTO-BACKFILL] Found ${ordersWithoutTickets.length} orders without KDS tickets, creating tickets...`
    );

    // Get expo station for this venue
    const { data: expoStation } = await supabase
      .from("kds_stations")
      .select("id")
      .eq("venue_id", venueId)
      .eq("station_type", "expo")
      .eq("is_active", true)
      .limit(1)
      .single();

    if (!expoStation) {
      return;
    }

    // Create tickets for orders without them
    for (const orderRef of ordersWithoutTickets) {
      const { data: order } = await supabase
        .from("orders")
        .select("id, venue_id, table_number, table_id, items")
        .eq("id", orderRef.id)
        .single();

      if (!order || !Array.isArray(order.items)) continue;

      // Create tickets for each item
      for (const item of order.items) {
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

        await supabase.from("kds_tickets").insert(ticketData);
      }

    }

    logger.debug(
      `[KDS AUTO-BACKFILL] Auto-backfill completed for ${ordersWithoutTickets.length} orders`
    );
  } catch (_error) {
    logger.error("[KDS AUTO-BACKFILL] Error during auto-backfill:", {
      error: _error instanceof Error ? _error.message : "Unknown _error",
    });
    throw _error;
  }
}

// GET - Fetch KDS tickets for a venue or station
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const venueId = searchParams.get("venueId") || searchParams.get("venue_id");
    const stationId = searchParams.get("stationId");
    const status = searchParams.get("status");

    if (!venueId) {
      return NextResponse.json({ ok: false, error: "venueId is required" }, { status: 400 });
    }

    // CRITICAL: Authentication and venue access verification
    const venueAccessResult = await requireVenueAccessForAPI(venueId);
    if (!venueAccessResult.success) {
      return venueAccessResult.response;
    }

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

    logger.debug("[KDS TICKETS] GET Request:", {
      venueId,
      stationId,
      status,
      hasAuthHeader: !!req.headers.get("authorization"),
    });

    // Use admin client - no authentication required for KDS feature
    const supabase = await createClient();

    // Build query
    let query = supabase
      .from("kds_tickets")
      .select(
        `
        *,
        kds_stations (
          id,
          station_name,
          station_type,
          color_code
        ),
        orders (
          id,
          customer_name,
          order_status,
          payment_status
        )
      `
      )
      .eq("venue_id", venueId)
      .order("created_at", { ascending: true });

    // Filter by station if provided
    if (stationId) {
      query = query.eq("station_id", stationId);
    }

    // Filter by status if provided
    if (status) {
      query = query.eq("status", status);
    } else {
      // By default, exclude bumped tickets (they're done)
      query = query.neq("status", "bumped");
    }

    // Auto-backfill: Check if we have orders without KDS tickets and create them
    try {
      await autoBackfillMissingTickets(venueId);
    } catch (backfillError) {
      logger.warn("[KDS] Auto-backfill failed (non-critical):", { value: backfillError });
      // Don't fail the request if backfill fails
    }

    // Fetch tickets after potential backfill
    const { data: finalTickets, error: finalError } = await query;

    if (finalError) {
      logger.error("[KDS] Error fetching tickets after backfill:", { value: finalError });
      return NextResponse.json({ ok: false, error: finalError.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      tickets: finalTickets || [],
    });
  } catch (_error) {
    logger.error("[KDS] Unexpected error:", {
      error: _error instanceof Error ? _error.message : "Unknown _error",
      stack: _error instanceof Error ? _error.stack : undefined,
    });
    return NextResponse.json(
      { ok: false, error: _error instanceof Error ? _error.message : "Internal server _error" },
      { status: 500 }
    );
  }
}

// PATCH - Update ticket status
export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { ticketId, status } = body;

    if (!ticketId || !status) {
      return NextResponse.json(
        { ok: false, error: "ticketId and status are required" },
        { status: 400 }
      );
    }

    const validStatuses = ["new", "in_progress", "ready", "bumped"];
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { ok: false, error: `Invalid status. Must be one of: ${validStatuses.join(", ")}` },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Build update object with timestamp
    const updateData: {
      status: string;
      started_at?: string;
      ready_at?: string;
      bumped_at?: string;
    } = { status };
    const now = new Date().toISOString();

    switch (status) {
      case "in_progress":
        updateData.started_at = now;
        break;
      case "ready":
        updateData.ready_at = now;
        break;
      case "bumped":
        updateData.bumped_at = now;
        break;
    }

    const { data: ticket, error } = await supabase
      .from("kds_tickets")
      .update(updateData)
      .eq("id", ticketId)
      .select(
        `
        *,
        kds_stations (
          id,
          station_name,
          station_type,
          color_code
        ),
        orders (
          id,
          customer_name,
          order_status
        )
      `
      )
      .single();

    if (error) {
      logger.error("[KDS] Error updating ticket:", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    // Orders now start as IN_PREP, so ticket status changes don't affect order status
    // until ALL tickets are bumped (handled in bulk-update route)
    if (ticket?.order_id && status === "ready") {
      /* Empty */
    }

    return NextResponse.json({
      ok: true,
      ticket,
    });
  } catch (_error) {
    logger.error("[KDS] Unexpected error:", {
      error: _error instanceof Error ? _error.message : "Unknown _error",
    });
    return NextResponse.json(
      { ok: false, error: _error instanceof Error ? _error.message : "Internal server _error" },
      { status: 500 }
    );
  }
}
