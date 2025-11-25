import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";
import { logger } from "@/lib/logger";
import { requireVenueAccessForAPI } from "@/lib/auth/api";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {

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

    const body = await req.json();
    const { tableNumbers } = body;
    const finalVenueId = venueId || body.venueId;

    // Validation
    if (!Array.isArray(tableNumbers) || tableNumbers.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          error: "Table numbers must be a non-empty array",
        },
        { status: 400 }
      );
    }

    if (!tableNumbers.every((num) => Number.isInteger(num) && num > 0)) {
      return NextResponse.json(
        {
          ok: false,
          error: "All table numbers must be positive integers",
        },
        { status: 400 }
      );
    }

    if (!finalVenueId || typeof finalVenueId !== "string") {
      return NextResponse.json(
        {
          ok: false,
          error: "Venue ID is required",
        },
        { status: 400 }
      );
    }

    // Get authenticated user
    const supabase = await createClient();
    const {
      data: { session },
      error: authError,
    } = await supabase.auth.getSession();
    const user = session?.user;
    if (authError || !user) {
      return NextResponse.json(
        {
          ok: false,
          error: "Not authenticated",
        },
        { status: 401 }
      );
    }

    // Check venue ownership
    const { data: venue } = await supabase
      .from("venues")
      .select("venue_id")
      .eq("venue_id", venueId)
      .eq("owner_user_id", user.id)
      .maybeSingle();

    if (!venue) {
      return NextResponse.json(
        {
          ok: false,
          error: "Venue not found or access denied",
        },
        { status: 403 }
      );
    }

    // Use admin client for database operations
    const adminSupabase = await createClient();

    // Step 1: Update active orders to COMPLETED status
    const { data: updatedOrders, error: updateError } = await adminSupabase
      .from("orders")
      .update({
        order_status: "COMPLETED",
        updated_at: new Date().toISOString(),
      })
      .in("table_number", tableNumbers)
      .in("order_status", ["PLACED", "ACCEPTED", "IN_PREP", "READY", "SERVING"])
      .eq("venue_id", venueId)
      .select("id, table_number, order_status");

    if (updateError) {
      logger.error("[TABLE REMOVAL] Error updating orders:", updateError);
      return NextResponse.json(
        {
          ok: false,
          error: `Failed to update orders: ${updateError.message}`,
        },
        { status: 500 }
      );
    }

    // Step 2: Get table IDs first
    const { data: tablesToRemove, error: tablesError } = await adminSupabase
      .from("tables")
      .select("id, label")
      .in("label", tableNumbers.map(String))
      .eq("venue_id", venueId);

    if (tablesError) {
      logger.error("[TABLE REMOVAL] Error fetching tables:", tablesError);
      return NextResponse.json(
        {
          ok: false,
          error: `Failed to fetch tables: ${tablesError.message}`,
        },
        { status: 500 }
      );
    }

    const tableIdsToRemove = tablesToRemove?.map((t) => t.id) || [];

    // Step 3: Clear table_id references in orders
    const { data: clearedOrders, error: clearError } = await adminSupabase
      .from("orders")
      .update({
        table_id: null,
        updated_at: new Date().toISOString(),
      })
      .in("table_id", tableIdsToRemove)
      .eq("venue_id", venueId)
      .select("id, table_id");

    if (clearError) {
      logger.error("[TABLE REMOVAL] Error clearing table_id references:", clearError);
      return NextResponse.json(
        {
          ok: false,
          error: `Failed to clear table references: ${clearError.message}`,
        },
        { status: 500 }
      );
    }

    // Step 4: Remove table records
    const { data: removedTables, error: tableError } = await adminSupabase
      .from("tables")
      .delete()
      .in("id", tableIdsToRemove)
      .eq("venue_id", venueId)
      .select("id, label");

    if (tableError) {
      logger.error("[TABLE REMOVAL] Error removing tables:", {
        error: tableError instanceof Error ? tableError.message : "Unknown error",
      });
      return NextResponse.json(
        {
          ok: false,
          error: `Failed to remove tables: ${tableError.message}`,
        },
        { status: 500 }
      );
    }

    // Step 5: Remove table sessions
    const removedTableIds = tableIdsToRemove;
    let removedSessions = [];

    if (removedTableIds.length > 0) {
      const { data: sessions, error: sessionError } = await adminSupabase
        .from("table_sessions")
        .delete()
        .in("table_id", removedTableIds)
        .eq("venue_id", finalVenueId)
        .select("id");

      if (sessionError) {
        logger.error("[TABLE REMOVAL] Error removing table sessions:", sessionError);
        return NextResponse.json(
          {
            ok: false,
            error: `Failed to remove table sessions: ${sessionError.message}`,
          },
          { status: 500 }
        );
      }

      removedSessions = sessions || [];
    }

    // Step 6: Remove reservations
    let removedReservations = [];

    if (removedTableIds.length > 0) {
      const { data: reservations, error: reservationError } = await adminSupabase
        .from("reservations")
        .delete()
        .in("table_id", removedTableIds)
        .eq("venue_id", finalVenueId)
        .select("id");

      if (reservationError) {
        logger.error("[TABLE REMOVAL] Error removing reservations:", reservationError);
        return NextResponse.json(
          {
            ok: false,
            error: `Failed to remove reservations: ${reservationError.message}`,
          },
          { status: 500 }
        );
      }

      removedReservations = reservations || [];
    }

    // Step 7: Verification
    const { data: remainingTables } = await adminSupabase
      .from("tables")
      .select("id, label")
      .in("label", tableNumbers.map(String))
      .eq("venue_id", venueId);

    const { data: remainingOrders } = await adminSupabase
      .from("orders")
      .select("table_number, order_status")
      .in("table_number", tableNumbers)
      .in("order_status", ["PLACED", "ACCEPTED", "IN_PREP", "READY", "SERVING"])
      .eq("venue_id", venueId);

    const result = {
      ok: true,
      message: `Successfully removed tables ${tableNumbers.join(", ")}`,
      data: {
        removedTables: removedTables?.length || 0,
        updatedOrders: updatedOrders?.length || 0,
        clearedOrders: clearedOrders?.length || 0,
        removedSessions: removedSessions?.length || 0,
        removedReservations: removedReservations?.length || 0,
        remainingTables: remainingTables?.length || 0,
        remainingActiveOrders: remainingOrders?.length || 0,
      },
    };

    return NextResponse.json(result);
  } catch (_error) {
    logger.error("[TABLE REMOVAL] Unexpected error:", {
      error: _error instanceof Error ? _error.message : "Unknown _error",
    });
    return NextResponse.json(
      {
        ok: false,
        error: _error instanceof Error ? _error.message : "An unexpected error occurred",
      },
      { status: 500 }
    );
  }
}
