import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";

import { withUnifiedAuth } from "@/lib/auth/unified-auth";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";

export const runtime = "nodejs";

export const POST = withUnifiedAuth(async (req: NextRequest, context) => {
  try {
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

    const body = await req.json();
    const { tableNumbers } = body;

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

    const adminSupabase = createAdminClient();

    // Step 1: Update active orders to COMPLETED status
    const { data: updatedOrders, error: updateError } = await adminSupabase
      .from("orders")
      .update({
        order_status: "COMPLETED",
        updated_at: new Date().toISOString(),
      })
      .in("table_number", tableNumbers)
      .in("order_status", ["PLACED", "ACCEPTED", "IN_PREP", "READY", "SERVING"])
      .eq("venue_id", context.venueId)
      .select("id, table_number, order_status");

    if (updateError) {

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
      .eq("venue_id", context.venueId);

    if (tablesError) {

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
      .eq("venue_id", context.venueId)
      .select("id, table_id");

    if (clearError) {

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
      .eq("venue_id", context.venueId)
      .select("id, label");

    if (tableError) {

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
        .eq("venue_id", context.venueId)
        .select("id");

      if (sessionError) {

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
        .eq("venue_id", context.venueId)
        .select("id");

      if (reservationError) {

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
      .eq("venue_id", context.venueId);

    const { data: remainingOrders } = await adminSupabase
      .from("orders")
      .select("table_number, order_status")
      .in("table_number", tableNumbers)
      .in("order_status", ["PLACED", "ACCEPTED", "IN_PREP", "READY", "SERVING"])
      .eq("venue_id", context.venueId);

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

    return NextResponse.json(
      {
        ok: false,
        error: _error instanceof Error ? _error.message : "An unexpected error occurred",
      },
      { status: 500 }
    );
  }
});
