import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";
import { logger } from "@/lib/logger";
import { requireVenueAccessForAPI } from "@/lib/auth/api";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const venueId = body?.venueId || body?.venue_id;
    const force = body?.force || false;

    if (!venueId) {
      return NextResponse.json({ error: "Venue ID is required" }, { status: 400 });
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

    const supabase = await createClient();

    // Check if venue exists
    const { data: venue, error: venueError } = await supabase
      .from("venues")
      .select("venue_id, venue_name")
      .eq("venue_id", venueId)
      .single();

    if (venueError || !venue) {
      return NextResponse.json({ error: "Venue not found" }, { status: 404 });
    }

    // Step 1: Complete all active orders (mark as COMPLETED)
    const { data: activeOrders, error: activeOrdersError } = await supabase
      .from("orders")
      .select("id, order_status, table_number")
      .eq("venue_id", venueId)
      .in("order_status", ["PLACED", "ACCEPTED", "IN_PREP", "READY", "SERVING"]);

    if (activeOrdersError) {
      logger.error("🔄 [DAILY RESET] Error fetching active orders:", {
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
        .eq("venue_id", venueId)
        .in("order_status", ["PLACED", "ACCEPTED", "IN_PREP", "READY", "SERVING"]);

      if (completeOrdersError) {
        logger.error("🔄 [DAILY RESET] Error completing orders:", {
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
      logger.error("🔄 [DAILY RESET] Error fetching active reservations:", {
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
        .eq("venue_id", venueId)
        .eq("status", "BOOKED");

      if (cancelReservationsError) {
        logger.error("🔄 [DAILY RESET] Error canceling reservations:", {
          error: cancelReservationsError.message || "Unknown error",
        });
        return NextResponse.json(
          { error: "Failed to cancel active reservations" },
          { status: 500 }
        );
      }
    }

    // Step 3: Delete all tables for the venue (complete reset)
    const { data: tables, error: tablesError } = await supabase
      .from("tables")
      .select("id, label")
      .eq("venue_id", venueId);

    if (tablesError) {
      logger.error("🔄 [DAILY RESET] Error fetching tables:", {
        error: tablesError.message || "Unknown error",
      });
      return NextResponse.json({ error: "Failed to fetch tables" }, { status: 500 });
    }

    if (tables && tables.length > 0) {
      // Delete all table sessions first (if they exist)
      const { error: deleteSessionsError } = await supabase
        .from("table_sessions")
        .delete()
        .eq("venue_id", venueId);

      if (deleteSessionsError) {
        logger.warn("🔄 [DAILY RESET] Warning clearing table sessions:", {
          error: deleteSessionsError.message || "Unknown error",
        });
        // Don't fail for this, continue
      }

      // Delete all tables for the venue
      const { error: deleteTablesError } = await supabase
        .from("tables")
        .delete()
        .eq("venue_id", venueId);

      if (deleteTablesError) {
        logger.error("🔄 [DAILY RESET] Error deleting tables:", {
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
      logger.error("🔄 [DAILY RESET] Error clearing runtime state:", {
        error: clearRuntimeError.message || "Unknown error",
      });
      // Don't fail the entire operation for this
      logger.warn("🔄 [DAILY RESET] Continuing despite runtime state clear error");
    }

    // Step 5: If force is true, also delete ALL orders for this venue
    if (force) {
      const { error: deleteOrdersError } = await supabase
        .from("orders")
        .delete()
        .eq("venue_id", venueId);

      if (deleteOrdersError) {
        logger.error("🔄 [DAILY RESET] Error deleting all orders:", {
          error: deleteOrdersError.message || "Unknown error",
        });
        return NextResponse.json({ error: "Failed to delete all orders" }, { status: 500 });
      }
    }

    return NextResponse.json({
      success: true,
      message: "Daily reset completed successfully",
      summary: {
        venueId,
        venueName: venue.venue_name,
        completedOrders: activeOrders?.length || 0,
        canceledReservations: activeReservations?.length || 0,
        deletedTables: tables?.length || 0,
        forceMode: force,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (_error) {
    logger.error("🔄 [DAILY RESET] Error in daily reset API:", {
      error: _error instanceof Error ? _error.message : "Unknown _error",
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// GET endpoint to check if daily reset is needed
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const venueId = searchParams.get("venueId") || searchParams.get("venue_id");

    if (!venueId) {
      return NextResponse.json({ error: "Venue ID is required" }, { status: 400 });
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

    const supabase = await createClient();

    // Check for active orders
    const { data: activeOrders } = await supabase
      .from("orders")
      .select("id")
      .eq("venue_id", venueId)
      .in("order_status", ["PLACED", "ACCEPTED", "IN_PREP", "READY", "SERVING"]);

    // Check for active reservations
    const { data: activeReservations } = await supabase
      .from("reservations")
      .select("id")
      .eq("venue_id", venueId)
      .eq("status", "BOOKED");

    // Check for occupied tables by looking at table_sessions instead
    const { data: occupiedTables } = await supabase
      .from("table_sessions")
      .select("table_id")
      .eq("venue_id", venueId)
      .eq("status", "ACTIVE");

    const needsReset =
      (activeOrders?.length || 0) > 0 ||
      (activeReservations?.length || 0) > 0 ||
      (occupiedTables?.length || 0) > 0;

    return NextResponse.json({
      needsReset,
      summary: {
        activeOrders: activeOrders?.length || 0,
        activeReservations: activeReservations?.length || 0,
        occupiedTables: occupiedTables?.length || 0,
      },
    });
  } catch (_error) {
    logger.error("🔄 [DAILY RESET] Error checking reset status:", {
      error: _error instanceof Error ? _error.message : "Unknown _error",
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
