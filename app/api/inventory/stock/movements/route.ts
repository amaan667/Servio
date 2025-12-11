import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";
import { logger } from "@/lib/logger";
import { withUnifiedAuth } from "@/lib/auth/unified-auth";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { env, isDevelopment, isProduction, getNodeEnv } from "@/lib/env";

// GET /api/inventory/stock/movements?venue_id=xxx&limit=50&offset=0
export const GET = withUnifiedAuth(
  async (req: NextRequest, context) => {
    try {
      // STEP 1: Rate limiting (ALWAYS FIRST)
      const rateLimitResult = await rateLimit(req, RATE_LIMITS.GENERAL);
      if (!rateLimitResult.success) {
        return NextResponse.json(
          {
            error: "Too many requests",
            message: `Rate limit exceeded. Try again in ${Math.ceil((rateLimitResult.reset - Date.now()) / 1000)} seconds.`,
          },
          { status: 429 }
        );
      }

      // STEP 2: Get venueId from context (already verified)
      const venueId = context.venueId;

      // STEP 3: Parse request
      const { searchParams } = new URL(req.url);
      const limit = parseInt(searchParams.get("limit") || "50");
      const offset = parseInt(searchParams.get("offset") || "0");
      const reason = searchParams.get("reason");

      // STEP 4: Validate inputs
      if (!venueId) {
        return NextResponse.json({ error: "venue_id is required" }, { status: 400 });
      }

      // STEP 5: Security - Verify venue access (already done by withUnifiedAuth)

      // STEP 6: Business logic
      const supabase = await createClient();

      let query = supabase
        .from("stock_ledgers")
        .select(
          `
          *,
          ingredient:ingredients(name, unit),
          user:created_by(email)
        `
        )
        .eq("venue_id", venueId) // Security: always filter by venueId
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);

      if (reason) {
        query = query.eq("reason", reason);
      }

      const { data, error, count } = await query;

      if (error) {
        logger.error("[INVENTORY STOCK MOVEMENTS] Error fetching movements:", {
          error: error instanceof Error ? error.message : "Unknown error",
          venueId,
          userId: context.user.id,
        });
        return NextResponse.json(
          {
            error: "Failed to fetch movements",
            message: isDevelopment() ? error.message : "Database query failed",
          },
          { status: 500 }
        );
      }

      // STEP 7: Return success response
      return NextResponse.json({
        data,
        pagination: {
          limit,
          offset,
          total: count || 0,
        },
      });
    } catch (_error) {
      const errorMessage =
        _error instanceof Error ? _error.message : "An unexpected error occurred";
      const errorStack = _error instanceof Error ? _error.stack : undefined;

      logger.error("[INVENTORY STOCK MOVEMENTS] Unexpected error:", {
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
          message: isDevelopment() ? errorMessage : "Request processing failed",
          ...(isDevelopment() && errorStack ? { stack: errorStack } : {}),
        },
        { status: 500 }
      );
    }
  },
  {
    // Extract venueId from query params
    extractVenueId: async (req) => {
      try {
        const { searchParams } = new URL(req.url);
        return searchParams.get("venue_id") || searchParams.get("venueId");
      } catch {
        return null;
      }
    },
  }
);
