/**
 * getAuthContext — THE single canonical function for auth/role/tier resolution.
 *
 * Every server-side page/layout/API that needs to know who the user is,
 * what role they hold, or what tier the venue subscribes to MUST call
 * this function.  No other path is allowed.
 *
 * Resolution order (first complete result wins):
 *   1. Middleware-injected headers  (x-user-id + x-user-role + x-user-tier)
 *      — fastest, set when the middleware RPC succeeded.
 *   2. Middleware userId header  +  resolveVenueAccess (admin DB query)
 *      — handles the case where middleware authenticated the user but
 *        the get_access_context RPC failed (common on mobile).
 *   3. Cookie-based Supabase server auth  +  resolveVenueAccess
 *      — handles the case where middleware itself could not run or
 *        was skipped.  Server Components can still read cookies via
 *        next/headers.
 *   4. None of the above  →  unauthenticated.
 *
 * Mobile-safe: Step 2 uses the admin client (service-role key) so it
 * never depends on user cookies for the DB query.  As long as the
 * middleware recognised the user (even if the RPC failed), the page
 * will resolve the correct role and tier from the database.
 */

import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { resolveVenueAccess } from "@/lib/auth/resolve-access";
import { normalizeVenueId } from "@/lib/utils/venueId";
import { TIER_LIMITS } from "@/lib/tier-restrictions";
import { logger } from "@/lib/monitoring/structured-logger";

// ── Public types ──────────────────────────────────────────────────────

export type AuthRole = "owner" | "manager" | "staff" | "kitchen" | "server" | "cashier" | "viewer";
export type AuthTier = "starter" | "pro" | "enterprise";
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

export interface AuthContext {
  userId: string | null;
  email: string | null;
  venueId: string | null;
  role: AuthRole | null;
  tier: AuthTier | null;
  isAuthenticated: boolean;
  hasFeatureAccess: (feature: FeatureKey) => boolean;
}

export interface RequiredAuthContext extends AuthContext {
  userId: string;
  venueId: string;
  role: AuthRole;
  tier: AuthTier;
  isAuthenticated: true;
}

// ── Constants ─────────────────────────────────────────────────────────

const VALID_TIERS = new Set<string>(["starter", "pro", "enterprise"]);

const UNAUTHENTICATED: AuthContext = {
  userId: null,
  email: null,
  venueId: null,
  role: null,
  tier: null,
  isAuthenticated: false,
  hasFeatureAccess: () => false,
};

function signInRedirectPath(venueId: string): string {
  return `/sign-in?redirect=/dashboard/${encodeURIComponent(venueId)}`;
}

function forbiddenRedirectPath(venueId: string): string {
  return `/sign-in?reason=forbidden&redirect=/dashboard/${encodeURIComponent(venueId)}`;
}

// ── Helpers ───────────────────────────────────────────────────────────

function buildFeatureChecker(tier: AuthTier): (feature: FeatureKey) => boolean {
  const limits = TIER_LIMITS[tier];
  if (!limits) return () => false;
  return (feature: FeatureKey) => {
    const key = feature === "customBranding" ? "branding" : feature;
    const v = limits.features[key as keyof typeof limits.features];
    if (key === "kds") return v !== false;
    if (typeof v === "boolean") return v;
    return true;
  };
}

// ── Main function (request-level cached) ──────────────────────────────

/**
 * Returns the full auth context for the current request + venue.
 *
 * Call this in Server Components, Server Actions, and Route Handlers.
 * Client Components must receive the result via props or the
 * /api/auth/context endpoint — they must NEVER call this directly.
 */
export const getAuthContext = cache(async (venueId: string): Promise<AuthContext> => {
  const normalized = normalizeVenueId(venueId) ?? venueId;

  // ── Step 1: Full context from middleware headers ─────────────────
  try {
    const h = await headers();
    const hUserId = h.get("x-user-id");
    const hEmail = h.get("x-user-email");
    const hRole = h.get("x-user-role");
    const hTier = h.get("x-user-tier");
    const hVenue = h.get("x-venue-id");

    // Fast path: middleware RPC succeeded and all headers are present.
    if (hUserId && hRole && hTier && VALID_TIERS.has(hTier)) {
      const tier = hTier as AuthTier;
      return {
        userId: hUserId,
        email: hEmail ?? null,
        venueId: hVenue ?? normalized,
        role: hRole as AuthRole,
        tier,
        isAuthenticated: true,
        hasFeatureAccess: buildFeatureChecker(tier),
      };
    }

    // ── Step 2: Middleware set userId but RPC failed ─────────────────
    // This is the most common mobile failure mode: cookies were sent,
    // middleware authenticated the user, but the get_access_context RPC
    // returned incomplete data.  We resolve from the DB using the admin
    // client (no user JWT needed).
    if (hUserId) {
      const resolved = await resolveVenueAccess(hUserId, normalized);
      if (resolved && resolved.role && resolved.tier) {
        const tier = VALID_TIERS.has(resolved.tier) ? (resolved.tier as AuthTier) : null;
        if (!tier) {
          return {
            userId: resolved.userId,
            email: hEmail ?? null,
            venueId: resolved.venueId,
            role: null,
            tier: null,
            isAuthenticated: true,
            hasFeatureAccess: () => false,
          };
        }
        return {
          userId: resolved.userId,
          email: hEmail ?? null,
          venueId: resolved.venueId,
          role: resolved.role as AuthRole,
          tier,
          isAuthenticated: true,
          hasFeatureAccess: buildFeatureChecker(tier),
        };
      }
    }

    // ── Step 3: Cookie-based Supabase server auth ───────────────────
    // Middleware may not have run (e.g. ISR, or a route not covered by
    // the matcher).  Try reading cookies directly in the Server Component.
    const { createServerSupabaseReadOnly } = await import("@/lib/supabase");
    const supabase = await createServerSupabaseReadOnly();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const resolved = await resolveVenueAccess(user.id, normalized);
      if (resolved && resolved.role && resolved.tier) {
        const tier = VALID_TIERS.has(resolved.tier) ? (resolved.tier as AuthTier) : null;
        if (!tier) {
          return {
            userId: user.id,
            email: user.email ?? null,
            venueId: normalized,
            role: null,
            tier: null,
            isAuthenticated: true,
            hasFeatureAccess: () => false,
          };
        }
        return {
          userId: resolved.userId,
          email: user.email ?? null,
          venueId: resolved.venueId,
          role: resolved.role as AuthRole,
          tier,
          isAuthenticated: true,
          hasFeatureAccess: buildFeatureChecker(tier),
        };
      }

      // User is authenticated but has no access to this specific venue.
      return {
        userId: user.id,
        email: user.email ?? null,
        venueId: normalized,
        role: null,
        tier: null,
        isAuthenticated: true,
        hasFeatureAccess: () => false,
      };
    }
  } catch (error) {
    logger.warn("[getAuthContext] resolution failed", {
      venueId: normalized,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  // ── Step 4: Unauthenticated ─────────────────────────────────────
  return { ...UNAUTHENTICATED };
});

/**
 * Enforce dashboard access server-side before any tenant data fetch.
 * Redirects unauthenticated users to sign-in and unauthorized users to forbidden sign-in.
 */
export async function requireDashboardAccess(venueId: string): Promise<RequiredAuthContext> {
  const normalized = normalizeVenueId(venueId) ?? venueId;
  const auth = await getAuthContext(normalized);

  if (!auth.isAuthenticated || !auth.userId) {
    redirect(signInRedirectPath(normalized));
  }

  if (!auth.role || !auth.tier) {
    redirect(forbiddenRedirectPath(normalized));
  }

  const resolvedAuthVenue = auth.venueId ? normalizeVenueId(auth.venueId) ?? auth.venueId : null;
  if (resolvedAuthVenue && resolvedAuthVenue !== normalized) {
    redirect(forbiddenRedirectPath(normalized));
  }

  return {
    ...auth,
    userId: auth.userId,
    venueId: normalized,
    role: auth.role,
    tier: auth.tier,
    isAuthenticated: true,
  };
}
