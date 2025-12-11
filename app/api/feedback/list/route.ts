import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { withUnifiedAuth } from "@/lib/auth/unified-auth";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase";
import { isDevelopment } from "@/lib/env";
import { z } from "zod";

export const runtime = "nodejs";

export const POST = withUnifiedAuth(
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
      const { searchParams } = new URL(req.url);
      const limit = z.coerce.number().int().min(1).max(500).catch(100).parse(
        searchParams.get("limit")
      );
      const offset = z.coerce.number().int().min(0).catch(0).parse(
        searchParams.get("offset")
      );

      // STEP 3: Parse request
      // STEP 4: Validate inputs
      if (!venueId) {
        return NextResponse.json(
          {
            ok: false,
            error: "venue_id is required",
          },
          { status: 400 }
        );
      }

      // STEP 5: Security - Verify venue access (already done by withUnifiedAuth)

      // STEP 6: Business logic
      const supabase = await createClient();

      // Fetch feedback for orders from this venue
      const { data: feedback, error } = await supabase
        .from("order_feedback")
        .select(
          `
          id,
          created_at,
          rating,
          comment,
          order_id,
          orders!inner(venue_id)
        `
        )
        .eq("orders.venue_id", venueId)
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        logger.error("[FEEDBACK LIST] Error fetching feedback:", {
          error: error instanceof Error ? error.message : "Unknown error",
          venueId,
          userId: context.user.id,
        });
        return NextResponse.json(
          {
            ok: false,
            error: "Failed to fetch feedback",
            message: isDevelopment() ? error.message : "Database query failed",
          },
          { status: 500 }
        );
      }

      // Transform the data to match the expected format
      interface FeedbackRow {
        id: string;
        created_at: string;
        rating: number;
        comment: string | null;
        order_id: string;
        orders: { venue_id: string };
      }
      const transformedFeedback =
        (feedback as unknown as FeedbackRow[])?.map((f) => ({
          id: f.id,
          created_at: f.created_at,
          rating: f.rating,
          comment: f.comment,
          order_id: f.order_id,
        })) || [];

      // STEP 7: Return success response
      return NextResponse.json({
        ok: true,
        feedback: transformedFeedback,
        pagination: {
          limit,
          offset,
          returned: transformedFeedback.length,
          hasMore: transformedFeedback.length === limit,
        },
      });
    } catch (_error) {
      const errorMessage =
        _error instanceof Error ? _error.message : "An unexpected error occurred";
      const errorStack = _error instanceof Error ? _error.stack : undefined;

      logger.error("[FEEDBACK LIST] Unexpected error:", {
        error: errorMessage,
        stack: errorStack,
        venueId: context.venueId,
        userId: context.user.id,
      });

      if (errorMessage.includes("Unauthorized") || errorMessage.includes("Forbidden")) {
        return NextResponse.json(
          {
            ok: false,
            error: errorMessage.includes("Unauthorized") ? "Unauthorized" : "Forbidden",
            message: errorMessage,
          },
          { status: errorMessage.includes("Unauthorized") ? 401 : 403 }
        );
      }

      return NextResponse.json(
        {
          ok: false,
          error: "Internal Server Error",
          message: isDevelopment() ? errorMessage : "Request processing failed",
          ...(isDevelopment() && errorStack ? { stack: errorStack } : {}),
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
        return body?.venue_id || body?.venueId || null;
      } catch {
        return null;
      }
    },
  }
);
