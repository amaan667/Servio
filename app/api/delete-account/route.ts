import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { requireAuthForAPI, requireVenueAccessForAPI } from "@/lib/auth/api";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, venueId } = body;

    if (!userId) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 });
    }

    // CRITICAL: Authentication check
    const { requireAuthForAPI } = await import("@/lib/auth/api");
    const authResult = await requireAuthForAPI();
    if (authResult.error || !authResult.user || authResult.user.id !== userId) {
      return NextResponse.json(
        { error: "Unauthorized", message: "You can only delete your own account" },
        { status: 403 }
      );
    }

    // CRITICAL: Rate limiting
    const rateLimitResult = await rateLimit(req, RATE_LIMITS.STRICT);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        {
          error: "Too many requests",
          message: `Rate limit exceeded. Try again in ${Math.ceil((rateLimitResult.reset - Date.now()) / 1000)} seconds.`,
        },
        { status: 429 }
      );
    }

    // If venueId provided, verify access
    if (venueId) {
      const venueAccessResult = await requireVenueAccessForAPI(venueId, req);
      if (!venueAccessResult.success) {
        return venueAccessResult.response;
      }
    }

    const supabase = createAdminClient();

    // Delete venue and related data
    if (venueId) {
      await supabase.from("venues").delete().eq("venue_id", venueId);
      // Optionally: delete related menu_items, orders, etc.
    }
    // Delete user from Auth
    const { error } = await supabase.auth.admin.deleteUser(userId);
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (_error) {
    return NextResponse.json(
      {
        success: false,
        message: _error instanceof Error ? _error.message : "Failed to delete account",
      },
      { status: 500 }
    );
  }
}
