import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";
import { logger } from "@/lib/logger";
import { withUnifiedAuth } from '@/lib/auth/unified-auth';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';

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
      const { table_id, venue_id, reservation_id } = body;

      // Validate required fields
      if (!table_id || !venue_id) {
        return NextResponse.json(
          { success: false, error: "Missing required fields: table_id and venue_id are required" },
          { status: 400 }
        );
      }

      // Verify venue_id matches context (security check)
      if (venue_id !== context.venueId) {
        return NextResponse.json(
          { success: false, error: "Venue ID mismatch" },
          { status: 403 }
        );
      }

      const supabase = await createClient();

      // Call the seat party function
      const { data, error } = await supabase.rpc("api_seat_party", {
        p_table_id: table_id,
        p_venue_id: venue_id,
        p_reservation_id: reservation_id || null,
        p_server_id: null,
      });

      if (error) {
        logger.error("[SEAT PARTY API] Database error:", {
          error: error.message,
          table_id,
          venue_id,
        });
        return NextResponse.json(
          { 
            success: false, 
            error: "Failed to seat party",
            message: process.env.NODE_ENV === "development" ? error.message : "Database operation failed",
          },
          { status: 500 }
        );
      }

      return NextResponse.json({ success: true, data });
    } catch (_error) {
      const errorMessage = _error instanceof Error ? _error.message : "An unexpected error occurred";
      const errorStack = _error instanceof Error ? _error.stack : undefined;
      
      logger.error("[SEAT PARTY API] Unexpected error:", {
        error: errorMessage,
        stack: errorStack,
      });
      
      // Check if it's an authentication/authorization error
      if (errorMessage.includes("Unauthorized") || errorMessage.includes("Forbidden")) {
        return NextResponse.json(
          {
            success: false,
            error: errorMessage.includes("Unauthorized") ? "Unauthorized" : "Forbidden",
            message: errorMessage,
          },
          { status: errorMessage.includes("Unauthorized") ? 401 : 403 }
        );
      }
      
      // Return generic error in production, detailed in development
      return NextResponse.json(
        {
          success: false,
          error: "Internal Server Error",
          message: process.env.NODE_ENV === "development" ? errorMessage : "An unexpected error occurred while seating the party",
          ...(process.env.NODE_ENV === "development" && errorStack ? { stack: errorStack } : {}),
        },
        { status: 500 }
      );
    }
  },
  {
    // Extract venueId from body (venue_id field)
    extractVenueId: async (req) => {
      try {
        const body = await req.json();
        return body?.venue_id || body?.venueId || null;
      } catch {
        return null;
      }
    },
  }
);
