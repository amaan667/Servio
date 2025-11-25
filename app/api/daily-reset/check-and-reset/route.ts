import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { logger } from "@/lib/logger";
import { withUnifiedAuth } from '@/lib/auth/unified-auth';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';

export const runtime = "nodejs";

export const POST = withUnifiedAuth(
  async (req: NextRequest, context) => {
    try {
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
      const finalVenueId = context.venueId || body.venueId;
    const force = body.force || false;

    if (!finalVenueId) {
      return NextResponse.json({ error: "Venue ID is required" }, { status: 400 });
    }


    // Check if service role key is available
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      logger.error("🔄 [DAILY RESET CHECK] SUPABASE_SERVICE_ROLE_KEY not found");
      return NextResponse.json({ error: "Service role key not configured" }, { status: 500 });
    }

    const supabase = createAdminClient();

    // Check if venue exists
    const { data: venue, error: venueError } = await supabase
      .from("venues")
      .select("venue_id, venue_name")
      .eq("venue_id", finalVenueId)
      .single();

    if (venueError) {
      logger.error("🔄 [DAILY RESET CHECK] Error fetching venue:", {
        error: venueError.message || "Unknown error",
      });
      return NextResponse.json({ error: `Database error: ${venueError.message}` }, { status: 500 });
    }

    if (!venue) {
      return NextResponse.json({ error: "Venue not found" }, { status: 404 });
    }

    // Check if we need to reset based on date
    const today = new Date();
    const todayString = today.toISOString().split("T")[0]; // YYYY-MM-DD format

    // Try to create the daily_reset_log table if it doesn't exist
    try {
      await supabase.rpc("exec_sql", {
        sql: `
          CREATE TABLE IF NOT EXISTS daily_reset_log (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            venue_id TEXT NOT NULL,
            reset_date DATE NOT NULL,
            reset_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            completed_orders INTEGER DEFAULT 0,
            canceled_reservations INTEGER DEFAULT 0,
            reset_tables INTEGER DEFAULT 0,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW(),
            UNIQUE(venue_id, reset_date)
          );
        `,
      });
    } catch {
      // Ignore error if table already exists
    }

    // Check if there's a reset record for today
    const { data: resetRecord, error: resetError } = await supabase
      .from("daily_reset_log")
      .select("*")
      .eq("venue_id", finalVenueId)
      .eq("reset_date", todayString)
      .maybeSingle();

    if (resetError) {
      // Continue anyway - don't fail if table doesn't exist
    }

    // If we already reset today, return success (unless force=true)
    if (resetRecord && !force) {
      return NextResponse.json({
        success: true,
        message: "Already reset today",
        resetDate: todayString,
        alreadyReset: true,
      });
    }

    if (force) {
      logger.info(
        `🔄 [DAILY RESET CHECK] Force reset requested - proceeding even if already reset today`
      );
    }

    // Check if there are unknown recent orders (within last 2 hours) - if so, don't reset
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const { data: recentOrders, error: recentOrdersError } = await supabase
      .from("orders")
      .select("id, created_at")
      .eq("venue_id", finalVenueId)
      .gte("created_at", twoHoursAgo)
      .limit(1);

    if (recentOrdersError) {
      logger.error("🔄 [DAILY RESET CHECK] Error checking recent orders:", {
        error: recentOrdersError.message || "Unknown error",
      });
      // Continue with reset if we can't check
    } else if (recentOrders && recentOrders.length > 0) {
      return NextResponse.json({
        success: true,
        message: "Skipping reset due to recent orders",
        resetDate: todayString,
        alreadyReset: false,
        skipped: true,
        reason: "Recent orders found",
      });
    }

    // Perform the reset
    const resetSummary = {
      completedOrders: 0,
      canceledReservations: 0,
      resetTables: 0,
    };

    // Step 1: Complete all active orders
    const { data: activeOrders, error: activeOrdersError } = await supabase
      .from("orders")
      .select("id, order_status, table_number")
      .eq("venue_id", finalVenueId)
      .in("order_status", ["PLACED", "ACCEPTED", "IN_PREP", "READY", "SERVING"]);

    if (activeOrdersError) {
      logger.error("🔄 [DAILY RESET CHECK] Error fetching active orders:", {
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
        logger.error("🔄 [DAILY RESET CHECK] Error completing orders:", {
          error: completeOrdersError.message || "Unknown error",
        });
        return NextResponse.json({ error: "Failed to complete active orders" }, { status: 500 });
      }

      resetSummary.completedOrders = activeOrders.length;
    }

    // Step 2: Cancel all active reservations
    const { data: activeReservations, error: activeReservationsError } = await supabase
      .from("reservations")
      .select("id, status")
      .eq("venue_id", finalVenueId)
      .eq("status", "BOOKED");

    if (activeReservationsError) {
      logger.error("🔄 [DAILY RESET CHECK] Error fetching active reservations:", {
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
        logger.error("🔄 [DAILY RESET CHECK] Error canceling reservations:", {
          error: cancelReservationsError.message || "Unknown error",
        });
        return NextResponse.json(
          { error: "Failed to cancel active reservations" },
          { status: 500 }
        );
      }

      resetSummary.canceledReservations = activeReservations.length;
    }

    // Step 3: Delete all tables for complete reset
    const { data: tables, error: tablesError } = await supabase
      .from("tables")
      .select("id, label")
      .eq("venue_id", finalVenueId);

    if (tablesError) {
      logger.error("🔄 [DAILY RESET CHECK] Error fetching tables:", {
        error: tablesError.message || "Unknown error",
      });
      return NextResponse.json({ error: "Failed to fetch tables" }, { status: 500 });
    }

    if (tables && tables.length > 0) {
      // Step 3a: Clear table references from all orders to avoid foreign key constraint
      const { error: clearTableRefsError } = await supabase
        .from("orders")
        .update({ table_id: null })
        .eq("venue_id", finalVenueId);

      if (clearTableRefsError) {
        logger.error("🔄 [DAILY RESET CHECK] Error clearing table references:", {
          error: clearTableRefsError.message || "Unknown error",
        });
        return NextResponse.json(
          { error: "Failed to clear table references from orders" },
          { status: 500 }
        );
      }

      // Step 3b: Delete all table sessions first (if they exist)
      const { error: deleteSessionsError } = await supabase
        .from("table_sessions")
        .delete()
        .eq("venue_id", finalVenueId);

      if (deleteSessionsError) {
        logger.warn("🔄 [DAILY RESET CHECK] Warning clearing table sessions:", {
          error: deleteSessionsError.message || "Unknown error",
        });
        // Don't fail for this, continue
      }

      // Step 3c: Delete all tables for the venue
      const { error: deleteTablesError } = await supabase
        .from("tables")
        .delete()
        .eq("venue_id", finalVenueId);

      if (deleteTablesError) {
        logger.error("🔄 [DAILY RESET CHECK] Error deleting tables:", {
          error: deleteTablesError.message || "Unknown error",
        });
        return NextResponse.json({ error: "Failed to delete tables" }, { status: 500 });
      }

      resetSummary.resetTables = tables.length;
    }

    // Step 4: Clear unknown table runtime state
    const { error: clearRuntimeError } = await supabase
      .from("table_runtime_state")
      .delete()
      .eq("venue_id", finalVenueId);

    if (clearRuntimeError) {
      logger.error("🔄 [DAILY RESET CHECK] Error clearing runtime state:", {
        error: clearRuntimeError.message || "Unknown error",
      });
      // Don't fail the entire operation for this
      logger.warn("🔄 [DAILY RESET CHECK] Continuing despite runtime state clear error");
    }

    // Step 5: Record the reset in the log
    const { error: logError } = await supabase.from("daily_reset_log").insert({
      venue_id: finalVenueId,
      reset_date: todayString,
      reset_timestamp: new Date().toISOString(),
      completed_orders: resetSummary.completedOrders,
      canceled_reservations: resetSummary.canceledReservations,
      reset_tables: resetSummary.resetTables,
    });

    if (logError) {
      logger.error("🔄 [DAILY RESET CHECK] Error logging reset:", {
        error: logError.message || "Unknown error",
      });
      // Don't fail the operation for this
      logger.warn("🔄 [DAILY RESET CHECK] Continuing despite log error");
    }

    return NextResponse.json({
      success: true,
      message: "Daily reset completed successfully",
      resetDate: todayString,
      summary: {
        venueId: finalVenueId,
        venueName: venue.venue_name,
        completedOrders: resetSummary.completedOrders,
        canceledReservations: resetSummary.canceledReservations,
        deletedTables: resetSummary.resetTables,
        timestamp: new Date().toISOString(),
      },
    });
    } catch (_error) {
      logger.error("🔄 [DAILY RESET CHECK] Error in daily reset check:", {
        error: _error instanceof Error ? _error.message : "Unknown _error",
      });
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
  }
);
