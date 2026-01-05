import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { withUnifiedAuth } from "@/lib/auth/unified-auth";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { apiErrors } from "@/lib/api/standard-response";

export const GET = withUnifiedAuth(
  async (req: NextRequest, context, routeParams?: { params?: Promise<Record<string, string>> }) => {
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

      // Also try to get from route params if not in context
      let finalVenueId: string | null = venueId;
      if (!finalVenueId && routeParams?.params) {
        const params = await routeParams.params;
        finalVenueId = (params?.venueId as string) || null;
      }

      // STEP 3: Parse request
      // STEP 4: Validate inputs
      if (!finalVenueId) {
        return apiErrors.badRequest("Venue ID is required");
      }

      // STEP 5: Security - Verify venue access (already done by withUnifiedAuth)

      // STEP 6: Business logic
      // Tier information is already available in the unified context from get_access_context RPC
      // No need for additional database queries - this eliminates duplicate calls

      logger.info("[VENUE TIER GET] Using unified access context", {
        venueId: finalVenueId,
        tier: context.tier,
        userId: context.user.id,
      });

      // STEP 7: Return success response
      return NextResponse.json({
        tier: context.tier,
        status: "active", // Status is handled by the RPC logic (inactive subscriptions return 'starter' tier)
      });
    } catch (_error) {
      const errorMessage =
        _error instanceof Error ? _error.message : "An unexpected error occurred";
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
    extractVenueId: async (_req, routeParams) => {
      try {
        if (routeParams?.params) {
          const params = await routeParams.params;
          return params?.venueId || null;
        }
        return null;
      } catch {
        return null;
      }
    },
  }
);
