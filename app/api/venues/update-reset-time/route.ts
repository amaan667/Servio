import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { requireVenueAccessForAPI } from '@/lib/auth/api';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { createClient } from "@/lib/supabase";

export async function POST(_request: NextRequest) {
  try {
    const req = _request;

    // CRITICAL: Authentication and venue access verification
    const { searchParams } = new URL(req.url);
    let venueId = searchParams.get('venueId') || searchParams.get('venue_id');
    
    if (!venueId) {
      try {
        const body = await req.clone().json();
        venueId = body?.venueId || body?.venue_id;
      } catch {
        // Body parsing failed
      }
    }
    
    if (venueId) {
      const venueAccessResult = await requireVenueAccessForAPI(venueId, req);
      if (!venueAccessResult.success) {
        return venueAccessResult.response;
      }
    } else {
      // Fallback to basic auth if no venueId
      const { requireAuthForAPI } = await import('@/lib/auth/api');
      const authResult = await requireAuthForAPI(req);
      if (authResult.error || !authResult.user) {
        return NextResponse.json(
          { error: 'Unauthorized', message: authResult.error || 'Authentication required' },
          { status: 401 }
        );
      }
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

    const body = await req.json();
    const { resetTime  } = body;
    const finalVenueId = venueId || body.venueId;

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
