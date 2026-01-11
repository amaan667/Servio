import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";
import { withUnifiedAuth } from "@/lib/auth/unified-auth";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { isDevelopment } from "@/lib/env";
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
      
      return apiErrors.notFound("Venue not found");
    }

    // Step 1: Complete all active orders
    const { data: activeOrders, error: activeOrdersError } = await supabase
      .from("orders")
      .select("id, order_status, table_number")
      .eq("venue_id", venueId)
      .in("order_status", ["PLACED", "ACCEPTED", "IN_PREP", "READY", "SERVING"]);

    if (activeOrdersError) {
      
      return apiErrors.database(
        "Failed to fetch active orders",
        isDevelopment() ? activeOrdersError.message : undefined
      );
    }

    if (activeOrders && activeOrders.length > 0) {
      const { error: completeOrdersError } = await supabase
        .from("orders")
        .update({

        .eq("venue_id", venueId)
        .in("order_status", ["PLACED", "ACCEPTED", "IN_PREP", "READY", "SERVING"]);

      if (completeOrdersError) {
        
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
      
      return apiErrors.database(
        "Failed to fetch active reservations",
        isDevelopment() ? activeReservationsError.message : undefined
      );
    }

    if (activeReservations && activeReservations.length > 0) {
      const { error: cancelReservationsError } = await supabase
        .from("reservations")
        .update({

        .eq("venue_id", venueId)
        .eq("status", "BOOKED");

      if (cancelReservationsError) {
        
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
      
      return apiErrors.database(
        "Failed to clear table sessions",
        isDevelopment() ? clearSessionsError.message : undefined
      );
    }

    // Step 4: Reset all tables to available
    const { error: resetTablesError } = await supabase
      .from("tables")
      .update({

      .eq("venue_id", venueId);

    if (resetTablesError) {
      
      return apiErrors.database(
        "Failed to reset tables",
        isDevelopment() ? resetTablesError.message : undefined
      );
    }

    // STEP 7: Return success response
    return success({

  } catch (error) {

    if (isZodError(error)) {
      return handleZodError(error);
    }

    return apiErrors.internal("Request processing failed", isDevelopment() ? error : undefined);
  }

// Simple GET handler for health/testing
export async function GET() {
  return NextResponse.json({ ok: true });
}
