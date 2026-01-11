import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { withUnifiedAuth } from "@/lib/auth/unified-auth";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { isDevelopment } from "@/lib/env";
import { success, apiErrors } from "@/lib/api/standard-response";

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
        
        return apiErrors.database(
          "Failed to fetch venue",
          isDevelopment() ? venueError.message : undefined
        );
      }

      if (!venue) {
        return apiErrors.notFound("Venue not found");
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
        
        // Continue with reset if we can't check
      }

      // Step 1: Complete all active orders (mark as COMPLETED)
      const { data: activeOrders, error: activeOrdersError } = await supabase
        .from("orders")
        .select("id, order_status, table_number")
        .eq("venue_id", finalVenueId)
        .in("order_status", ["PLACED", "ACCEPTED", "IN_PREP", "READY", "SERVING"]);

      if (activeOrdersError) {
        
        return apiErrors.internal("Failed to fetch active orders");
      }

      if (activeOrders && activeOrders.length > 0) {
        const { error: completeOrdersError } = await supabase
          .from("orders")
          .update({

          .eq("venue_id", finalVenueId)
          .in("order_status", ["PLACED", "ACCEPTED", "IN_PREP", "READY", "SERVING"]);

        if (completeOrdersError) {
          
          return apiErrors.internal("Failed to complete active orders");
        }
      }

      // Step 2: Cancel all active reservations
      const { data: activeReservations, error: activeReservationsError } = await supabase
        .from("reservations")
        .select("id, status")
        .eq("venue_id", finalVenueId)
        .eq("status", "BOOKED");

      if (activeReservationsError) {
        
        return apiErrors.internal("Failed to fetch active reservations");
      }

      if (activeReservations && activeReservations.length > 0) {
        const { error: cancelReservationsError } = await supabase
          .from("reservations")
          .update({

          .eq("venue_id", finalVenueId)
          .eq("status", "BOOKED");

        if (cancelReservationsError) {
          
          return apiErrors.internal("Failed to cancel active reservations");
        }
      }

      // Step 3: Delete all tables for complete reset
      const { data: tables, error: tablesError } = await supabase
        .from("tables")
        .select("id, label")
        .eq("venue_id", finalVenueId);

      if (tablesError) {
        
        return apiErrors.internal("Failed to fetch tables");
      }

      if (tables && tables.length > 0) {
        // Delete all table sessions first (if they exist)
        const { error: deleteSessionsError } = await supabase
          .from("table_sessions")
          .delete()
          .eq("venue_id", finalVenueId);

        if (deleteSessionsError) {
          
          // Don't fail for this, continue
        }

        // Delete all tables for the venue
        const { error: deleteTablesError } = await supabase
          .from("tables")
          .delete()
          .eq("venue_id", finalVenueId);

        if (deleteTablesError) {
          
          return apiErrors.internal("Failed to delete tables");
        }
      }

      // Step 4: Clear unknown table runtime state
      const { error: clearRuntimeError } = await supabase
        .from("table_runtime_state")
        .delete()
        .eq("venue_id", finalVenueId);

      if (clearRuntimeError) {
        
        // Don't fail the entire operation for this
        
      }

      // Step 5: Record the manual reset in the log (but don't prevent future resets)
      const today = new Date();
      const todayString = today.toISOString().split("T")[0]; // YYYY-MM-DD format

      const { error: logError } = await supabase.from("daily_reset_log").upsert(
        {

        },
        {
          onConflict: "venue_id,reset_date",
        }
      );

      if (logError) {
        
        // Don't fail the operation for this
        
      }

      // STEP 7: Return success response
      return success({

        },

    } catch (_error) {
      const errorMessage =
        _error instanceof Error ? _error.message : "An unexpected error occurred";
      const errorStack = _error instanceof Error ? _error.stack : undefined;

      

      if (errorMessage.includes("Unauthorized") || errorMessage.includes("Forbidden")) {
        return errorMessage.includes("Unauthorized")
          ? apiErrors.unauthorized(errorMessage)

      }

      return apiErrors.internal(
        "Request processing failed",
        isDevelopment() ? errorMessage : undefined
      );
    }
  },
  {
    // Extract venueId from body or query

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
