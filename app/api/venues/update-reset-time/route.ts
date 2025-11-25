import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { withUnifiedAuth } from '@/lib/auth/unified-auth';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { createClient } from "@/lib/supabase";

export const runtime = "nodejs";

export const POST = withUnifiedAuth(
  async (req: NextRequest, context) => {
    try {
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

      const body = await req.json();
      const { resetTime  } = body;
      const finalVenueId = context.venueId || body.venueId;

    if (!finalVenueId || !resetTime) {
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

    // Venue access already verified above via requireVenueAccessForAPI
    const supabase = await createClient();

    // Update the reset time
    const { error: updateError } = await supabase
      .from("venues")
      .update({ daily_reset_time: resetTime })
      .eq("venue_id", finalVenueId);

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
);
