import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const { reservationId, tableId } = await req.json();

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
      logger.error("[CHECKIN] Error updating reservation:", updateError);
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
      logger.error("[CHECKIN] Error updating table session:", {
        error: tableError instanceof Error ? tableError.message : "Unknown error",
      });
      // Don't fail the request, just log the error
    }

    return NextResponse.json({
      ok: true,
      reservation: updatedReservation,
    });
  } catch (_error) {
    logger.error("[CHECKIN] Error:", {
      error: _error instanceof Error ? _error.message : "Unknown _error",
    });
    return NextResponse.json(
      {
        ok: false,
        error: _error instanceof Error ? _error.message : "Internal server _error",
      },
      { status: 500 }
    );
  }
}
