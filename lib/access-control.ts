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
  getUserTier,
  hasAdvancedAnalytics,
  hasAnalyticsExports,
  type TierLimits,
} from "@/lib/tier-restrictions";

export interface AccessCheckResult {
  allowed: boolean;
  reason?: string;
  currentTier?: string;
  requiredTier?: string;
  userRole?: UserRole;
}

/**
 * Check if user has access to a feature considering both role and tier
 */
export async function checkAccess(
  userId: string,
  userRole: UserRole,
  feature: string,
  tierFeature?: keyof TierLimits["features"]
): Promise<AccessCheckResult> {
  // First check role permissions
  const hasRoleAccess = checkRoleAccess(userRole, feature);
  if (!hasRoleAccess) {
    return {
      allowed: false,
      reason: `Your role (${userRole}) does not have permission to access this feature`,
      userRole,
    };
  }

  // If tier check is required, check subscription tier
  if (tierFeature) {
    const tierCheck = await checkFeatureAccess(userId, tierFeature);
    if (!tierCheck.allowed) {
      return {
        allowed: false,
        reason: `This feature requires ${tierCheck.requiredTier} tier. Your current tier is ${tierCheck.currentTier}`,
        currentTier: tierCheck.currentTier,
        requiredTier: tierCheck.requiredTier,
        userRole,
      };
    }
    return {
      allowed: true,
      currentTier: tierCheck.currentTier,
      userRole,
    };
  }

  // Role check passed, no tier restriction
  return {
    allowed: true,
    userRole,
  };
}

/**
 * Check analytics access with tier differentiation
 */
export async function checkAnalyticsAccess(
  userId: string,
  userRole: UserRole,
  requireAdvanced = false,
  requireExports = false
): Promise<AccessCheckResult> {
  // Check role first
  const hasRoleAccess = checkRoleAccess(userRole, "analytics");
  if (!hasRoleAccess) {
    return {
      allowed: false,
      reason: `Your role (${userRole}) does not have permission to view analytics`,
      userRole,
    };
  }

  const tier = await getUserTier(userId);

  // Check if exports are required
  if (requireExports) {
    const hasExports = await hasAnalyticsExports(userId);
    if (!hasExports) {
      return {
        allowed: false,
        reason: "Analytics exports require Enterprise tier",
        currentTier: tier,
        requiredTier: "enterprise",
        userRole,
      };
    }
  }

  // Check if advanced analytics are required
  if (requireAdvanced) {
    const hasAdvanced = await hasAdvancedAnalytics(userId);
    if (!hasAdvanced) {
      return {
        allowed: false,
        reason: "Advanced analytics features require Pro tier or higher",
        currentTier: tier,
        requiredTier: "pro",
        userRole,
      };
    }
  }

  return {
    allowed: true,
    currentTier: tier,
    userRole,
  };
}

/**
 * Require access - throws error if access denied
 */
export async function requireAccess(
  userId: string,
  userRole: UserRole,
  feature: string,
  tierFeature?: keyof TierLimits["features"]
): Promise<void> {
  const check = await checkAccess(userId, userRole, feature, tierFeature);
  if (!check.allowed) {
    throw new Error(check.reason || "Access denied");
  }
}
