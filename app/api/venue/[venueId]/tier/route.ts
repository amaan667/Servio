import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { logger } from "@/lib/logger";
import { withUnifiedAuth } from '@/lib/auth/unified-auth';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';

export const GET = withUnifiedAuth(
  async (
    req: NextRequest,
    context: { params: Promise<{ venueId: string }>; venueId: string; user: { id: string } }
  ) => {
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
      const { venueId } = await context.params;

      // STEP 3: Parse request
      // STEP 4: Validate inputs
      if (!venueId) {
        return NextResponse.json({ error: "Venue ID is required" }, { status: 400 });
      }

      // STEP 5: Security - Verify venue access (already done by withUnifiedAuth)

      // STEP 6: Business logic
      const supabase = await createAdminClient();

      // Get venue with organization data
      const { data: venue, error: venueError } = await supabase
        .from("venues")
        .select(
          `
          venue_id,
          venue_name,
          organization_id,
          organizations (
            id,
            subscription_tier,
            subscription_status
          )
        `
        )
        .eq("venue_id", venueId)
        .single();

      if (venueError || !venue) {
        logger.error("[VENUE TIER GET] Venue not found:", {
          venueId,
          error: venueError,
          userId: context.user.id,
        });
        return NextResponse.json(
          {
            tier: "starter",
            status: "active",
          },
          { status: 200 }
        );
      }

      const organization = Array.isArray(venue.organizations)
        ? venue.organizations[0]
        : venue.organizations;

      // STEP 7: Return success response
      return NextResponse.json({
        tier: organization?.subscription_tier || "starter",
        status: organization?.subscription_status || "active",
      });
    } catch (_error) {
      const errorMessage = _error instanceof Error ? _error.message : "An unexpected error occurred";
      const errorStack = _error instanceof Error ? _error.stack : undefined;
      
      logger.error("[VENUE TIER GET] Unexpected error:", {
        error: errorMessage,
        stack: errorStack,
        venueId: context.venueId,
        userId: context.user.id,
      });
      
      if (errorMessage.includes("Unauthorized") || errorMessage.includes("Forbidden")) {
        return NextResponse.json(
          {
            tier: "starter",
            status: "active",
            error: errorMessage.includes("Unauthorized") ? "Unauthorized" : "Forbidden",
          },
          { status: errorMessage.includes("Unauthorized") ? 401 : 403 }
        );
      }
      
      return NextResponse.json(
        {
          tier: "starter",
          status: "active",
        },
        { status: 200 }
      );
    }
  },
  {
    // Extract venueId from URL params
    extractVenueId: async (req, context) => {
      try {
        if (context?.params) {
          const { venueId } = await context.params;
          return venueId;
        }
        return null;
      } catch {
        return null;
      }
    },
  }
);
