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
  maxStaff: z.number().nullable(),
  maxTables: z.number().nullable(),
  maxLocations: z.number().nullable(),
  kds: z.object({
    enabled: z.boolean(),
    mode: z.enum(["single", "multi", "enterprise"]).nullable(),
  }),
  analytics: z.object({
    level: z.enum(["basic", "advanced", "enterprise"]),
    csvExport: z.boolean(),
    financeExport: z.boolean(),
  }),
  branding: z.object({
    level: z.enum(["basic", "full", "white_label"]),
    customDomain: z.boolean(),
  }),
  api: z.object({
    enabled: z.boolean(),
    level: z.enum(["light", "full"]).nullable(),
  }),
  support: z.object({
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
      p_venue_id: venueId,
    });

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
      maxTables: entitlements.maxTables ?? -1,
      maxLocations: entitlements.maxLocations ?? -1,
    };
  } catch (error) {

    return null;
  }
}

/**
 * Require a specific entitlement feature
 */
export async function requireEntitlement(
  venueId: string,
  feature: keyof VenueEntitlements | 'analytics.csvExport' | 'analytics.financeExport' | 'branding.customDomain' | 'api.enabled',
  _userId?: string // Optional for logging
): Promise<{ allowed: boolean; message?: string; requiredTier?: string; currentTier?: string }> {
  try {
    const entitlements = await getVenueEntitlements(venueId);
    if (!entitlements) {
      return {
        allowed: false,
        message: "Unable to verify entitlements - access denied for security",
        currentTier: "unknown",
      };
    }

    const result = checkEntitlement(entitlements, feature);

    if (!result.allowed) { /* Condition handled */ }

    return {
      allowed: result.allowed,
      message: result.message,
      requiredTier: result.requiredTier,
      currentTier: entitlements.tier,
    };
  } catch (error) {

    return {
      allowed: false,
      message: "Error verifying entitlements - access denied for security",
    };
  }
}

/**
 * Check resource count limits with enforcement
 */
export async function requireMaxCount(
  context: { venueId: string; user: { id: string } },
  resource: "staff" | "tables" | "locations" | "kds_stations",
  currentCount: number,
  _maxAllowed: number | null
): Promise<MaxCountCheckResult> {
  try {
    const entitlements = await getVenueEntitlements(context.venueId);
    if (!entitlements) {
      return {
        allowed: false,
        limit: 0,
        currentTier: "unknown",
        message: "Unable to verify entitlements - operation blocked",
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
            default:
              limit = 0;
              resourceName = "KDS station";
          }
        }
        break;
    }

    const allowed = limit === null || currentCount <= limit;

    if (!allowed) { /* Condition handled */ }

    return {
      allowed,
      limit,
      currentTier: tierLabel,
      message: allowed
        ? undefined
        : `Cannot create more than ${limit} ${resourceName}${limit === 1 ? '' : 's'} on ${tierLabel} plan`,
    };
  } catch (error) {

    return {
      allowed: false,
      limit: 0,
      currentTier: "error",
      message: "Error verifying limits - operation blocked for security",
    };
  }
}

/**
 * Require minimum tier level
 */
export async function requireTierAtLeast(
  venueId: string,
  requiredTier: Tier,
  _userId?: string
): Promise<{ allowed: boolean; message?: string; currentTier?: string }> {
  try {
    const entitlements = await getVenueEntitlements(venueId);
    if (!entitlements) {
      return {
        allowed: false,
        message: "Unable to verify tier - access denied",
      };
    }

    const tierHierarchy: Record<Tier, number> = {
      starter: 0,
      pro: 1,
      enterprise: 2,
    };

    const currentLevel = tierHierarchy[entitlements.tier as Tier] ?? 0;
    const requiredLevel = tierHierarchy[requiredTier] ?? 0;

    const allowed = currentLevel >= requiredLevel;

    if (!allowed) { /* Condition handled */ }

    return {
      allowed,
      message: allowed
        ? undefined
        : `This feature requires ${requiredTier.charAt(0).toUpperCase() + requiredTier.slice(1)} plan or higher. Current plan: ${entitlements.tier}`,
      currentTier: entitlements.tier,
    };
  } catch (error) {

    return {
      allowed: false,
      message: "Error verifying tier - access denied for security",
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
        allowed: entitlements.kds.enabled,
        message: entitlements.kds.enabled ? undefined : "KDS is not included in your current plan",
        requiredTier: entitlements.kds.enabled ? undefined : "pro",
      };

    case "analytics.csvExport":
      return {
        allowed: entitlements.analytics.csvExport,
        message: entitlements.analytics.csvExport ? undefined : "CSV exports require Pro plan or higher",
        requiredTier: "pro",
      };

    case "analytics.financeExport":
      return {
        allowed: entitlements.analytics.financeExport,
        message: entitlements.analytics.financeExport ? undefined : "Financial exports require Enterprise plan",
        requiredTier: "enterprise",
      };

    case "branding.customDomain":
      return {
        allowed: entitlements.branding.customDomain,
        message: entitlements.branding.customDomain ? undefined : "Custom domains require Enterprise plan",
        requiredTier: "enterprise",
      };

    case "api.enabled":
      return {
        allowed: entitlements.api.enabled,
        message: entitlements.api.enabled ? undefined : "API access requires Pro plan with add-on or Enterprise plan",
        requiredTier: "pro",
      };

    default:
      // Check if it's a top-level entitlement
      const entitlementValue = (entitlements as unknown as Record<string, unknown>)[feature];
      if (typeof entitlementValue === "boolean") {
        return {
          allowed: entitlementValue,
          message: entitlementValue ? undefined : `Feature not available on ${entitlements.tier} plan`,
        };
      }
      return {
        allowed: false,
        message: `Unknown entitlement feature: ${feature}`,
      };
  }
}