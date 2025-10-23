import { NextResponse } from "next/server";
import { createAdminClient, createServerSupabase } from "@/lib/supabase";
import { logger } from "@/lib/logger";

// TODO: Remaining GET and PATCH methods still use createServerSupabase (cookies)
// Need to update to use: import { authenticateRequest, verifyVenueAccess } from "@/lib/api-auth";

// Function to automatically backfill missing KDS tickets for orders
async function autoBackfillMissingTickets(venueId: string) {
  try {
    const supabaseAdmin = createAdminClient();

    logger.debug("[KDS AUTO-BACKFILL] Checking for orders without KDS tickets...");

    // Get today's orders that should have KDS tickets but don't
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const { data: ordersWithoutTickets } = await supabaseAdmin
      .from("orders")
      .select("id")
      .eq("venue_id", venueId)
      .in("payment_status", ["PAID", "UNPAID"])
      .in("order_status", ["PLACED", "IN_PREP", "READY"])
      .gte("created_at", todayStart.toISOString())
      .not("id", "in", `(SELECT DISTINCT order_id FROM kds_tickets WHERE venue_id = '${venueId}')`);

    if (!ordersWithoutTickets || ordersWithoutTickets.length === 0) {
      logger.debug("[KDS AUTO-BACKFILL] No orders found without KDS tickets");
      return;
    }

    logger.debug(
      `[KDS AUTO-BACKFILL] Found ${ordersWithoutTickets.length} orders without KDS tickets, creating tickets...`
    );

    // Get expo station for this venue
    const { data: expoStation } = await supabaseAdmin
      .from("kds_stations")
      .select("id")
      .eq("venue_id", venueId)
      .eq("station_type", "expo")
      .eq("is_active", true)
      .limit(1)
      .single();

    if (!expoStation) {
      logger.debug("[KDS AUTO-BACKFILL] No expo station found, skipping backfill");
      return;
    }

    // Create tickets for orders without them
    for (const orderRef of ordersWithoutTickets) {
      const { data: order } = await supabaseAdmin
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

        await supabaseAdmin.from("kds_tickets").insert(ticketData);
      }

      logger.debug(`[KDS AUTO-BACKFILL] Created tickets for order ${order.id}`);
    }

    logger.debug(
      `[KDS AUTO-BACKFILL] Auto-backfill completed for ${ordersWithoutTickets.length} orders`
    );
  } catch (error) {
    logger.error("[KDS AUTO-BACKFILL] Error during auto-backfill:", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    throw error;
  }
}

// GET - Fetch KDS tickets for a venue or station
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const venueId = searchParams.get("venueId");
    const stationId = searchParams.get("stationId");
    const status = searchParams.get("status"); // Optional filter

    if (!venueId) {
      return NextResponse.json({ ok: false, error: "venueId is required" }, { status: 400 });
    }

    const supabase = await createServerSupabase();

    // Verify user has access to this venue (use getSession to avoid refresh token errors)
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();
    const user = session?.user;

    if (sessionError || !user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    // Verify user owns or has staff access to this venue
    const { data: venueAccess } = await supabase
      .from("venues")
      .select("venue_id")
      .eq("venue_id", venueId)
      .eq("owner_user_id", user.id)
      .maybeSingle();

    const { data: staffAccess } = await supabase
      .from("user_venue_roles")
      .select("role")
      .eq("venue_id", venueId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!venueAccess && !staffAccess) {
      logger.warn("[KDS TICKETS] User does not have access to venue:", {
        userId: user.id,
        venueId,
      });
      return NextResponse.json(
        { ok: false, error: "Access denied to this venue" },
        { status: 403 }
      );
    }

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
  } catch (error) {
    logger.error("[KDS] Unexpected error:", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Internal server error" },
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

    const supabase = await createServerSupabase();

    // Verify user has access
    const {
      data: { session },
      error: userError,
    } = await supabase.auth.getSession();
    const user = session?.user;
    if (userError || !user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

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

    // If bumping a ticket, also update the main order status to SERVED
    if (status === "bumped" && ticket?.order_id) {
      const { error: orderUpdateError } = await supabase
        .from("orders")
        .update({
          order_status: "SERVED",
          updated_at: now,
        })
        .eq("id", ticket.order_id);

      if (orderUpdateError) {
        logger.error("[KDS] Error updating order status after bump:", { value: orderUpdateError });
        // Don't fail the request, just log the error
      } else {
        logger.debug(`[KDS] Updated order ${ticket.order_id} status to SERVED after bump`);
      }
    }

    return NextResponse.json({
      ok: true,
      ticket,
    });
  } catch (error) {
    logger.error("[KDS] Unexpected error:", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
