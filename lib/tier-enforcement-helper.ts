/**
 * Tier Enforcement Helper
 * Provides utilities to enforce tier restrictions across the platform
 */

import { UserRole } from "@/lib/permissions";
import { TIER_LIMITS, type TierLimits } from "@/lib/tier-restrictions";
import { checkAccessByTier } from "@/lib/access-control";

/**
 * Check if user can export data (CSV, etc.)
 * Exports require Pro+ tier (Pro has CSV exports, Enterprise has CSV + financial exports)
 */
export async function canExportData(tier: string, userRole: UserRole): Promise<boolean> {
  // Also check role permission
  const access = checkAccessByTier(userRole, tier, "analytics", "analytics");
  const tierKey = String(tier).toLowerCase().trim();
  // Pro and Enterprise both have exports (Pro = CSV, Enterprise = CSV + financial)
  return access.allowed && (tierKey === "pro" || tierKey === "enterprise");
}

/**
 * Check if user can access a feature with both role and tier checks
 */
export async function canAccessFeature(
  tier: string,
  userRole: UserRole,
  feature: string,
  tierFeature?: keyof import("@/lib/tier-restrictions").TierLimits["features"]
): Promise<{ allowed: boolean; reason?: string; currentTier?: string; requiredTier?: string }> {
  return checkAccessByTier(userRole, tier, feature, tierFeature);
}

/**
 * Check if user can create a resource (staff, table, etc.)
 */
export async function canCreateResource(
  tier: string,
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

  const tierKey = String(tier || "starter")
    .toLowerCase()
    .trim();
  const limits: TierLimits = TIER_LIMITS[tierKey] || TIER_LIMITS.starter;
  const limit = limits[limitType];

  // -1 means unlimited
  const allowed = limit === -1 || currentCount < limit;
  return {
    allowed,
    reason: allowed ? undefined : `Limit reached: ${currentCount}/${limit}`,
    limit,
    currentTier: tierKey,
  };
}
