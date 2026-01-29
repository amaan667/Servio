// Middleware helpers for enforcing tier limits in API routes
import { NextResponse } from "next/server";
import { TIER_LIMITS } from "./tier-restrictions";
import { createClient } from "./supabase";

interface TierCheckResult {
  allowed: boolean;
  response?: NextResponse;
  tier?: string;
}

/**
 * Check if user can create more of a resource type
 * Returns error response if limit exceeded
 * REQUIRES headers from middleware - no fallback
 */
export async function enforceResourceLimit(
  _userId: string,
  _venueId: string,
  resourceType: "maxMenuItems" | "maxTables" | "maxStaff" | "maxVenues",
  currentCount: number,
  requestHeaders: Headers
): Promise<TierCheckResult> {
  // REQUIRE headers - no fallback
  if (!requestHeaders) {
    return {
      allowed: false,
      response: NextResponse.json(
        {
          error: "Access denied",
          message: "Unable to verify subscription tier",
        },
        { status: 403 }
      ),
    };
  }

  const headerTier = requestHeaders.get("x-user-tier");
  if (!headerTier || !["starter", "pro", "enterprise"].includes(headerTier)) {
    return {
      allowed: false,
      response: NextResponse.json(
        {
          error: "Access denied",
          message: "Unable to verify subscription tier",
        },
        { status: 403 }
      ),
    };
  }

  const tier = headerTier;

  const tierLimits = TIER_LIMITS[tier];
  if (!tierLimits) {
    return {
      allowed: false,
      response: NextResponse.json(
        {
          error: "Invalid tier",
          currentTier: tier,
        },
        { status: 403 }
      ),
    };
  }

  const limit = tierLimits[resourceType];
  // -1 means unlimited
  const allowed = typeof limit === "number" ? limit === -1 || currentCount < limit : false;

  if (!allowed) {
    const resourceName = resourceType.replace("max", "").toLowerCase();
    return {
      allowed: false,
      response: NextResponse.json(
        {
          error: `Limit reached: ${currentCount}/${typeof limit === "number" ? limit : 0} ${resourceName}`,
          currentTier: tier,
          limit: typeof limit === "number" ? limit : 0,
          upgradeRequired: true,
          message: `Upgrade your plan to add more ${resourceName}`,
        },
        { status: 403 }
      ),
      tier,
    };
  }

  return { allowed: true, tier };
}

/**
 * Check if user can access a feature
 * Returns error response if feature not available in tier
 * REQUIRES headers from middleware - no fallback
 */
export async function enforceFeatureAccess(
  _userId: string,
  _venueId: string,
  feature: "kds" | "inventory" | "analytics" | "aiAssistant" | "multiVenue",
  requestHeaders: Headers
): Promise<TierCheckResult> {
  // REQUIRE headers - no fallback
  if (!requestHeaders) {
    return {
      allowed: false,
      response: NextResponse.json(
        {
          error: "Access denied",
          message: "Unable to verify subscription tier",
        },
        { status: 403 }
      ),
    };
  }

  const headerTier = requestHeaders.get("x-user-tier");
  if (!headerTier || !["starter", "pro", "enterprise"].includes(headerTier)) {
    return {
      allowed: false,
      response: NextResponse.json(
        {
          error: "Access denied",
          message: "Unable to verify subscription tier",
        },
        { status: 403 }
      ),
    };
  }

  const tier = headerTier;

  const tierLimits = TIER_LIMITS[tier];
  if (!tierLimits) {
    return {
      allowed: false,
      response: NextResponse.json(
        {
          error: "Invalid tier",
          currentTier: tier,
        },
        { status: 403 }
      ),
    };
  }

  // Feature key (no legacy mapping needed for these features)
  const featureKey = feature;
  const featureValue = tierLimits.features[featureKey as keyof typeof tierLimits.features];

  // For KDS tier (basic/advanced/enterprise), return true if not false
  if (feature === "kds" || featureKey === "kds") {
    const allowed = featureValue !== false;
    if (!allowed) {
      return {
        allowed: false,
        response: NextResponse.json(
          {
            error: `This feature requires Pro tier or higher`,
            currentTier: tier,
            requiredTier: "pro",
            upgradeRequired: true,
            message: `Upgrade to Pro to access ${feature}`,
          },
          { status: 403 }
        ),
        tier,
      };
    }
    return { allowed: true, tier };
  }

  // For boolean features, return the value directly
  if (typeof featureValue === "boolean") {
    if (!featureValue) {
      return {
        allowed: false,
        response: NextResponse.json(
          {
            error: `This feature requires Enterprise tier`,
            currentTier: tier,
            requiredTier: "enterprise",
            upgradeRequired: true,
            message: `Upgrade to Enterprise to access ${feature}`,
          },
          { status: 403 }
        ),
        tier,
      };
    }
    return { allowed: true, tier };
  }

  // For analytics and supportLevel, they're always allowed (just different levels)
  return { allowed: true, tier };
}

/**
 * Helper to get organization for a venue
 */
export async function getVenueOrganization(venueId: string) {
  const supabase = await createClient();

  const { data: venue } = await supabase
    .from("venues")
    .select("organization_id, organizations(*)")
    .eq("venue_id", venueId)
    .single();

  // Handle organizations as single object (foreign key relation)
  const organization =
    venue?.organizations &&
    (Array.isArray(venue.organizations) ? venue.organizations[0] : venue.organizations);

  return organization || null;
}
