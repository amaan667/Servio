/**
 * Entitlement Guards - Server-side enforcement of tier entitlements
 * All guards return standardized API errors and enforce business rules
 */

import { createAdminClient } from "@/lib/supabase";
import { z } from "zod";
import type {
  VenueEntitlements,
  MaxCountCheckResult,
  Tier
} from "@/types/entitlements";

// Zod schema for strict entitlement contract validation
const VenueEntitlementsSchema = z.object({
  tier: z.enum(["starter", "pro", "enterprise"]),

    mode: z.enum(["single", "multi", "enterprise"]).nullable(),
  }),

    level: z.enum(["basic", "advanced", "enterprise"]),

  }),

    level: z.enum(["basic", "full", "white_label"]),

  }),

    level: z.enum(["light", "full"]).nullable(),
  }),

    level: z.enum(["email", "priority", "sla"]),
  }),
}).strict(); // No extra properties allowed

/**
 * Get venue entitlements from database with strict validation
 */
export async function getVenueEntitlements(venueId: string): Promise<VenueEntitlements | null> {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase.rpc("get_venue_entitlements", {

    if (error) {
      
      return null;
    }

    // STRICT CONTRACT VALIDATION: Fail closed if schema doesn't match exactly
    const validationResult = VenueEntitlementsSchema.safeParse(data);
    if (!validationResult.success) {
      
      // FAIL CLOSED: Return null to deny all entitlements
      return null;
    }

    // Normalize null = unlimited for consistency
    const entitlements = validationResult.data;
    return {
      ...entitlements,
      maxStaff: entitlements.maxStaff ?? -1, // -1 means unlimited

    };
  } catch (error) {

    return null;
  }
}

/**
 * Require a specific entitlement feature
 */
export async function requireEntitlement(

  userId?: string // Optional for logging
): Promise<{ allowed: boolean; message?: string; requiredTier?: string; currentTier?: string }> {
  try {
    const entitlements = await getVenueEntitlements(venueId);
    if (!entitlements) {
      return {

      };
    }

    const result = checkEntitlement(entitlements, feature);

    if (!result.allowed) {
      
    }

    return {

    };
  } catch (error) {

    return {

    };
  }
}

/**
 * Check resource count limits with enforcement
 */
export async function requireMaxCount(
  context: { venueId: string; user: { id: string } },

      };
    }

    let limit: number | null = null;
    let resourceName: string;
    let tierLabel = entitlements.tier;

    switch (resource) {
      case "staff":
        limit = entitlements.maxStaff;
        resourceName = "staff member";
        break;
      case "tables":
        limit = entitlements.maxTables;
        resourceName = "table";
        break;
      case "locations":
        limit = entitlements.maxLocations;
        resourceName = "location";
        break;
      case "kds_stations":
        // HARD KDS MODE ENFORCEMENT
        if (!entitlements.kds.enabled) {
          limit = 0;
          resourceName = "KDS station";
        } else {
          // Strict mode-based limits
          switch (entitlements.kds.mode) {
            case "single":
              limit = 1; // Starter + addon: exactly 1 station
              resourceName = "KDS station (Starter + add-on allows 1 station only)";
              break;
            case "multi":
              limit = null; // Pro: unlimited stations
              resourceName = "KDS station";
              break;
            case "enterprise":
              limit = null; // Enterprise: unlimited stations + enterprise features
              resourceName = "KDS station";
              break;

          }
        }
        break;
    }

    const allowed = limit === null || currentCount <= limit;

    if (!allowed) {
      
    }

    return {
      allowed,
      limit,

        : `Cannot create more than ${limit} ${resourceName}${limit === 1 ? '' : 's'} on ${tierLabel} plan`,
    };
  } catch (error) {

    return {

    };
  }
}

/**
 * Require minimum tier level
 */
export async function requireTierAtLeast(

  userId?: string
): Promise<{ allowed: boolean; message?: string; currentTier?: string }> {
  try {
    const entitlements = await getVenueEntitlements(venueId);
    if (!entitlements) {
      return {

      };
    }

    const tierHierarchy: Record<Tier, number> = {

    };

    const currentLevel = tierHierarchy[entitlements.tier as Tier] ?? 0;
    const requiredLevel = tierHierarchy[requiredTier] ?? 0;

    const allowed = currentLevel >= requiredLevel;

    if (!allowed) {
      
    }

    return {
      allowed,

        : `This feature requires ${requiredTier} plan or higher. Current plan: ${entitlements.tier}`,

    };
  } catch (error) {

    return {

    };
  }
}

/**
 * Internal helper to check specific entitlements
 */
function checkEntitlement(entitlements: VenueEntitlements, feature: string): { allowed: boolean; message?: string; requiredTier?: string } {
  switch (feature) {
    case "kds.enabled":
      return {

      };

    case "analytics.csvExport":
      return {

      };

    case "analytics.financeExport":
      return {

      };

    case "branding.customDomain":
      return {

      };

    case "api.enabled":
      return {

      };

      const entitlementValue = (entitlements as unknown as Record<string, unknown>)[feature];
      if (typeof entitlementValue === "boolean") {
        return {

          message: entitlementValue ? undefined : `Feature not available on ${entitlements.tier} plan`,
        };
      }
      return {

        message: `Unknown entitlement feature: ${feature}`,
      };
  }
}