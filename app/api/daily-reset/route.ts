import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";
import { logger } from "@/lib/logger";
import { withUnifiedAuth } from "@/lib/auth/unified-auth";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { env, isDevelopment, isProduction, getNodeEnv } from "@/lib/env";
import { success, apiErrors, isZodError, handleZodError } from "@/lib/api/standard-response";

export const POST = withUnifiedAuth(async (req: NextRequest, context) => {
  try {
    // STEP 1: Rate limiting (ALWAYS FIRST)
    const rateLimitResult = await rateLimit(req, RATE_LIMITS.GENERAL);
    if (!rateLimitResult.success) {
      return apiErrors.rateLimit();
    }

    // STEP 2: Get venueId from context (already verified)
    const venueId = context.venueId;

    // STEP 3: Parse request
    const body = await req.json();
    const { force = false } = body;

    // STEP 4: Validate inputs
    if (!venueId) {
      return apiErrors.badRequest("Venue ID is required");
    }

    // STEP 5: Business logic
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
      return apiErrors.notFound("Venue not found");
    }

    // Step 1: Complete all active orders
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
      return apiErrors.database(
        "Failed to fetch active orders",
        isDevelopment() ? activeOrdersError.message : undefined
      );
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
        return apiErrors.database(
          "Failed to complete active orders",
          isDevelopment() ? completeOrdersError.message : undefined
        );
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
      return apiErrors.database(
        "Failed to fetch active reservations",
        isDevelopment() ? activeReservationsError.message : undefined
      );
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
        return apiErrors.database(
          "Failed to cancel active reservations",
          isDevelopment() ? cancelReservationsError.message : undefined
        );
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
      return apiErrors.database(
        "Failed to clear table sessions",
        isDevelopment() ? clearSessionsError.message : undefined
      );
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
      return apiErrors.database(
        "Failed to reset tables",
        isDevelopment() ? resetTablesError.message : undefined
      );
    }

    // STEP 7: Return success response
    return success({
      message: "Daily reset completed successfully",
      ordersCompleted: activeOrders?.length || 0,
      reservationsCancelled: activeReservations?.length || 0,
    });
  } catch (error) {
    logger.error("[DAILY RESET] Unexpected error:", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      venueId: context.venueId,
      userId: context.user?.id,
    });

    if (isZodError(error)) {
      return handleZodError(error);
    }

    return apiErrors.internal("Request processing failed", isDevelopment() ? error : undefined);
  }
});

// Simple GET handler for health/testing
export async function GET() {
  return NextResponse.json({ ok: true });
}
