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
  let venueId = 'unknown';
  
  try {
    console.log('🍳 [KDS TICKETS] ========================================');
    console.log('🍳 [KDS TICKETS] GET Request received');
    console.log('🍳 [KDS TICKETS] Timestamp:', new Date().toISOString());
    console.log('🍳 [KDS TICKETS] Request URL:', req.url);
    
    const { searchParams } = new URL(req.url);
    venueId = searchParams.get("venueId") || 'none';
    const stationId = searchParams.get("stationId");
    const status = searchParams.get("status");

    console.log('🍳 [KDS TICKETS] Venue ID:', venueId);
    console.log('🍳 [KDS TICKETS] Station ID:', stationId || 'all');
    console.log('🍳 [KDS TICKETS] Status Filter:', status || 'all except bumped');
    console.log('🍳 [KDS TICKETS] Has Auth Header:', !!req.headers.get("authorization"));

    logger.debug("[KDS TICKETS] GET Request:", {
      venueId,
      stationId,
      status,
      hasAuthHeader: !!req.headers.get("authorization"),
    });

    if (!venueId || venueId === 'none') {
      console.error("❌ [KDS TICKETS] No venueId provided");
      return NextResponse.json({ ok: false, error: "venueId is required" }, { status: 400 });
    }

    // Authenticate using Authorization header
    console.log('🔐 [KDS TICKETS] Importing auth modules...');
    const { authenticateRequest, verifyVenueAccess } = await import("@/lib/api-auth");
    console.log('🔐 [KDS TICKETS] Authenticating request...');
    const auth = await authenticateRequest(req);

    console.log('🔐 [KDS TICKETS] Auth result:', {
      success: auth.success,
      hasUser: !!auth.user,
      hasSupabase: !!auth.supabase,
      error: auth.error || 'none'
    });

    if (!auth.success || !auth.user || !auth.supabase) {
      console.error("❌ [KDS TICKETS] Authentication failed:", auth.error);
      return NextResponse.json({ ok: false, error: auth.error }, { status: 401 });
    }

    console.log('✅ [KDS TICKETS] Authenticated:', { userId: auth.user.id });

    const { user, supabase } = auth;

    // Verify venue access
    console.log('🔐 [KDS TICKETS] Verifying venue access...');
    const access = await verifyVenueAccess(supabase, user.id, venueId);
    
    console.log('🔐 [KDS TICKETS] Venue access result:', {
      hasAccess: access.hasAccess,
      role: access.role
    });
    
    if (!access.hasAccess) {
      console.error("❌ [KDS TICKETS] No venue access:", { userId: user.id, venueId });
      logger.warn("[KDS TICKETS] ❌ No venue access:", { userId: user.id, venueId });
      return NextResponse.json({ ok: false, error: "Access denied" }, { status: 403 });
    }

    console.log('✅ [KDS TICKETS] Venue access verified:', { role: access.role });

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
    console.log('🔄 [KDS TICKETS] Running auto-backfill...');
    try {
      await autoBackfillMissingTickets(venueId);
      console.log('✅ [KDS TICKETS] Auto-backfill completed');
    } catch (backfillError) {
      console.warn('⚠️ [KDS TICKETS] Auto-backfill failed (non-critical):', backfillError);
      logger.warn("[KDS] Auto-backfill failed (non-critical):", { value: backfillError });
      // Don't fail the request if backfill fails
    }

    // Fetch tickets after potential backfill
    console.log('📋 [KDS TICKETS] Executing tickets query...');
    const { data: finalTickets, error: finalError } = await query;

    console.log('📋 [KDS TICKETS] Query result:', {
      ticketCount: finalTickets?.length || 0,
      hasError: !!finalError,
      errorMessage: finalError?.message || 'none'
    });

    if (finalError) {
      console.error('❌ [KDS TICKETS] Error fetching tickets:', finalError);
      logger.error("[KDS] Error fetching tickets after backfill:", { value: finalError });
      return NextResponse.json({ ok: false, error: finalError.message }, { status: 500 });
    }

    const duration = Date.now() - startTime;
    console.log(`⏱️ [KDS TICKETS] Request completed in ${duration}ms`);
    console.log('✅ [KDS TICKETS SUCCESS] ========================================');

    return NextResponse.json({
      ok: true,
      tickets: finalTickets || [],
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('❌❌❌ [KDS TICKETS] UNEXPECTED ERROR ❌❌❌');
    console.error('❌ [KDS TICKETS] Venue ID:', venueId);
    console.error('❌ [KDS TICKETS] Error Type:', error?.constructor?.name);
    console.error('❌ [KDS TICKETS] Error Message:', error instanceof Error ? error.message : String(error));
    console.error('❌ [KDS TICKETS] Error Stack:', error instanceof Error ? error.stack : 'No stack trace');
    console.error('❌ [KDS TICKETS] Full Error:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
    console.error(`❌ [KDS TICKETS] Failed after ${duration}ms`);
    console.error('❌❌❌ [KDS TICKETS END] ========================================');
    
    logger.error("[KDS] Unexpected error:", {
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
      venueId
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

    // Update main order status based on ticket status
    if (ticket?.order_id) {
      let newOrderStatus: string | null = null;
      
      switch (status) {
        case "in_progress":
          // When kitchen starts preparing ANY item, order is IN_PREP
          newOrderStatus = "IN_PREP";
          console.info(`🔥 [KDS] Ticket ${ticketId} → in_progress, updating order ${ticket.order_id} → IN_PREP`);
          break;
        case "ready":
          // Don't update to READY yet - only when ALL tickets are ready (bump does this)
          console.info(`✅ [KDS] Ticket ${ticketId} → ready (order status unchanged until bump)`);
          break;
        case "bumped":
          // This case is handled by bulk-update route
          break;
      }
      
      if (newOrderStatus) {
        const { error: orderUpdateError } = await supabase
          .from("orders")
          .update({
            order_status: newOrderStatus,
            updated_at: now,
          })
          .eq("id", ticket.order_id);

        if (orderUpdateError) {
          logger.error("[KDS] Error updating order status:", { 
            ticketId,
            orderId: ticket.order_id,
            newStatus: newOrderStatus,
            error: orderUpdateError.message
          });
        } else {
          console.info(`✅ [KDS] Order ${ticket.order_id} status updated to ${newOrderStatus}`);
        }
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
