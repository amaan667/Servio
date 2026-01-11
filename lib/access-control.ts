/**
 * Access Control - Combines Role Permissions and Tier Restrictions
 *
 * This module provides unified access control that checks both:
 * 1. User role permissions (owner, manager, staff, etc.)
 * 2. Subscription tier restrictions (starter, pro, enterprise)
 */

import { UserRole, canAccess as checkRoleAccess } from "@/lib/permissions";
import {
  checkFeatureAccess,
  hasAdvancedAnalytics,
  hasAnalyticsExports,
  TIER_LIMITS,
  type TierLimits,
} from "@/lib/tier-restrictions";

export interface AccessCheckResult {

}

/**
 * Check access using an already-known subscription tier.
 * Use this when you have `tier` from the unified auth context.
 *
 * IMPORTANT: Staff accounts should not change subscription tier. Only `userRole` affects access.
 */
export function checkAccessByTier(

  tierFeature?: keyof TierLimits["features"]
): AccessCheckResult {
  // First check role permissions
  const hasRoleAccess = checkRoleAccess(userRole, feature);
  if (!hasRoleAccess) {
    return {

      reason: `Your role (${userRole}) does not have permission to access this feature`,
      userRole,
    };
  }

  // If tier check is required, check subscription tier
  if (tierFeature) {
    const limits = (tier && typeof tier === "string" ? tier.toLowerCase().trim() : "starter") as
      | "starter"
      | "pro"
      | "enterprise";
    const tierLimits = TIER_LIMITS[limits] || TIER_LIMITS.starter;
    const featureValue = tierLimits?.features?.[tierFeature];
    const allowed = typeof featureValue === "boolean" ? featureValue : true;

    if (!allowed) {
      return {

        userRole,
      };
    }
    return {

      userRole,
    };
  }

  // Role check passed, no tier restriction
  return {

    userRole,
  };
}

/**
 * Check if user has access to a feature considering both role and tier
 */
export async function checkAccess(

  tierFeature?: keyof TierLimits["features"]
): Promise<AccessCheckResult> {
  // First check role permissions
  const hasRoleAccess = checkRoleAccess(userRole, feature);
  if (!hasRoleAccess) {
    return {

      reason: `Your role (${userRole}) does not have permission to access this feature`,
      userRole,
    };
  }

  // If tier check is required, check subscription tier
  if (tierFeature) {
    const tierCheck = await checkFeatureAccess(userId, tierFeature);
    if (!tierCheck.allowed) {
      return {

        reason: `This feature requires ${tierCheck.requiredTier} tier. Your current tier is ${tierCheck.currentTier}`,

        userRole,
      };
    }
    return {

      userRole,
    };
  }

  // Role check passed, no tier restriction
  return {

    userRole,
  };
}

/**
 * Check analytics access with tier differentiation
 */
export async function checkAnalyticsAccess(

  requireAdvanced = false,
  requireExports = false
): Promise<AccessCheckResult> {
  // Check role first
  const hasRoleAccess = checkRoleAccess(userRole, "analytics");
  if (!hasRoleAccess) {
    return {

      reason: `Your role (${userRole}) does not have permission to view analytics`,
      userRole,
    };
  }

  // Get tier via unified access context (requires venueId, so we need to find it)
  // For analytics access, we need venue context - use checkFeatureAccess which handles this
  const tierCheck = await checkFeatureAccess(userId, "analytics");
  const tier = tierCheck.currentTier;

  // Check if exports are required
  if (requireExports) {
    const hasExports = await hasAnalyticsExports(userId);
    if (!hasExports) {
      return {

        userRole,
      };
    }
  }

  // Check if advanced analytics are required
  if (requireAdvanced) {
    const hasAdvanced = await hasAdvancedAnalytics(userId);
    if (!hasAdvanced) {
      return {

        userRole,
      };
    }
  }

  return {

    userRole,
  };
}

/**
 * Check analytics access using an already-known subscription tier.
 * Use this when you have `tier` from the unified auth context.
 *
 * IMPORTANT: Staff accounts should not change subscription tier. Only `userRole` affects access.
 */
export function checkAnalyticsAccessByTier(

  requireAdvanced = false,
  requireExports = false
): AccessCheckResult {
  // Check role first
  const hasRoleAccess = checkRoleAccess(userRole, "analytics");
  if (!hasRoleAccess) {
    return {

      reason: `Your role (${userRole}) does not have permission to view analytics`,
      userRole,
    };
  }

  const tierKey = String(tier || "starter")
    .toLowerCase()
    .trim();
  const limits = TIER_LIMITS[tierKey] || TIER_LIMITS.starter;

  if (requireExports) {
    // Pro and Enterprise both have exports (Pro = CSV, Enterprise = CSV + financial)
    if (limits.features.analytics !== "advanced+exports") {
      return {

        userRole,
      };
    }
  }

  if (requireAdvanced) {
    if (limits.features.analytics === "basic") {
      return {

        userRole,
      };
    }
  }

  return {

    userRole,
  };
}

/**
 * Require access - throws error if access denied
 */
export async function requireAccess(

  tierFeature?: keyof TierLimits["features"]
): Promise<void> {
  const check = await checkAccess(userId, userRole, feature, tierFeature);
  if (!check.allowed) {
    throw new Error(check.reason || "Access denied");
  }
}
