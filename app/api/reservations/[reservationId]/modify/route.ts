import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ reservationId: string }> }
) {
  try {
    const { reservationId } = await context.params;
    const { customerName, startAt, endAt, partySize, customerPhone } = await req.json();

    if (!reservationId) {
      return NextResponse.json(
        {
          ok: false,
          error: "reservationId is required",
        },
        { status: 400 }
      );
    }

    if (!customerName || !startAt || !endAt || !partySize) {
      return NextResponse.json(
        {
          ok: false,
          error: "customerName, startAt, endAt, and partySize are required",
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

    // Update the reservation
    const { data: updatedReservation, error: updateError } = await supabase
      .from("reservations")
      .update({
        customer_name: customerName,
        start_at: startAt,
        end_at: endAt,
        party_size: partySize,
        customer_phone: customerPhone || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", reservationId)
      .select()
      .single();

    if (updateError) {
      logger.error("[MODIFY RESERVATION] Error updating reservation:", updateError);
      return NextResponse.json(
        {
          ok: false,
          error: "Failed to modify reservation",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      reservation: updatedReservation,
    });
  } catch (_error) {
    logger.error("[MODIFY RESERVATION] Error:", {
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
