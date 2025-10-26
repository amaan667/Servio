import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { apiLogger as logger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * NUCLEAR OPTION: Clear ALL table sessions for a venue
 * Call: POST /api/tables/clear-all
 * Body: { "venueId": "venue-1e02af4d" }
 */
export async function POST(req: Request) {
  try {
    const { venueId } = await req.json();

    if (!venueId) {
      return NextResponse.json({ ok: false, error: "venueId required" }, { status: 400 });
    }

    const admin = createAdminClient();

    // Get all table sessions for this venue
    const { data: sessions, error: fetchError } = await admin
      .from("table_sessions")
      .select("*")
      .eq("venue_id", venueId);

    if (fetchError) {
      return NextResponse.json({ ok: false, error: fetchError.message }, { status: 500 });
    }

    if (sessions) {
      sessions.forEach((_session) => {
        /* Empty */
      });
    }

    // Close ALL table sessions for this venue
    const { data: updated, error: updateError } = await admin
      .from("table_sessions")
      .update({
        status: "FREE",
        order_id: null,
        closed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("venue_id", venueId)
      .select("id, table_id");

    if (updateError) {
      return NextResponse.json({ ok: false, error: updateError.message }, { status: 500 });
    }

    logger.debug("[CLEAR ALL TABLES] Cleared all table sessions", {
      venueId,
      count: updated?.length || 0,
    });

    return NextResponse.json({
      ok: true,
      message: `Cleared ${updated?.length || 0} table sessions`,
      cleared: updated?.length || 0,
    });
  } catch (_error) {
    logger.error("[CLEAR ALL TABLES] Error:", {
      error: _error instanceof Error ? _error.message : String(_error),
    });
    return NextResponse.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}
