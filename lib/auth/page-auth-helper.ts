/**
 * Page auth: middleware only (Supabase). No per-page RPC for dashboard.
 *
 * SINGLE SOURCE OF TRUTH: All dashboard pages use requirePageAuth(venueId)
 *
 * Architecture:
 * 1. Middleware calls get_access_context RPC ONCE and sets headers:
 *    - x-user-id, x-user-email, x-user-tier, x-user-role, x-venue-id
 * 2. Pages call requirePageAuth(venueId) which:
 *    - Reads headers (no duplicate RPC calls)
 *    - Validates venueId matches headers (security)
 *    - Optionally checks role/feature requirements
 *
 * CRITICAL: No redirects. Returns null on auth failure.
 * All pages should use requirePageAuth(venueId) for consistency.
 */

import { headers } from "next/headers";
import { cache } from "react";
import { TIER_LIMITS } from "@/lib/tier-restrictions";
import type { UserRole } from "@/lib/permissions";

export type { UserRole };

export type Tier = "starter" | "pro" | "enterprise";

export type FeatureKey =
  | "kds"
  | "inventory"
  | "analytics"
  | "customerFeedback"
  | "loyaltyTracking"
  | "branding"
  | "customBranding"
  | "apiAccess"
  | "aiAssistant"
  | "multiVenue"
  | "customIntegrations";

export interface PageAuthContext {
  user: { id: string; email?: string | null };
  venueId: string;
  role: UserRole;
  tier: Tier;
  hasFeatureAccess: (feature: FeatureKey) => boolean;
}

export interface RequirePageAuthOptions {
  requireFeature?: FeatureKey;
  requireRole?: UserRole[];
  allowNoVenue?: boolean;
}

function buildHasFeatureAccess(tier: Tier): (feature: FeatureKey) => boolean {
  const tierLimits = TIER_LIMITS[tier];
  if (!tierLimits) return () => false;
  return (feature: FeatureKey) => {
    const key = feature === "customBranding" ? "branding" : feature;
    const v = tierLimits.features[key as keyof typeof tierLimits.features];
    if (feature === "kds" || key === "kds") return v !== false;
    if (typeof v === "boolean") return v;
    return true;
  };
}

/** Read auth from middleware-set headers only. No RPC. */
export const getAuthFromMiddlewareHeaders = cache(async (): Promise<PageAuthContext | null> => {
  const h = await headers();
  const userId = h.get("x-user-id");
  const tierHeader = h.get("x-user-tier");
  const roleHeader = h.get("x-user-role");
  const venueIdHeader = h.get("x-venue-id");
  const emailHeader = h.get("x-user-email");

  if (!userId) {
    return null;
  }

  const tier = (tierHeader ?? "starter") as Tier;
  // Default to "owner" (not "viewer") to match the middleware fallback behavior.
  // The middleware already verified the session; if the RPC failed it defaults
  // to "owner". Using "viewer" here previously caused requirePageAuth role
  // checks to reject legitimate owners when headers were partially set.
  const role = (roleHeader ?? "owner") as UserRole;
  const venueId = venueIdHeader ?? "";

  const authContext = {
    user: { id: userId, email: emailHeader ?? null },
    venueId,
    role,
    tier,
    hasFeatureAccess: buildHasFeatureAccess(tier),
  };

  return authContext;
});

/**
 * Page auth: headers only + optional requireRole filter. No per-page RPC.
 * Validates venueId matches headers for security.
 */
export async function requirePageAuth(
  venueId?: string,
  options: RequirePageAuthOptions = {}
): Promise<PageAuthContext | null> {
  const auth = await getAuthFromMiddlewareHeaders();
  if (!auth) {
    return null;
  }

  // Validate venueId matches headers (security check)
  if (venueId && auth.venueId && venueId !== auth.venueId) {
    return null;
  }

  // Use venueId from params if provided, otherwise use header
  const finalVenueId = venueId || auth.venueId;
  if (!finalVenueId && !options.allowNoVenue) {
    return null;
  }

  // Role check
  if (
    options.requireRole &&
    options.requireRole.length > 0 &&
    !options.requireRole.includes(auth.role)
  ) {
    return null;
  }

  // Feature check
  if (options.requireFeature && !auth.hasFeatureAccess(options.requireFeature)) {
    return null;
  }

  // Return auth with validated venueId
  return {
    ...auth,
    venueId: finalVenueId || auth.venueId,
  };
}

/**
 * @deprecated Use requirePageAuth(venueId) instead for consistency
 * This function is kept for backward compatibility only
 */
export async function getOptionalPageAuth(): Promise<PageAuthContext | null> {
  return getAuthFromMiddlewareHeaders();
}
