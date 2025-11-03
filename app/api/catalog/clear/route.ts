import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

/**
 * Clear entire menu catalog for a venue
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { venueId } = body;

    if (!venueId) {
      return NextResponse.json({ ok: false, error: "venueId required" }, { status: 400 });
    }

    const supabase = createAdminClient();

    // Delete menu items
    const { error: deleteItemsError, count: itemsCount } = await supabase
      .from("menu_items")
      .delete({ count: "exact" })
      .eq("venue_id", venueId);

    if (deleteItemsError) {
      throw new Error(`Failed to delete items: ${deleteItemsError.message}`);
    }

    // Delete uploads
    const { error: deleteUploadsError } = await supabase
      .from("menu_uploads")
      .delete()
      .eq("venue_id", venueId);

    if (deleteUploadsError) {
      throw new Error(`Failed to delete uploads: ${deleteUploadsError.message}`);
    }


    return NextResponse.json({
      ok: true,
      deletedCount: itemsCount || 0,
    });
  } catch (_err) {
    const errorMessage = _err instanceof Error ? _err.message : "Clear failed";
    logger.error("Failed to clear catalog", { error: errorMessage });
    return NextResponse.json({ ok: false, error: errorMessage }, { status: 500 });
  }
}
