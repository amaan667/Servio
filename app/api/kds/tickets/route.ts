import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { logger } from "@/lib/logger";

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
  const startTime = Date.now();
  let venueId = "unknown";

  try {
    console.info("🍳 [KDS TICKETS] ========================================");
    console.info("🍳 [KDS TICKETS] GET Request received");
    console.info("🍳 [KDS TICKETS] Timestamp:", new Date().toISOString());
    console.info("🍳 [KDS TICKETS] Request URL:", req.url);

    const { searchParams } = new URL(req.url);
    venueId = searchParams.get("venueId") || "none";
    const stationId = searchParams.get("stationId");
    const status = searchParams.get("status");

    console.info("🍳 [KDS TICKETS] Venue ID:", venueId);
    console.info("🍳 [KDS TICKETS] Station ID:", stationId || "all");
    console.info("🍳 [KDS TICKETS] Status Filter:", status || "all except bumped");
    console.info("🍳 [KDS TICKETS] Has Auth Header:", !!req.headers.get("authorization"));

    logger.debug("[KDS TICKETS] GET Request:", {
      venueId,
      stationId,
      status,
      hasAuthHeader: !!req.headers.get("authorization"),
    });

    if (!venueId || venueId === "none") {
      console.error("❌ [KDS TICKETS] No venueId provided");
      return NextResponse.json({ ok: false, error: "venueId is required" }, { status: 400 });
    }

    // Use admin client - no authentication required for KDS feature
    const supabase = createAdminClient();
    console.info("✅ [KDS TICKETS] Using admin client (no auth required)");

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
    console.info("🔄 [KDS TICKETS] Running auto-backfill...");
    try {
      await autoBackfillMissingTickets(venueId);
      console.info("✅ [KDS TICKETS] Auto-backfill completed");
    } catch (backfillError) {
      console.warn("⚠️  [KDS TICKETS] Auto-backfill failed (non-critical):", backfillError);
      logger.warn("[KDS] Auto-backfill failed (non-critical):", { value: backfillError });
      // Don't fail the request if backfill fails
    }

    // Fetch tickets after potential backfill
    console.info("📋 [KDS TICKETS] Executing tickets query...");
    const { data: finalTickets, error: finalError } = await query;

    console.info("📋 [KDS TICKETS] Query result:", {
      ticketCount: finalTickets?.length || 0,
      hasError: !!finalError,
      errorMessage: finalError?.message || "none",
    });

    if (finalError) {
      console.error("❌ [KDS TICKETS] Error fetching tickets:", finalError);
      logger.error("[KDS] Error fetching tickets after backfill:", { value: finalError });
      return NextResponse.json({ ok: false, error: finalError.message }, { status: 500 });
    }

    const duration = Date.now() - startTime;
    console.info(`⏱️ [KDS TICKETS] Request completed in ${duration}ms`);
    console.info("✅ [KDS TICKETS SUCCESS] ========================================");

    return NextResponse.json({
      ok: true,
      tickets: finalTickets || [],
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error("❌❌❌ [KDS TICKETS] UNEXPECTED ERROR ❌❌❌");
    console.error("❌ [KDS TICKETS] Venue ID:", venueId);
    console.error("❌ [KDS TICKETS] Error Type:", error?.constructor?.name);
    console.error(
      "❌ [KDS TICKETS] Error Message:",
      error instanceof Error ? error.message : String(error)
    );
    console.error(
      "❌ [KDS TICKETS] Error Stack:",
      error instanceof Error ? error.stack : "No stack trace"
    );
    console.error(
      "❌ [KDS TICKETS] Full Error:",
      JSON.stringify(error, Object.getOwnPropertyNames(error), 2)
    );
    console.error(`❌ [KDS TICKETS] Failed after ${duration}ms`);
    console.error("❌❌❌ [KDS TICKETS END] ========================================");

    logger.error("[KDS] Unexpected error:", {
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
      venueId,
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
    console.info("🔧 [KDS TICKETS PATCH] Update ticket status request received");
    const body = await req.json();
    const { ticketId, status } = body;

    console.info("🔧 [KDS TICKETS PATCH] Request body:", { ticketId, status });

    if (!ticketId || !status) {
      console.error("❌ [KDS TICKETS PATCH] Missing required fields");
      return NextResponse.json(
        { ok: false, error: "ticketId and status are required" },
        { status: 400 }
      );
    }

    const validStatuses = ["new", "in_progress", "ready", "bumped"];
    if (!validStatuses.includes(status)) {
      console.error("❌ [KDS TICKETS PATCH] Invalid status:", status);
      return NextResponse.json(
        { ok: false, error: `Invalid status. Must be one of: ${validStatuses.join(", ")}` },
        { status: 400 }
      );
    }

    // Use admin client - no authentication required for KDS feature
    const { createAdminClient } = await import("@/lib/supabase");
    const supabase = createAdminClient();
    console.info("✅ [KDS TICKETS PATCH] Using admin client (no auth required)");

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
      console.info(
        `✅ [KDS] Ticket ${ticketId} → ready (order stays IN_PREP until all items bumped)`
      );
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
