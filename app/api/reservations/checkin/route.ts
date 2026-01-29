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
    const { reservationId, tableId } = body;

    if (!reservationId || !tableId) {
      return NextResponse.json(
        {
          ok: false,
          error: "reservationId and tableId are required",
        },
        { status: 400 }
      );
    }

    // Use admin client - no auth needed
    const supabase = createAdminClient();

    // Get reservation to validate it exists
    const { data: reservation, error: reservationError } = await supabase
      .from("reservations")
      .select("venue_id")
      .eq("id", reservationId)
      .eq("venue_id", context.venueId)
      .single();

    if (reservationError || !reservation) {
      return NextResponse.json(
        {
          ok: false,
          error: "Reservation not found",
        },
        { status: 404 }
      );
    }

    // Update reservation status to CHECKED_IN
    const { data: updatedReservation, error: updateError } = await supabase
      .from("reservations")
      .update({
        status: "CHECKED_IN",
        updated_at: new Date().toISOString(),
      })
      .eq("id", reservationId)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json(
        {
          ok: false,
          error: "Failed to check in reservation",
        },
        { status: 500 }
      );
    }

    // Also update the table session to OCCUPIED if it's not already
    const { error: tableError } = await supabase.from("table_sessions").upsert(
      {
        table_id: tableId,
        status: "OCCUPIED",
        opened_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "table_id",
      }
    );

    if (tableError) {
      // Don't fail the request, just log the error
    }

    return NextResponse.json({
      ok: true,
      reservation: updatedReservation,
    });
  } catch (_error) {
    return NextResponse.json(
      {
        ok: false,
        error: _error instanceof Error ? _error.message : "Internal server _error",
      },
      { status: 500 }
    );
  }
});
