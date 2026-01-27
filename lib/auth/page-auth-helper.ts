/**
 * Page auth: middleware only (Supabase). No per-page RPC for dashboard.
 *
 * Middleware sets x-user-id, x-user-email, x-user-tier, x-user-role, x-venue-id
 * for /dashboard/[venueId]/*. Pages read headers via getAuthFromMiddlewareHeaders.
 *
 * CRITICAL: No redirects. Returns null on auth failure.
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
  if (!userId) return null;

  const tier = (h.get("x-user-tier") ?? "starter") as Tier;
  const role = (h.get("x-user-role") ?? "viewer") as UserRole;
  const venueId = h.get("x-venue-id") ?? "";

  return {
    user: { id: userId, email: h.get("x-user-email") ?? null },
    venueId,
    role,
    tier,
    hasFeatureAccess: buildHasFeatureAccess(tier),
  };
});

/** Page auth: headers only + optional requireRole filter. No per-page RPC. */
export async function requirePageAuth(
  _venueId?: string,
  options: RequirePageAuthOptions = {}
): Promise<PageAuthContext | null> {
  const auth = await getAuthFromMiddlewareHeaders();
  if (!auth) return null;

  if (options.requireRole && options.requireRole.length > 0 && !options.requireRole.includes(auth.role)) {
    return null;
  }

  return auth;
}

/** Alias for getAuthFromMiddlewareHeaders. */
export async function getOptionalPageAuth(): Promise<PageAuthContext | null> {
  return getAuthFromMiddlewareHeaders();
}
