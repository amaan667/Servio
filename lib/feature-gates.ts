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

import { getAccessContext } from "@/lib/access/getAccessContext";

export type SubscriptionTier = "starter" | "pro" | "enterprise";

export interface FeatureAccess {

}

// Premium features that require subscription
export const PREMIUM_FEATURES = {

} as const;

/**
 * Check if a venue has access to a specific feature
 * Fetches tier from organization (which is synced from Stripe)
 */
export async function checkFeatureAccess(

        requiredTier,

      };
    }

    // Get tier from access context (already validated and synced)
    const currentTier = accessContext.tier as SubscriptionTier;

    const tierHierarchy: Record<SubscriptionTier, number> = {

    };

    const hasAccess = tierHierarchy[currentTier] >= tierHierarchy[requiredTier];

    return {
      hasAccess,

      requiredTier,

        : `This feature requires ${requiredTier} tier. Your current tier is ${currentTier}.`,
    };
  } catch (_error) {
    );
    // Fail secure - deny access if error
    return {

      requiredTier,

    };
  }
}

/**
 * Middleware to check feature access and return 403 if not allowed
 */
export async function requireFeatureAccess(

): Promise<{ allowed: true } | { allowed: false; response: Response }> {
  const access = await checkFeatureAccess(venueId, requiredTier);

  if (!access.hasAccess) {
    return {

        }),
        {

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

    const response = await fetch(`/api/features/check?venue_id=${venueId}&feature=${feature}`);
    return await response.json();
  } catch (_error) {
    );
    // Fail secure - deny access on error
    return {

    };
  }
}
