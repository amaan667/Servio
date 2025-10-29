import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

// POST /api/reservations/[reservationId]/assign - Assign reservation to table
export async function POST(req: Request, context: { params: Promise<{ reservationId: string }> }) {
  try {
    const { reservationId } = await context.params;
    const body = await req.json();
    const { tableId } = body;

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
      return NextResponse.json({ ok: false, error: "Reservation not found" }, { status: 404 });
    }

    // Call the database function to assign reservation
    const { error } = await supabase.rpc("api_assign_reservation", {
      p_reservation_id: reservationId,
      p_table_id: tableId,
    });

    if (error) {
      logger.error("[RESERVATIONS ASSIGN] Error:", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      message: "Reservation assigned successfully",
    });
  } catch (_error) {
    logger.error("[RESERVATIONS ASSIGN] Unexpected error:", {
      error: _error instanceof Error ? _error.message : "Unknown _error",
    });
    return NextResponse.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}
