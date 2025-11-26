import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";
import { logger } from "@/lib/logger";
import { withUnifiedAuth } from "@/lib/auth/unified-auth";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";

export const POST = withUnifiedAuth(
  async (req: NextRequest, context) => {
    try {
      // STEP 1: Rate limiting (ALWAYS FIRST)
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

      // STEP 2: Get venueId from context (already verified)
      // Note: This is a system route, venueId may be null
      const venueId = context.venueId;

      // STEP 3: Parse request
      // STEP 4: Validate inputs (none required for maintenance)

      // STEP 5: Security - Verify venue access (already done by withUnifiedAuth)

      // STEP 6: Business logic
      const supabase = await createClient();

      // Run the table maintenance function
      const { error } = await supabase.rpc("run_table_maintenance");

      if (error) {
        logger.error("[TABLE MAINTENANCE POST] Error running maintenance:", {
          error: error instanceof Error ? error.message : "Unknown error",
          venueId,
          userId: context.user.id,
        });
        return NextResponse.json(
          {
            error: "Failed to run table maintenance",
            message: process.env.NODE_ENV === "development" ? error.message : "Database operation failed",
          },
          { status: 500 }
        );
      }

      // STEP 7: Return success response
      return NextResponse.json({
        success: true,
        message: "Table maintenance completed successfully",
        timestamp: new Date().toISOString(),
      });
    } catch (_error) {
      const errorMessage = _error instanceof Error ? _error.message : "An unexpected error occurred";
      const errorStack = _error instanceof Error ? _error.stack : undefined;
      
      logger.error("[TABLE MAINTENANCE POST] Unexpected error:", {
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
    // System route - no venue required
    extractVenueId: async () => null,
  }
);

export const GET = withUnifiedAuth(
  async (req: NextRequest, context) => {
    try {
      // STEP 1: Rate limiting (ALWAYS FIRST)
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

      // STEP 2: Get venueId from context (already verified)
      // Note: This is a system route, venueId may be null

      // STEP 3: Parse request
      // STEP 4: Validate inputs (none required)

      // STEP 5: Security - Verify venue access (already done by withUnifiedAuth)

      // STEP 6: Business logic
      const supabase = await createClient();

      // Check for expired reservations
      const { data: expiredReservations, error: expiredError } = await supabase
        .from("table_sessions")
        .select("id, table_id, customer_name, reservation_time, reservation_duration_minutes")
        .eq("status", "RESERVED")
        .not("reservation_time", "is", null)
        .not("reservation_duration_minutes", "is", null);

      if (expiredError) {
        logger.error("[TABLE MAINTENANCE GET] Error fetching expired reservations:", {
          error: expiredError instanceof Error ? expiredError.message : "Unknown error",
          userId: context.user.id,
        });
        return NextResponse.json(
          {
            error: "Failed to fetch expired reservations",
            message: process.env.NODE_ENV === "development" ? expiredError.message : "Database query failed",
          },
          { status: 500 }
        );
      }

      // STEP 7: Return success response
      return NextResponse.json({
        expiredReservations: expiredReservations || [],
        count: expiredReservations?.length || 0,
      });
    } catch (_error) {
      const errorMessage = _error instanceof Error ? _error.message : "An unexpected error occurred";
      const errorStack = _error instanceof Error ? _error.stack : undefined;
      
      logger.error("[TABLE MAINTENANCE GET] Unexpected error:", {
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
    // System route - no venue required
    extractVenueId: async () => null,
  }
);
