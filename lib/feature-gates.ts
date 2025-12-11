import { errorToContext } from "@/lib/utils/error-to-context";

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

import { createClient } from "@/lib/supabase";
import { logger } from "@/lib/logger";

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
 * Check if a venue has access to a specific feature
 * Fetches tier from organization (which is synced from Stripe)
 */
export async function checkFeatureAccess(
  venueId: string,
  requiredTier: SubscriptionTier
): Promise<FeatureAccess> {
  try {
    const supabase = await createClient();

    // Get venue to find owner_user_id
    const { data: venue, error: venueError } = await supabase
      .from("venues")
      .select("owner_user_id")
      .eq("venue_id", venueId)
      .single();

    if (venueError || !venue?.owner_user_id) {
      logger.error("[FEATURE GATE] Error fetching venue:", errorToContext(venueError));
      // Deny access if we can't verify tier (fail secure)
      return {
        hasAccess: false,
        tier: "starter",
        requiredTier,
        message: "Unable to verify subscription tier. Please contact support.",
      };
    }

    // Get organization tier from owner_user_id (synced from Stripe)
    const { data: org, error: orgError } = await supabase
      .from("organizations")
      .select("subscription_tier, subscription_status")
      .eq("owner_user_id", venue.owner_user_id)
      .single();

    if (orgError || !org) {
      logger.error("[FEATURE GATE] Error fetching organization:", errorToContext(orgError));
      // Deny access if we can't verify tier (fail secure)
      return {
        hasAccess: false,
        tier: "starter",
        requiredTier,
        message: "Unable to verify subscription tier. Please contact support.",
      };
    }

    // Get tier from organization (should be synced from Stripe)
    let currentTier: SubscriptionTier = "starter";
    const tierFromDb = org.subscription_tier?.toLowerCase().trim();

    // Validate tier is one of the valid values
    if (tierFromDb && ["starter", "pro", "enterprise"].includes(tierFromDb)) {
      currentTier = tierFromDb as SubscriptionTier;
    } else {
      logger.warn("[FEATURE GATE] Invalid tier in database, defaulting to starter", {
        venueId,
        tierFromDb,
        ownerUserId: venue.owner_user_id,
      });
      currentTier = "starter";
    }

    // Check subscription status - if not active, restrict to starter features
    if (org.subscription_status !== "active" && org.subscription_status !== "trialing") {
      logger.warn("[FEATURE GATE] Subscription not active, restricting to starter tier", {
        venueId,
        subscriptionStatus: org.subscription_status,
      });
      currentTier = "starter";
    }

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
    logger.error("[FEATURE GATE] Unexpected error:", errorToContext(_error));
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
    logger.error("[FEATURE GATE CLIENT] Error:", errorToContext(_error));
    // Fail secure - deny access on error
    return {
      hasAccess: false,
      tier: "starter",
      message: "Unable to verify feature access. Please contact support.",
    };
  }
}
