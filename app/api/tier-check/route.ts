// Tier Check API - Check if user can perform an action
import { NextRequest } from "next/server";
import { TIER_LIMITS, type TierLimits } from "@/lib/tier-restrictions";
import { logger } from "@/lib/logger";
import { withUnifiedAuth } from "@/lib/auth/unified-auth";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { isDevelopment } from "@/lib/env";
import { success, apiErrors } from "@/lib/api/standard-response";

export const POST = withUnifiedAuth(
  async (req: NextRequest, context) => {
    try {
      // STEP 1: Rate limiting (ALWAYS FIRST)
      const rateLimitResult = await rateLimit(req, RATE_LIMITS.GENERAL);
      if (!rateLimitResult.success) {
        return apiErrors.rateLimit(Math.ceil((rateLimitResult.reset - Date.now()) / 1000));
      }

      // STEP 2: Get venueId from context (already verified, may be null)
      const venueId = context.venueId;

      // STEP 3: Parse request
      const body = await req.json();
      const { action, resource, currentCount } = body;
      const finalVenueId = venueId || body.venueId;

      // STEP 4: Validate inputs
      if (!finalVenueId) {
        return apiErrors.badRequest("venueId is required");
      }

      // STEP 5: Security - Verify venue access (already done by withUnifiedAuth)

      // STEP 6: Business logic
      // IMPORTANT: Tier limits and feature gates are based on the venue owner's subscription.
      // `withUnifiedAuth` already computed `context.tier` from the billing owner, so all checks
      // below should be purely derived from `context.tier` (no extra DB reads).
      const tierKey = String(context.tier || "starter")
        .toLowerCase()
        .trim();
      const tierLimits: TierLimits = TIER_LIMITS[tierKey] || TIER_LIMITS.starter;

      // Check based on action type
      if (action === "create" && resource) {
        const limit = tierLimits[resource as keyof TierLimits];
        // -1 means unlimited
        const allowed = typeof limit === "number" ? limit === -1 || currentCount < limit : false;

        if (!allowed) {
          return success({
            allowed: false,
            tier: tierKey,
            limit: typeof limit === "number" ? limit : 0,
            current: currentCount,
            reason: `Limit reached: ${currentCount}/${typeof limit === "number" ? limit : 0} ${resource.replace("max", "").toLowerCase()}`,
            upgradeRequired: true,
          });
        }

        return success({
          allowed: true,
          tier: tierKey,
          limit: typeof limit === "number" ? limit : 0,
          current: currentCount,
        });
      }

      // Check feature access
      if (action === "access" && resource) {
        const featureValue = tierLimits.features[resource as keyof TierLimits["features"]];
        const allowed =
          typeof featureValue === "boolean"
            ? featureValue
            : // Non-boolean features (analytics/supportLevel) are always "allowed"
              true;

        if (!allowed) {
          return success({
            allowed: false,
            tier: tierKey,
            requiredTier: "enterprise",
            reason: "This feature requires a higher tier",
            upgradeRequired: true,
          });
        }

        return success({
          allowed: true,
          tier: tierKey,
        });
      }

      // STEP 7: Return success response
      return success({
        allowed: true,
        limits: tierLimits,
        tier: tierKey,
      });
    } catch (_error) {
      const errorMessage =
        _error instanceof Error ? _error.message : "An unexpected error occurred";
      const errorStack = _error instanceof Error ? _error.stack : undefined;

      logger.error("[TIER CHECK] Unexpected error:", {
        error: errorMessage,
        stack: errorStack,
        venueId: context.venueId,
        userId: context.user.id,
      });

      if (errorMessage.includes("Unauthorized")) {
        return apiErrors.unauthorized(errorMessage);
      }
      if (errorMessage.includes("Forbidden")) {
        return apiErrors.forbidden(errorMessage);
      }

      return apiErrors.internal(
        isDevelopment() ? errorMessage : "Request processing failed",
        isDevelopment() && errorStack ? { stack: errorStack } : undefined
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
