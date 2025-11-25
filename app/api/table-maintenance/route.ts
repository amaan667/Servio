import { NextRequest, NextResponse } from "next/server";
import { createClient, getAuthenticatedUser } from "@/lib/supabase";
import { logger } from "@/lib/logger";
import { requireAuthForAPI } from "@/lib/auth/api";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";

export async function POST(_req: NextRequest) {
  try {

    // CRITICAL: Authentication check
    const authResult = await requireAuthForAPI(_req);
    if (authResult.error || !authResult.user) {
      return NextResponse.json(
        { error: 'Unauthorized', message: authResult.error || 'Authentication required' },
        { status: 401 }
      );
    }

    // CRITICAL: Rate limiting
    const rateLimitResult = await rateLimit(_req, RATE_LIMITS.GENERAL);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        {
          error: 'Too many requests',
          message: `Rate limit exceeded. Try again in ${Math.ceil((rateLimitResult.reset - Date.now()) / 1000)} seconds.`,
        },
        { status: 429 }
      );
    }

    // Check authentication
    const { user, error: authError } = await getAuthenticatedUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    // Use admin client for maintenance operations
    const supabase = await createClient();

    // Run the table maintenance function
    const { error } = await supabase.rpc("run_table_maintenance");

    if (error) {
      logger.error("[TABLE MAINTENANCE] Error running maintenance:", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return NextResponse.json({ error: "Failed to run table maintenance" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: "Table maintenance completed successfully",
      timestamp: new Date().toISOString(),
    });
  } catch (_error) {
    logger.error("[TABLE MAINTENANCE] Unexpected error:", {
      error: _error instanceof Error ? _error.message : "Unknown _error",
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET(_req: NextRequest) {
  try {
    // Check authentication
    const { user, error: authError } = await getAuthenticatedUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    // Use admin client for maintenance operations
    const supabase = await createClient();

    // Check for expired reservations
    const { data: expiredReservations, error: expiredError } = await supabase
      .from("table_sessions")
      .select("id, table_id, customer_name, reservation_time, reservation_duration_minutes")
      .eq("status", "RESERVED")
      .not("reservation_time", "is", null)
      .not("reservation_duration_minutes", "is", null);

    if (expiredError) {
      logger.error("[TABLE MAINTENANCE] Error checking expired reservations:", expiredError);
      return NextResponse.json({ error: "Failed to check expired reservations" }, { status: 500 });
    }

    // Calculate which reservations are expired
    const now = new Date();
    const expired =
      expiredReservations?.filter((reservation) => {
        if (!reservation.reservation_time || !reservation.reservation_duration_minutes)
          return false;
        const endTime = new Date(
          new Date(reservation.reservation_time).getTime() +
            reservation.reservation_duration_minutes * 60 * 1000
        );
        return now > endTime;
      }) || [];

    return NextResponse.json({
      success: true,
      expiredReservations: expired.length,
      totalReservations: expiredReservations?.length || 0,
      timestamp: new Date().toISOString(),
    });
  } catch (_error) {
    logger.error("[TABLE MAINTENANCE] Unexpected error:", {
      error: _error instanceof Error ? _error.message : "Unknown _error",
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
