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

    console.info("\n" + "=".repeat(80));
    console.info("🧹 [CLEAR ALL TABLES] CLEARING ALL TABLE SESSIONS");
    console.info("=".repeat(80));
    console.info("🏪 Venue ID:", venueId);
    console.info("=".repeat(80) + "\n");

    // Get all table sessions for this venue
    const { data: sessions, error: fetchError } = await admin
      .from("table_sessions")
      .select("*")
      .eq("venue_id", venueId);

    if (fetchError) {
      console.error("❌ Error fetching sessions:", fetchError);
      return NextResponse.json({ ok: false, error: fetchError.message }, { status: 500 });
    }

    console.info("📊 Found", sessions?.length || 0, "table sessions");

    if (sessions) {
      sessions.forEach((session) => {
        console.info(
          `  - Table ID: ${session.table_id}, Status: ${session.status}, Order: ${session.order_id || "N/A"}, Closed: ${session.closed_at || "Open"}`
        );
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
      console.error("❌ Error clearing sessions:", updateError);
      return NextResponse.json({ ok: false, error: updateError.message }, { status: 500 });
    }

    console.info("\n" + "=".repeat(80));
    console.info("✅ [CLEAR ALL TABLES] ALL SESSIONS CLEARED!");
    console.info("=".repeat(80));
    console.info("🧹 Cleared", updated?.length || 0, "table sessions");
    console.info("=".repeat(80) + "\n");

    logger.debug("[CLEAR ALL TABLES] Cleared all table sessions", {
      venueId,
      count: updated?.length || 0,
    });

    return NextResponse.json({
      ok: true,
      message: `Cleared ${updated?.length || 0} table sessions`,
      cleared: updated?.length || 0,
    });
  } catch (error) {
    console.error("❌ [CLEAR ALL TABLES] Fatal error:", error);
    logger.error("[CLEAR ALL TABLES] Error:", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}
