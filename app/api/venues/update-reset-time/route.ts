import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, verifyVenueAccess } from "@/lib/api-auth";
import { logger } from "@/lib/logger";

export async function POST(_request: NextRequest) {
  try {
    const { venueId, resetTime } = await _request.json();

    if (!venueId || !resetTime) {
      return NextResponse.json({ error: "Venue ID and reset time are required" }, { status: 400 });
    }

    // Validate time format (HH:MM:SS)
    const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/;
    if (!timeRegex.test(resetTime)) {
      return NextResponse.json(
        { error: "Invalid time format. Use HH:MM:SS format" },
        { status: 400 }
      );
    }

    // Authenticate using Authorization header
    const auth = await authenticateRequest(_request);
    if (!auth.success || !auth.user || !auth.supabase) {
      return NextResponse.json({ error: auth.error || "Unauthorized" }, { status: 401 });
    }

    const { user, supabase } = auth;

    // Verify venue access
    const access = await verifyVenueAccess(supabase, user.id, venueId);
    if (!access.hasAccess) {
      return NextResponse.json({ error: "Venue not found or access denied" }, { status: 404 });
    }

    // Update the reset time
    const { error: updateError } = await supabase
      .from("venues")
      .update({ daily_reset_time: resetTime })
      .eq("venue_id", venueId);

    if (updateError) {
      logger.error("Error updating reset time:", updateError);
      return NextResponse.json({ error: "Failed to update reset time" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: "Reset time updated successfully",
      resetTime,
    });
  } catch (_error) {
    logger.error("Error in update reset time API:", {
      error: _error instanceof Error ? _error.message : "Unknown _error",
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
