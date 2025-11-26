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

      // STEP 7: Return success response
      return NextResponse.json({
        success: true,
        message: "Reset time updated successfully",
        resetTime,
      });
    } catch (_error) {
      const errorMessage = _error instanceof Error ? _error.message : "An unexpected error occurred";
      const errorStack = _error instanceof Error ? _error.stack : undefined;
      
      logger.error("[UPDATE RESET TIME] Unexpected error:", {
        error: errorMessage,
        stack: errorStack,
        venueId: context.venueId,
        userId: context.user.id,
      });
      
      if (errorMessage.includes("Unauthorized") || errorMessage.includes("Forbidden")) {
        return NextResponse.json(
          {
            error: errorMessage.includes("Unauthorized") ? "Unauthorized" : "Forbidden",
            message: errorMessage,
          },
          { status: errorMessage.includes("Unauthorized") ? 401 : 403 }
        );
      }
      
      return NextResponse.json(
        {
          error: "Internal Server Error",
          message: process.env.NODE_ENV === "development" ? errorMessage : "Request processing failed",
          ...(process.env.NODE_ENV === "development" && errorStack ? { stack: errorStack } : {}),
        },
        { status: 500 }
      );
    }
  },
  {
    // Extract venueId from body
    extractVenueId: async (req) => {
      try {
        const body = await req.json();
        return body?.venueId || body?.venue_id || null;
      } catch {
        return null;
      }
    },
  }
);
