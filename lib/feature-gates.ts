/**
 * Feature Gating System
 *
 * Controls access to premium features based on venue subscription tier.
 *
 * Subscription Tiers:
 * - starter: Up to 10 tables, QR ordering
 * - pro: Up to 20 tables, Full analytics
 * - enterprise: Unlimited tables/venues, KDS, Inventory, Staff management
 */

import { getAccessContext } from "@/lib/access/getAccessContext";

export type SubscriptionTier = "starter" | "pro" | "enterprise";

export interface FeatureAccess {
  hasAccess: boolean;
  tier: SubscriptionTier;
  requiredTier?: SubscriptionTier;
  message?: string;
}

// Premium features that require subscription
export const PREMIUM_FEATURES = {
  INVENTORY: "enterprise" as SubscriptionTier,
  KDS: "enterprise" as SubscriptionTier,
  STAFF_MANAGEMENT: "enterprise" as SubscriptionTier,
  ADVANCED_ANALYTICS: "pro" as SubscriptionTier,
  MULTIPLE_VENUES: "enterprise" as SubscriptionTier,
} as const;

/**
 * Check if a venue has access to a specific feature via get_access_context RPC.
 */
export async function checkFeatureAccess(
  venueId: string,
  requiredTier: SubscriptionTier
): Promise<FeatureAccess> {
  try {
    const accessContext = await getAccessContext(venueId);
    const currentTier = (accessContext?.tier || "starter") as SubscriptionTier;

    const tierHierarchy: Record<SubscriptionTier, number> = {
      starter: 1,
      pro: 2,
      enterprise: 3,
    };

    const hasAccess = tierHierarchy[currentTier] >= tierHierarchy[requiredTier];

    return {
      hasAccess,
      tier: currentTier,
      requiredTier,
      message: hasAccess
        ? undefined
        : `This feature requires ${requiredTier} tier. Your current tier is ${currentTier}.`,
    };
  } catch (_error) {
    // Fail secure - deny access if error
    return {
      hasAccess: false,
      tier: "starter",
      requiredTier,
      message: "Unable to verify subscription tier. Please contact support.",
    };
  }
}

/**
 * Middleware to check feature access and return 403 if not allowed
 */
export async function requireFeatureAccess(
  venueId: string,
  requiredTier: SubscriptionTier
): Promise<{ allowed: true } | { allowed: false; response: Response }> {
  const access = await checkFeatureAccess(venueId, requiredTier);

  if (!access.hasAccess) {
    return {
      allowed: false,
      response: new Response(
        JSON.stringify({
          error: "Feature not available",
          message: access.message,
          currentTier: access.tier,
          requiredTier: access.requiredTier,
        }),
        {
          status: 403,
          headers: { "Content-Type": "application/json" },
        }
      ),
    };
  }

  return { allowed: true };
}

/**
 * Client-side hook to check feature access
 * This should be used in combination with server-side checks
 */
export async function clientCheckFeatureAccess(
  venueId: string,
  feature: keyof typeof PREMIUM_FEATURES
): Promise<FeatureAccess> {
  try {
    const response = await fetch(`/api/features/check?venue_id=${venueId}&feature=${feature}`);
    return await response.json();
  } catch (_error) {
    // Fail secure - deny access on error
    return {
      hasAccess: false,
      tier: "starter",
      message: "Unable to verify feature access. Please contact support.",
    };
  }
}
