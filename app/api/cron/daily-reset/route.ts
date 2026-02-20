import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";

import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { env, isDevelopment } from "@/lib/env";
import { apiErrors } from "@/lib/api/standard-response";
import { logger } from "@/lib/monitoring/structured-logger";

// This endpoint can be called by a cron job or scheduled task
// to automatically perform daily reset at midnight
//
// NOTE: Uses CRON_SECRET authentication instead of user auth
// - System-initiated task (not user request)
// - Authenticates via CRON_SECRET
// - Needs system-level access to reset all venues
export async function POST(req: NextRequest) {
  try {
    // STEP 1: Rate limiting (ALWAYS FIRST)
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

    // STEP 2: CRON_SECRET authentication (special auth for cron jobs)
    const authHeader = req.headers.get("authorization");
    const expectedAuth = env("CRON_SECRET");

    if (!expectedAuth) {
      return apiErrors.internal("CRON_SECRET is not configured");
    }

    if (authHeader !== `Bearer ${expectedAuth}`) {
      return apiErrors.unauthorized("Unauthorized");
    }

    // STEP 3: Parse request
    // STEP 4: Validate inputs (none required)

    // STEP 5: Security - CRON_SECRET verified above

    // STEP 6: Business logic
    // Check if it's time for unknown venue's daily reset
    const now = new Date();
    const currentTime = now.toTimeString().split(" ")[0]; // HH:MM:SS format
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();

    const supabase = createAdminClient();

    // Get all venues that need daily reset at the current time (within 5 minutes)
    const { data: venues, error: venuesError } = await supabase
      .from("venues")
      .select("venue_id, venue_name, daily_reset_time")
      .not("daily_reset_time", "is", null);

    if (venuesError) {
      return NextResponse.json(
        {
          error: "Failed to fetch venues",
          message: isDevelopment() ? venuesError.message : "Database query failed",
        },
        { status: 500 }
      );
    }

    if (!venues || venues.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No venues found for daily reset",
        resetVenues: [],
      });
    }

    // Filter venues that should reset at the current time (within 5 minutes)
    const venuesToReset = venues.filter((venue: { daily_reset_time: string | null }) => {
      if (!venue.daily_reset_time) return false;

      const timeParts = venue.daily_reset_time.split(":").map(Number);
      const resetHour = timeParts[0] ?? 0;
      const resetMinute = timeParts[1] ?? 0;
      const timeDiff = Math.abs(currentHour * 60 + currentMinute - (resetHour * 60 + resetMinute));

      // Reset if within 5 minutes of the scheduled time
      return timeDiff <= 5;
    });

    if (venuesToReset.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No venues scheduled for reset at this time",
        currentTime,
        resetVenues: [],
      });
    }

    const resetResults = [];

    for (const venue of venuesToReset) {
      try {
        // Check if this venue needs reset
        const { data: activeOrders } = await supabase
          .from("orders")
          .select("id")
          .eq("venue_id", venue.venue_id)
          .in("order_status", ["PLACED", "ACCEPTED", "IN_PREP", "READY", "SERVING"]);

        const { data: activeReservations } = await supabase
          .from("reservations")
          .select("id")
          .eq("venue_id", venue.venue_id)
          .eq("status", "BOOKED");

        // Check for occupied tables by looking at table_sessions instead
        const { data: occupiedTables } = await supabase
          .from("table_sessions")
          .select("table_id")
          .eq("venue_id", venue.venue_id)
          .eq("status", "ACTIVE");

        const needsReset =
          (activeOrders?.length || 0) > 0 ||
          (activeReservations?.length || 0) > 0 ||
          (occupiedTables?.length || 0) > 0;

        if (!needsReset) {
          resetResults.push({
            venueId: venue.venue_id,
            venueName: venue.venue_name,
            reset: false,
            reason: "No active orders, reservations, or occupied tables",
          });
          continue;
        }

        // Perform the reset

        // Complete all active orders (moves them to history)
        if (activeOrders && activeOrders.length > 0) {
          await supabase
            .from("orders")
            .update({
              order_status: "COMPLETED",
              updated_at: new Date().toISOString(),
            })
            .eq("venue_id", venue.venue_id)
            .in("order_status", ["PLACED", "ACCEPTED", "IN_PREP", "READY", "SERVING"]);
        }

        // Cancel all active reservations
        if (activeReservations && activeReservations.length > 0) {
          await supabase
            .from("reservations")
            .update({
              status: "CANCELLED",
              updated_at: new Date().toISOString(),
            })
            .eq("venue_id", venue.venue_id)
            .eq("status", "BOOKED");
        }

        // Get all tables before deletion
        const { data: venueTables } = await supabase
          .from("tables")
          .select("id, label")
          .eq("venue_id", venue.venue_id);

        if (venueTables && venueTables.length > 0) {
          // Delete all table sessions first
          const { error: sessionDeleteError } = await supabase
            .from("table_sessions")
            .delete()
            .eq("venue_id", venue.venue_id);

          if (sessionDeleteError) {
            logger.warn("[cron/daily-reset] failed to delete table sessions", {
              venueId: venue.venue_id,
              error: sessionDeleteError.message,
            });
          }

          // Delete all tables
          const { error: tableDeleteError } = await supabase
            .from("tables")
            .delete()
            .eq("venue_id", venue.venue_id);

          if (tableDeleteError) {
            logger.warn("[cron/daily-reset] failed to delete tables", {
              venueId: venue.venue_id,
              error: tableDeleteError.message,
            });
          }
        }

        // Clear table runtime state
        const { error: runtimeDeleteError } = await supabase
          .from("table_runtime_state")
          .delete()
          .eq("venue_id", venue.venue_id);

        if (runtimeDeleteError) {
          logger.warn("[cron/daily-reset] failed to delete table runtime state", {
            venueId: venue.venue_id,
            error: runtimeDeleteError.message,
          });
        }

        resetResults.push({
          venueId: venue.venue_id,
          venueName: venue.venue_name,
          reset: true,
          completedOrders: activeOrders?.length || 0,
          canceledReservations: activeReservations?.length || 0,
          deletedTables: venueTables?.length || 0,
        });
      } catch (_error) {
        resetResults.push({
          venueId: venue.venue_id,
          venueName: venue.venue_name,
          reset: false,
          error: _error instanceof Error ? _error.message : "Unknown _error",
        });
      }
    }

    const successfulResets = resetResults.filter((r) => r.reset).length;
    const totalVenues = venuesToReset.length;

    // STEP 7: Return success response
    return NextResponse.json({
      success: true,
      message: `Daily reset completed for ${successfulResets}/${totalVenues} venues`,
      timestamp: new Date().toISOString(),
      resetResults,
    });
  } catch (_error) {
    const errorMessage = _error instanceof Error ? _error.message : "An unexpected error occurred";
    const errorStack = _error instanceof Error ? _error.stack : undefined;

    return NextResponse.json(
      {
        error: "Internal Server Error",
        message: isDevelopment() ? errorMessage : "Request processing failed",
        ...(isDevelopment() && errorStack ? { stack: errorStack } : {}),
      },
      { status: 500 }
    );
  }
}

// GET endpoint to check cron status
export async function GET() {
  return NextResponse.json({
    message: "Daily reset cron endpoint is active",
    timestamp: new Date().toISOString(),
    nextReset: "Scheduled for midnight daily",
  });
}
