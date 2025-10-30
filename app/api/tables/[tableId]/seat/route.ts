import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

// POST /api/tables/[tableId]/seat - Seat a party at a table
export async function POST(req: Request, context: { params: Promise<{ tableId: string }> }) {
  try {
    const { tableId } = await context.params;
    const body = await req.json();
    const { reservationId, serverId } = body;

    if (!tableId) {
      return NextResponse.json({ ok: false, error: "tableId is required" }, { status: 400 });
    }

    // Use admin client - no auth needed
    const supabase = createAdminClient();

    // Get table info
    const { data: table, error: tableError } = await supabase
      .from("tables")
      .select("venue_id")
      .eq("id", tableId)
      .single();

    if (tableError || !table) {
      return NextResponse.json({ ok: false, error: "Table not found" }, { status: 404 });
    }

    // Call the database function to seat the party
    const { error } = await supabase.rpc("api_seat_party", {
      p_table_id: tableId,
      p_venue_id: table.venue_id,
      p_reservation_id: reservationId || null,
      p_server_id: serverId || null,
    });

    if (error) {
      logger.error("[TABLES SEAT] Error:", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      message: "Party seated successfully",
    });
  } catch (_error) {
    logger.error("[TABLES SEAT] Unexpected error:", {
      error: _error instanceof Error ? _error.message : "Unknown _error",
    });
    return NextResponse.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}
