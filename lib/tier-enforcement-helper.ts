/**
 * Tier Enforcement Helper
 * Provides utilities to enforce tier restrictions across the platform
 */

import { UserRole } from "@/lib/permissions";
import { checkLimit, hasAnalyticsExports } from "@/lib/tier-restrictions";
import { checkAccess } from "@/lib/access-control";

/**
 * Check if user can export data (CSV, etc.)
 * Exports require Enterprise tier
 */
export async function canExportData(userId: string, userRole: UserRole): Promise<boolean> {
  const hasExports = await hasAnalyticsExports(userId);
  if (!hasExports) {
    return false;
  }

  // Also check role permission
  const access = await checkAccess(userId, userRole, "analytics", "analytics");
  return access.allowed && hasExports;
}

/**
 * Check if user can access a feature with both role and tier checks
 */
export async function canAccessFeature(
  userId: string,
  userRole: UserRole,
  feature: string,
  tierFeature?: keyof import("@/lib/tier-restrictions").TierLimits["features"]
): Promise<{ allowed: boolean; reason?: string; currentTier?: string; requiredTier?: string }> {
  return checkAccess(userId, userRole, feature, tierFeature);
}

/**
 * Check if user can create a resource (staff, table, etc.)
 */
export async function canCreateResource(
  userId: string,
  resourceType: "staff" | "table" | "menuItem",
  currentCount: number
): Promise<{ allowed: boolean; reason?: string; limit?: number; currentTier?: string }> {
  const limitTypeMap: Record<string, "maxStaff" | "maxTables" | "maxMenuItems"> = {
    staff: "maxStaff",
    table: "maxTables",
    menuItem: "maxMenuItems",
  };

  const limitType = limitTypeMap[resourceType];
  if (!limitType) {
    return { allowed: false, reason: "Invalid resource type" };
  }

  const limitCheck = await checkLimit(userId, limitType, currentCount);
  return {
    allowed: limitCheck.allowed,
    reason: limitCheck.allowed ? undefined : `Limit reached: ${currentCount}/${limitCheck.limit}`,
    limit: limitCheck.limit,
    currentTier: limitCheck.currentTier,
  };
}
