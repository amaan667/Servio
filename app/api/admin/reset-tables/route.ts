import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";
import { logger } from "@/lib/logger";
import { withUnifiedAuth } from '@/lib/auth/unified-auth';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';

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

      // STEP 2: Get venueId from context (already verified, may be null)
      const venueId = context.venueId;

      // STEP 3: Parse request
      const body = await req.json();
      const venueIdFromBody = body?.venueId || body?.venue_id;
      const resetType = body?.resetType || "all";
      
      // Use venueId from context or body
      const finalVenueId = venueId || venueIdFromBody;

      // STEP 4: Validate inputs
      // STEP 5: Security - Verify auth (already done by withUnifiedAuth)

      // STEP 6: Business logic
      const supabase = await createClient();

      let result;

      if (resetType === "venue" && finalVenueId) {
        // Delete specific venue tables
        const { data, error } = await supabase.rpc("delete_venue_tables", {
          p_venue_id: finalVenueId,
        });

        if (error) {
          logger.error("[RESET TABLES POST] Venue deletion error:", {
            error: error instanceof Error ? error.message : "Unknown error",
            venueId: finalVenueId,
            userId: context.user.id,
          });
          return NextResponse.json(
            {
              error: error.message,
              message: process.env.NODE_ENV === "development" ? error.message : "Database operation failed",
            },
            { status: 500 }
          );
        }

        result = data;
      } else {
        // Delete all tables
        const { data, error } = await supabase.rpc("manual_table_deletion", {
          p_venue_id: null,
        });

        if (error) {
          logger.error("[RESET TABLES POST] Manual deletion error:", {
            error: error instanceof Error ? error.message : "Unknown error",
            userId: context.user.id,
          });
          return NextResponse.json(
            {
              error: error.message,
              message: process.env.NODE_ENV === "development" ? error.message : "Database operation failed",
            },
            { status: 500 }
          );
        }

        result = data;
      }

      // STEP 7: Return success response
      return NextResponse.json({
        success: true,
        data: result,
      });
    } catch (_error) {
      const errorMessage = _error instanceof Error ? _error.message : "An unexpected error occurred";
      const errorStack = _error instanceof Error ? _error.stack : undefined;
      
      logger.error("[RESET TABLES POST] Unexpected error:", {
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
    // Extract venueId from body or query
    extractVenueId: async (req) => {
      try {
        const { searchParams } = new URL(req.url);
        let venueId = searchParams.get("venueId") || searchParams.get("venue_id");
        if (!venueId) {
          const body = await req.json();
          venueId = body?.venueId || body?.venue_id;
        }
        return venueId;
      } catch {
        return null;
      }
    },
  }
);

// GET endpoint to check reset logs
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

      // STEP 2: Get user from context (already verified)
      // STEP 3: Parse request
      const { searchParams } = new URL(req.url);
      const limit = parseInt(searchParams.get("limit") || "10");

      // STEP 4: Validate inputs
      // STEP 5: Security - Verify auth (already done by withUnifiedAuth)

      // STEP 6: Business logic
      const supabase = await createClient();

      // Get recent deletion logs
      const { data, error } = await supabase
        .from("table_deletion_logs")
        .select("*")
        .order("deletion_timestamp", { ascending: false })
        .limit(limit);

      if (error) {
        logger.error("[RESET TABLES GET] Reset logs error:", {
          error: error instanceof Error ? error.message : "Unknown error",
          userId: context.user.id,
        });
        return NextResponse.json(
          {
            error: error.message,
            message: process.env.NODE_ENV === "development" ? error.message : "Database query failed",
          },
          { status: 500 }
        );
      }

      // STEP 7: Return success response
      return NextResponse.json({
        success: true,
        data: data || [],
      });
    } catch (_error) {
      const errorMessage = _error instanceof Error ? _error.message : "An unexpected error occurred";
      const errorStack = _error instanceof Error ? _error.stack : undefined;
      
      logger.error("[RESET TABLES GET] Unexpected error:", {
        error: errorMessage,
        stack: errorStack,
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
