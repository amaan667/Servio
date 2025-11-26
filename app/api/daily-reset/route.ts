import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";
import { logger } from "@/lib/logger";
import { withUnifiedAuth } from "@/lib/auth/unified-auth";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";

export const POST = withUnifiedAuth(
  async (req: NextRequest, context) => {
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

      // STEP 2: Get venueId from context (already verified)
      const venueId = context.venueId;

      // STEP 3: Parse request
      const body = await req.json();
      const { force = false } = body;

      // STEP 4: Validate inputs
      if (!venueId) {
        return NextResponse.json({ error: "Venue ID is required" }, { status: 400 });
      }

      // STEP 5: Security - Verify venue access (already done by withUnifiedAuth)

      // STEP 6: Business logic
      const supabase = await createClient();

      // Check if venue exists
      const { data: venue, error: venueError } = await supabase
        .from("venues")
        .select("venue_id, venue_name")
        .eq("venue_id", venueId)
        .single();

      if (venueError || !venue) {
        logger.error("[DAILY RESET] Venue not found:", {
          venueId,
          error: venueError,
          userId: context.user.id,
        });
        return NextResponse.json({ error: "Venue not found" }, { status: 404 });
      }

      // Step 1: Complete all active orders (mark as COMPLETED)
      const { data: activeOrders, error: activeOrdersError } = await supabase
        .from("orders")
        .select("id, order_status, table_number")
        .eq("venue_id", venueId)
        .in("order_status", ["PLACED", "ACCEPTED", "IN_PREP", "READY", "SERVING"]);

      if (activeOrdersError) {
        logger.error("[DAILY RESET] Error fetching active orders:", {
          error: activeOrdersError.message || "Unknown error",
          venueId,
          userId: context.user.id,
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
          logger.error("[DAILY RESET] Error completing orders:", {
            error: completeOrdersError.message || "Unknown error",
            venueId,
            userId: context.user.id,
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
        logger.error("[DAILY RESET] Error fetching active reservations:", {
          error: activeReservationsError.message || "Unknown error",
          venueId,
          userId: context.user.id,
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
          logger.error("[DAILY RESET] Error cancelling reservations:", {
            error: cancelReservationsError.message || "Unknown error",
            venueId,
            userId: context.user.id,
          });
          return NextResponse.json({ error: "Failed to cancel active reservations" }, { status: 500 });
        }
      }

      // Step 3: Clear all table sessions
      const { error: clearSessionsError } = await supabase
        .from("table_sessions")
        .delete()
        .eq("venue_id", venueId);

      if (clearSessionsError) {
        logger.error("[DAILY RESET] Error clearing table sessions:", {
          error: clearSessionsError.message || "Unknown error",
          venueId,
          userId: context.user.id,
        });
        return NextResponse.json({ error: "Failed to clear table sessions" }, { status: 500 });
      }

      // Step 4: Reset all tables to available
      const { error: resetTablesError } = await supabase
        .from("tables")
        .update({
          status: "AVAILABLE",
          updated_at: new Date().toISOString(),
        })
        .eq("venue_id", venueId);

      if (resetTablesError) {
        logger.error("[DAILY RESET] Error resetting tables:", {
          error: resetTablesError.message || "Unknown error",
          venueId,
          userId: context.user.id,
        });
        return NextResponse.json({ error: "Failed to reset tables" }, { status: 500 });
      }

      // STEP 7: Return success response
      return NextResponse.json({
        success: true,
        message: "Daily reset completed successfully",
        ordersCompleted: activeOrders?.length || 0,
        reservationsCancelled: activeReservations?.length || 0,
      });
    } catch (_error) {
      const errorMessage = _error instanceof Error ? _error.message : "An unexpected error occurred";
      const errorStack = _error instanceof Error ? _error.stack : undefined;
      
      logger.error("[DAILY RESET] Unexpected error:", {
        error: errorMessage,
        stack: errorStack,
        venueId: context.venueId,
        userId: context.user.id,
      });
      
      if (errorMessage.includes("Unauthorized") || errorMessage.includes("Forbidden")) {
        return NextResponse.json(
          {
            error: errorMessage.includes("Unauthorized") ? "Unauthorized" : "Forbidden",
            message: errorMessage,
          },
          { status: errorMessage.includes("Unauthorized") ? 401 : 403 }
        );
      }
      
      return NextResponse.json(
        {
          error: "Internal Server Error",
          message: process.env.NODE_ENV === "development" ? errorMessage : "Request processing failed",
          ...(process.env.NODE_ENV === "development" && errorStack ? { stack: errorStack } : {}),
        },
        { status: 500 }
      );
    }
  },
  {
    // Extract venueId from body
    extractVenueId: async (req) => {
      try {
        const body = await req.json();
        return body?.venueId || body?.venue_id || null;
      } catch {
        return null;
      }
    },
  }
);
