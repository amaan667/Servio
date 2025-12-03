import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { logger } from "@/lib/logger";
import { withUnifiedAuth } from '@/lib/auth/unified-auth';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { isDevelopment } from '@/lib/env';
import { success, apiErrors } from '@/lib/api/standard-response';

export const POST = withUnifiedAuth(
  async (req: NextRequest, context) => {
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
      const finalVenueId = venueId || body.venueId;

      // STEP 4: Validate inputs
      if (!finalVenueId) {
        return apiErrors.badRequest("Venue ID is required");
      }

      const supabase = createAdminClient();

      // Check if venue exists
      const { data: venue, error: venueError } = await supabase
        .from("venues")
        .select("venue_id, venue_name")
        .eq("venue_id", finalVenueId)
        .single();

      if (venueError) {
        logger.error("[MANUAL DAILY RESET] Error fetching venue:", {
          error: venueError.message || "Unknown error",
          venueId: finalVenueId,
          userId: context.user.id,
        });
        return apiErrors.database(
          "Failed to fetch venue",
          isDevelopment() ? venueError.message : undefined
        );
      }

      if (!venue) {
        return apiErrors.notFound('Venue not found');
      }

      // Check if there are unknown recent orders (within last 2 hours) - if so, warn user
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
      const { error: recentOrdersError } = await supabase
        .from("orders")
        .select("id, created_at")
        .eq("venue_id", finalVenueId)
        .gte("created_at", twoHoursAgo)
        .limit(1);

      if (recentOrdersError) {
        logger.error("[MANUAL DAILY RESET] Error checking recent orders:", {
          error: recentOrdersError.message || "Unknown error",
          venueId: finalVenueId,
          userId: context.user.id,
        });
        // Continue with reset if we can't check
      }

      // Step 1: Complete all active orders (mark as COMPLETED)
      const { data: activeOrders, error: activeOrdersError } = await supabase
        .from("orders")
        .select("id, order_status, table_number")
        .eq("venue_id", finalVenueId)
        .in("order_status", ["PLACED", "ACCEPTED", "IN_PREP", "READY", "SERVING"]);

      if (activeOrdersError) {
        logger.error("[MANUAL DAILY RESET] Error fetching active orders:", {
          error: activeOrdersError.message || "Unknown error",
          venueId: finalVenueId,
          userId: context.user.id,
        });
        return apiErrors.internal('Failed to fetch active orders');
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
          logger.error("[MANUAL DAILY RESET] Error completing orders:", {
            error: completeOrdersError.message || "Unknown error",
            venueId: finalVenueId,
            userId: context.user.id,
          });
          return apiErrors.internal('Failed to complete active orders');
        }
      }

      // Step 2: Cancel all active reservations
      const { data: activeReservations, error: activeReservationsError } = await supabase
        .from("reservations")
        .select("id, status")
        .eq("venue_id", finalVenueId)
        .eq("status", "BOOKED");

      if (activeReservationsError) {
        logger.error("[MANUAL DAILY RESET] Error fetching active reservations:", {
          error: activeReservationsError.message || "Unknown error",
          venueId: finalVenueId,
          userId: context.user.id,
        });
        return apiErrors.internal('Failed to fetch active reservations');
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
          logger.error("[MANUAL DAILY RESET] Error canceling reservations:", {
            error: cancelReservationsError.message || "Unknown error",
            venueId: finalVenueId,
            userId: context.user.id,
          });
          return apiErrors.internal("Failed to cancel active reservations");
        }
      }

      // Step 3: Delete all tables for complete reset
      const { data: tables, error: tablesError } = await supabase
        .from("tables")
        .select("id, label")
        .eq("venue_id", finalVenueId);

      if (tablesError) {
        logger.error("[MANUAL DAILY RESET] Error fetching tables:", {
          error: tablesError.message || "Unknown error",
          venueId: finalVenueId,
          userId: context.user.id,
        });
        return apiErrors.internal('Failed to fetch tables');
      }

      if (tables && tables.length > 0) {
        // Delete all table sessions first (if they exist)
        const { error: deleteSessionsError } = await supabase
          .from("table_sessions")
          .delete()
          .eq("venue_id", finalVenueId);

        if (deleteSessionsError) {
          logger.warn("[MANUAL DAILY RESET] Warning clearing table sessions:", {
            error: deleteSessionsError.message || "Unknown error",
            venueId: finalVenueId,
            userId: context.user.id,
          });
          // Don't fail for this, continue
        }

        // Delete all tables for the venue
        const { error: deleteTablesError } = await supabase
          .from("tables")
          .delete()
          .eq("venue_id", finalVenueId);

        if (deleteTablesError) {
          logger.error("[MANUAL DAILY RESET] Error deleting tables:", {
            error: deleteTablesError.message || "Unknown error",
            venueId: finalVenueId,
            userId: context.user.id,
          });
          return apiErrors.internal('Failed to delete tables');
        }
      }

      // Step 4: Clear unknown table runtime state
      const { error: clearRuntimeError } = await supabase
        .from("table_runtime_state")
        .delete()
        .eq("venue_id", finalVenueId);

      if (clearRuntimeError) {
        logger.error("[MANUAL DAILY RESET] Error clearing runtime state:", {
          error: clearRuntimeError.message || "Unknown error",
          venueId: finalVenueId,
          userId: context.user.id,
        });
        // Don't fail the entire operation for this
        logger.warn("[MANUAL DAILY RESET] Continuing despite runtime state clear error");
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
        logger.error("[MANUAL DAILY RESET] Error logging reset:", {
          error: logError.message || "Unknown error",
          venueId: finalVenueId,
          userId: context.user.id,
        });
        // Don't fail the operation for this
        logger.warn("[MANUAL DAILY RESET] Continuing despite log error");
      }

      // STEP 7: Return success response
      return success({
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
      const errorMessage = _error instanceof Error ? _error.message : "An unexpected error occurred";
      const errorStack = _error instanceof Error ? _error.stack : undefined;
      
      logger.error("[MANUAL DAILY RESET] Unexpected error:", {
        error: errorMessage,
        stack: errorStack,
        venueId: context.venueId,
        userId: context.user.id,
      });
      
      if (errorMessage.includes("Unauthorized") || errorMessage.includes("Forbidden")) {
        return errorMessage.includes("Unauthorized")
          ? apiErrors.unauthorized(errorMessage)
          : apiErrors.forbidden(errorMessage);
      }

      return apiErrors.internal(
        "Request processing failed",
        isDevelopment() ? errorMessage : undefined
      );
    }
  },
  {
    // Extract venueId from body or query
    extractVenueId: async (req) => {
      try {
        const { searchParams } = new URL(req.url);
        let venueId = searchParams.get("venueId") || searchParams.get("venue_id");
        if (!venueId) {
          // Clone the request so we don't consume the original body
          const clonedReq = req.clone();
          const body = await clonedReq.json();
          venueId = body?.venueId || body?.venue_id;
        }
        return venueId;
      } catch {
        return null;
      }
    },
  }
);
