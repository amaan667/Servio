/**
 * Page auth helper — reads middleware-injected headers.
 *
 * Architecture:
 *   1. Middleware calls get_access_context RPC and, on success, sets:
 *      x-user-id, x-user-email, x-user-tier, x-user-role, x-venue-id
 *   2. Pages call requirePageAuth(venueId) which reads those headers.
 *   3. If the RPC failed the middleware only sets x-user-id.
 *      In that case getAuthFromMiddlewareHeaders returns null and the
 *      page MUST fall back to resolveVenueAccess (direct DB query).
 *
 * CRITICAL: No defaults.  If a header is missing we return null so the
 * caller is forced to verify from the database.  We never fabricate a
 * role or tier.
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

/**
 * Read the FULL auth context from middleware headers.
 * Returns null when ANY of the required fields (userId, role, tier) is
 * missing — this forces callers to resolve from the database instead of
 * using fabricated values.
 */
export const getAuthFromMiddlewareHeaders = cache(async (): Promise<PageAuthContext | null> => {
  const h = await headers();
  const userId = h.get("x-user-id");
  const roleHeader = h.get("x-user-role");
  const tierHeader = h.get("x-user-tier");
  const venueIdHeader = h.get("x-venue-id");
  const emailHeader = h.get("x-user-email");

  // ALL three must be present — the middleware only sets role+tier when
  // the RPC returned verified DB data.
  if (!userId || !roleHeader || !tierHeader) {
    return null;
  }

  const tier = tierHeader as Tier;
  if (!["starter", "pro", "enterprise"].includes(tier)) {
    return null;
  }

  return {
    user: { id: userId, email: emailHeader ?? null },
    venueId: venueIdHeader ?? "",
    role: roleHeader as UserRole,
    tier,
    hasFeatureAccess: buildHasFeatureAccess(tier),
  };
});

/**
 * Read just the user id from middleware headers.
 * This succeeds even when the RPC failed (middleware always sets x-user-id
 * for authenticated users).  Use this to identify the user before calling
 * resolveVenueAccess.
 */
export async function getUserIdFromHeaders(): Promise<string | null> {
  const h = await headers();
  return h.get("x-user-id");
}

/**
 * Require page auth.  Returns the full context when the middleware RPC
 * succeeded, or null otherwise.  Callers should fall back to
 * resolveVenueAccess when this returns null.
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

  return {
    ...auth,
    venueId: finalVenueId || auth.venueId,
  };
}

/**
 * @deprecated Use requirePageAuth(venueId) instead for consistency
 */
export async function getOptionalPageAuth(): Promise<PageAuthContext | null> {
  return getAuthFromMiddlewareHeaders();
}
