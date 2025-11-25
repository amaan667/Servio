import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";
import { logger } from "@/lib/logger";
import { requireVenueAccessForAPI } from "@/lib/auth/api";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";

export const runtime = "nodejs";

/**
 * Clear entire menu catalog for a venue
 */
export async function POST(req: NextRequest) {
  try {

    const body = await req.json();
    const venueId = body?.venueId || body?.venue_id;

    if (!venueId) {
      return NextResponse.json({ ok: false, error: "venueId required" }, { status: 400 });
    }

    // CRITICAL: Authentication and venue access verification
    const venueAccessResult = await requireVenueAccessForAPI(venueId);
    if (!venueAccessResult.success) {
      return venueAccessResult.response;
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

    const supabase = await createClient();

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
