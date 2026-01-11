// Middleware helpers for enforcing tier limits in API routes
import { NextResponse } from "next/server";
import { getAccessContext } from "./access/getAccessContext";
import { TIER_LIMITS } from "./tier-restrictions";
import { createClient } from "./supabase";

interface TierCheckResult {

}

/**
 * Check if user can create more of a resource type
 * Returns error response if limit exceeded
 * Uses unified get_access_context RPC for single database call
 */
export async function enforceResourceLimit(

        },
        { status: 403 }
      ),
    };
  }

  const tierLimits = TIER_LIMITS[accessContext.tier];
  if (!tierLimits) {
    return {

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

          error: `Limit reached: ${currentCount}/${typeof limit === "number" ? limit : 0} ${resourceName}`,

          message: `Upgrade your plan to add more ${resourceName}`,
        },
        { status: 403 }
      ),

    };
  }

  return { allowed: true, tier: accessContext.tier };
}

/**
 * Check if user can access a feature
 * Returns error response if feature not available in tier
 * Uses unified get_access_context RPC for single database call
 */
export async function enforceFeatureAccess(

        },
        { status: 403 }
      ),
    };
  }

  const tierLimits = TIER_LIMITS[accessContext.tier];
  if (!tierLimits) {
    return {

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

            message: `Upgrade to Pro to access ${feature}`,
          },
          { status: 403 }
        ),

      };
    }
    return { allowed: true, tier: accessContext.tier };
  }

  // For boolean features, return the value directly
  if (typeof featureValue === "boolean") {
    if (!featureValue) {
      return {

            message: `Upgrade to Enterprise to access ${feature}`,
          },
          { status: 403 }
        ),

      };
    }
    return { allowed: true, tier: accessContext.tier };
  }

  // For analytics and supportLevel, they're always allowed (just different levels)
  return { allowed: true, tier: accessContext.tier };
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
