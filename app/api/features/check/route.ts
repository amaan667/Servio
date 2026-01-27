import { NextRequest } from "next/server";
import { checkFeatureAccess, PREMIUM_FEATURES } from "@/lib/feature-gates";

import { createUnifiedHandler } from "@/lib/api/unified-handler";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { success, apiErrors } from "@/lib/api/standard-response";
import { z } from "zod";

const featureCheckSchema = z.object({
  feature: z.string(),
});

// GET /api/features/check?venue_id=xxx&feature=INVENTORY
export const GET = createUnifiedHandler(
  async (req: NextRequest, context) => {
    // Get venueId from context (already verified)
    const venueId = context.venueId;

    // Parse request
    const { searchParams } = new URL(req.url);
    const feature = searchParams.get("feature") as keyof typeof PREMIUM_FEATURES;

    // Validate inputs
    if (!venueId || !feature) {
      return apiErrors.badRequest("venue_id and feature are required");
    }

    if (!(feature in PREMIUM_FEATURES)) {
      return apiErrors.badRequest("Invalid feature");
    }

    // Business logic
    const requiredTier = PREMIUM_FEATURES[feature];
    const access = await checkFeatureAccess(venueId, requiredTier, req.headers);

    return success(access);
  },
  {
    requireVenueAccess: true,
    venueIdSource: "query",
    rateLimit: RATE_LIMITS.GENERAL,
  }
);
