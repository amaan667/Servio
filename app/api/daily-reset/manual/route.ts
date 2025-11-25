import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { logger } from "@/lib/logger";
import { requireVenueAccessForAPI } from '@/lib/auth/api';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';

export async function POST(_request: NextRequest) {
  try {
    const req = _request;

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

    const body = await _request.json();
    const finalVenueId = venueId || body.venueId;

    if (!finalVenueId) {
      return NextResponse.json({ error: "Venue ID is required" }, { status: 400 });
    }

    // Check if service role key is available
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      logger.error("🔄 [MANUAL DAILY RESET] SUPABASE_SERVICE_ROLE_KEY not found");
      return NextResponse.json({ error: "Service role key not configured" }, { status: 500 });
    }

    const supabase = await createAdminClient();

    // Check if venue exists
    const { data: venue, error: venueError } = await supabase
      .from("venues")
      .select("venue_id, venue_name")
      .eq("venue_id", venueId)
      .single();

    if (venueError) {
      logger.error("🔄 [MANUAL DAILY RESET] Error fetching venue:", {
        error: venueError.message || "Unknown error",
      });
      return NextResponse.json({ error: `Database error: ${venueError.message}` }, { status: 500 });
    }

    if (!venue) {
      return NextResponse.json({ error: "Venue not found" }, { status: 404 });
    }

    // Check if there are unknown recent orders (within last 2 hours) - if so, warn user
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const { error: recentOrdersError } = await supabase
      .from("orders")
      .select("id, created_at")
      .eq("venue_id", venueId)
      .gte("created_at", twoHoursAgo)
      .limit(1);

    if (recentOrdersError) {
      logger.error("🔄 [MANUAL DAILY RESET] Error checking recent orders:", {
        error: recentOrdersError.message || "Unknown error",
      });
      // Continue with reset if we can't check
    }

    // Step 1: Complete all active orders (mark as COMPLETED)
    const { data: activeOrders, error: activeOrdersError } = await supabase
      .from("orders")
      .select("id, order_status, table_number")
      .eq("venue_id", venueId)
      .in("order_status", ["PLACED", "ACCEPTED", "IN_PREP", "READY", "SERVING"]);

    if (activeOrdersError) {
      logger.error("🔄 [MANUAL DAILY RESET] Error fetching active orders:", {
        error: activeOrdersError.message || "Unknown error",
      });
      return NextResponse.json({ error: "Failed to fetch active orders" }, { status: 500 });
    }

    if (activeOrders && activeOrders.length > 0) {
      const { error: completeOrdersError } = await supabase
        .from("orders")
        .update({
          order_status: "COMPLETED",
          updated_at: new Date().toISOString(),
        })
        .eq("venue_id", finalVenueId)
        .in("order_status", ["PLACED", "ACCEPTED", "IN_PREP", "READY", "SERVING"]);

      if (completeOrdersError) {
        logger.error("🔄 [MANUAL DAILY RESET] Error completing orders:", {
          error: completeOrdersError.message || "Unknown error",
        });
        return NextResponse.json({ error: "Failed to complete active orders" }, { status: 500 });
      }
    }

    // Step 2: Cancel all active reservations
    const { data: activeReservations, error: activeReservationsError } = await supabase
      .from("reservations")
      .select("id, status")
      .eq("venue_id", venueId)
      .eq("status", "BOOKED");

    if (activeReservationsError) {
      logger.error("🔄 [MANUAL DAILY RESET] Error fetching active reservations:", {
        error: activeReservationsError.message || "Unknown error",
      });
      return NextResponse.json({ error: "Failed to fetch active reservations" }, { status: 500 });
    }

    if (activeReservations && activeReservations.length > 0) {
      const { error: cancelReservationsError } = await supabase
        .from("reservations")
        .update({
          status: "CANCELLED",
          updated_at: new Date().toISOString(),
        })
        .eq("venue_id", finalVenueId)
        .eq("status", "BOOKED");

      if (cancelReservationsError) {
        logger.error("🔄 [MANUAL DAILY RESET] Error canceling reservations:", {
          error: cancelReservationsError.message || "Unknown error",
        });
        return NextResponse.json(
          { error: "Failed to cancel active reservations" },
          { status: 500 }
        );
      }
    }

    // Step 3: Delete all tables for complete reset
    const { data: tables, error: tablesError } = await supabase
      .from("tables")
      .select("id, label")
      .eq("venue_id", venueId);

    if (tablesError) {
      logger.error("🔄 [MANUAL DAILY RESET] Error fetching tables:", {
        error: tablesError.message || "Unknown error",
      });
      return NextResponse.json({ error: "Failed to fetch tables" }, { status: 500 });
    }

    if (tables && tables.length > 0) {
      // Delete all table sessions first (if they exist)
      const { error: deleteSessionsError } = await supabase
        .from("table_sessions")
        .delete()
        .eq("venue_id", finalVenueId);

      if (deleteSessionsError) {
        logger.warn("🔄 [MANUAL DAILY RESET] Warning clearing table sessions:", {
          error: deleteSessionsError.message || "Unknown error",
        });
        // Don't fail for this, continue
      }

      // Delete all tables for the venue
      const { error: deleteTablesError } = await supabase
        .from("tables")
        .delete()
        .eq("venue_id", finalVenueId);

      if (deleteTablesError) {
        logger.error("🔄 [MANUAL DAILY RESET] Error deleting tables:", {
          error: deleteTablesError.message || "Unknown error",
        });
        return NextResponse.json({ error: "Failed to delete tables" }, { status: 500 });
      }
    }

    // Step 4: Clear unknown table runtime state
    const { error: clearRuntimeError } = await supabase
      .from("table_runtime_state")
      .delete()
      .eq("venue_id", venueId);

    if (clearRuntimeError) {
      logger.error("🔄 [MANUAL DAILY RESET] Error clearing runtime state:", {
        error: clearRuntimeError.message || "Unknown error",
      });
      // Don't fail the entire operation for this
      logger.warn("🔄 [MANUAL DAILY RESET] Continuing despite runtime state clear error");
    }

    // Step 5: Record the manual reset in the log (but don't prevent future resets)
    const today = new Date();
    const todayString = today.toISOString().split("T")[0]; // YYYY-MM-DD format

    const { error: logError } = await supabase.from("daily_reset_log").upsert(
      {
        venue_id: finalVenueId,
        reset_date: todayString,
        reset_timestamp: new Date().toISOString(),
        completed_orders: activeOrders?.length || 0,
        canceled_reservations: activeReservations?.length || 0,
        reset_tables: tables?.length || 0,
      },
      {
        onConflict: "venue_id,reset_date",
      }
    );

    if (logError) {
      logger.error("🔄 [MANUAL DAILY RESET] Error logging reset:", {
        error: logError.message || "Unknown error",
      });
      // Don't fail the operation for this
      logger.warn("🔄 [MANUAL DAILY RESET] Continuing despite log error");
    }

    return NextResponse.json({
      success: true,
      message: "Manual daily reset completed successfully",
      summary: {
        venueId: finalVenueId,
        venueName: venue.venue_name,
        completedOrders: activeOrders?.length || 0,
        canceledReservations: activeReservations?.length || 0,
        deletedTables: tables?.length || 0,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (_error) {
    logger.error("🔄 [MANUAL DAILY RESET] Error in manual daily reset:", {
      error: _error instanceof Error ? _error.message : "Unknown _error",
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
