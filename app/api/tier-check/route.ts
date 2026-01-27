// Tier Check API - Check if user can perform an action
import { NextRequest } from "next/server";
import { TIER_LIMITS, type TierLimits } from "@/lib/tier-restrictions";

import { createUnifiedHandler } from "@/lib/api/unified-handler";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { success, apiErrors } from "@/lib/api/standard-response";
import { z } from "zod";

const tierCheckSchema = z.object({
  action: z.enum(["create", "access"]),
  resource: z.string().optional(),
  currentCount: z.number().optional(),
  venueId: z.string().optional(),
});

export const POST = createUnifiedHandler(
  async (_req: NextRequest, context) => {
    // Get venueId from context or body (already verified)
    const { body } = context;
    const { action, resource, currentCount } = body;
    const finalVenueId = context.venueId || body.venueId;

    // Validate inputs
    if (!finalVenueId) {
      return apiErrors.badRequest("venueId is required");
    }

    // Business logic
    // IMPORTANT: Tier limits and feature gates are based on the venue owner's subscription.
    // The unified handler already computed tier from the billing owner, so all checks
    // below should be purely derived from context.tier (no extra DB reads).
    const tierKey = String(context.tier || "starter")
      .toLowerCase()
      .trim();
    const tierLimits: TierLimits = TIER_LIMITS[tierKey] ?? TIER_LIMITS.starter!;

    // Check based on action type
    if (action === "create" && resource) {
      const limit = tierLimits[resource as keyof TierLimits];
      // -1 means unlimited
      const allowed = typeof limit === "number" ? limit === -1 || (currentCount || 0) < limit : false;

      if (!allowed) {
        return success({
          allowed: false,
          tier: tierKey,
          limit: typeof limit === "number" ? limit : 0,
          current: currentCount || 0,
          reason: `Limit reached: ${currentCount || 0}/${typeof limit === "number" ? limit : 0} ${resource.replace("max", "").toLowerCase()}`,
          upgradeRequired: true,
        });
      }

      return success({
        allowed: true,
        tier: tierKey,
        limit: typeof limit === "number" ? limit : 0,
        current: currentCount || 0,
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

    // Return success response
    return success({
      allowed: true,
      limits: tierLimits,
      tier: tierKey,
    });
  },
  {
    schema: tierCheckSchema,
    requireAuth: true,
    requireVenueAccess: false, // Venue ID can come from body
    rateLimit: RATE_LIMITS.GENERAL,
    extractVenueId: async (req) => {
      try {
        const { searchParams } = new URL(req.url);
        let venueId = searchParams.get("venueId") || searchParams.get("venue_id");
        if (!venueId) {
          const clonedReq = req.clone();
          const body = await clonedReq.json();
          venueId = body?.venueId || body?.venue_id || null;
        }
        return venueId;
      } catch {
        return null;
      }
    },
  }
);
