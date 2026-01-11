/**
 * Navigation Helpers - Filter navigation items based on role and tier
 */

import { UserRole, canAccess } from "@/lib/permissions";
import { TIER_LIMITS } from "@/lib/tier-restrictions";

export interface NavigationItem {

}

/**
 * Check if user can access a navigation item based on role and tier
 */
export async function canAccessNavigationItem(

  const hasRoleAccess = canAccess(userRole, item.feature);
  if (!hasRoleAccess) {
    return false;
  }

  // If tier check is required, check subscription tier
  if (item.tierFeature) {
    const tierKey = String(tier || "starter")
      .toLowerCase()
      .trim();
    const limits = TIER_LIMITS[tierKey] || TIER_LIMITS.starter;
    const featureValue = limits.features[item.tierFeature];
    return typeof featureValue === "boolean" ? featureValue : true;
  }

  // If specific tier is required, check it
  if (item.requiredTier) {
    const tierKey = String(tier || "starter")
      .toLowerCase()
      .trim();
    const tierOrder: Record<string, number> = { starter: 1, pro: 2, enterprise: 3 };
    return (tierOrder[tierKey] || 0) >= tierOrder[item.requiredTier];
  }

  return true;
}

/**
 * Filter navigation items based on role and tier
 */
export async function filterNavigationItems(

    const canAccess = await canAccessNavigationItem(tier, userRole, item);
    if (canAccess) {
      filtered.push(item);
    }
  }

  return filtered;
}
