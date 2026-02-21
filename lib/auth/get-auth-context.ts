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
  let h: Awaited<ReturnType<typeof headers>> | null = null;
  try {
    h = await headers();
  } catch {
    // headers() unavailable (e.g. during static generation)
  }

  const hUserId = h?.get("x-user-id") ?? null;
  const hEmail = h?.get("x-user-email") ?? null;
  const hRole = h?.get("x-user-role") ?? null;
  const hTier = h?.get("x-user-tier") ?? null;
  const hVenue = h?.get("x-venue-id") ?? null;

  // Fast path: middleware resolved everything (headers all present).
  if (hUserId && hRole && hTier && VALID_TIERS.has(hTier)) {
    const tier = hTier as AuthTier;
    return {
      userId: hUserId,
      email: hEmail,
      venueId: hVenue ?? normalized,
      role: hRole as AuthRole,
      tier,
      isAuthenticated: true,
      hasFeatureAccess: buildFeatureChecker(tier),
    };
  }

  // ── Step 2: Middleware set userId but role/tier missing ──────────
  if (hUserId) {
    // 2a. Try RPC via cookie-based client (SECURITY DEFINER bypasses RLS)
    try {
      const { createServerSupabaseReadOnly } = await import("@/lib/supabase");
      const supabase = await createServerSupabaseReadOnly();
      const { data: ctx, error: rpcErr } = await supabase.rpc("get_access_context", {
        p_venue_id: normalized,
      });

      if (!rpcErr && ctx) {
        const rpc = ctx as { user_id?: string; role?: string; tier?: string };
        if (rpc.user_id === hUserId && rpc.role && rpc.tier) {
          const tier = VALID_TIERS.has(rpc.tier.toLowerCase().trim())
            ? (rpc.tier.toLowerCase().trim() as AuthTier)
            : "starter";
          return {
            userId: hUserId,
            email: hEmail,
            venueId: normalized,
            role: rpc.role as AuthRole,
            tier,
            isAuthenticated: true,
            hasFeatureAccess: buildFeatureChecker(tier),
          };
        }
      }
    } catch {
      // RPC unavailable — continue to admin fallback
    }

    // 2b. Admin fallback via resolveVenueAccess (service-role, no RLS)
    try {
      const resolved = await resolveVenueAccess(hUserId, normalized);
      if (resolved?.role && resolved?.tier) {
        const tier = VALID_TIERS.has(resolved.tier) ? (resolved.tier as AuthTier) : "starter";
        return {
          userId: resolved.userId,
          email: hEmail,
          venueId: resolved.venueId,
          role: resolved.role as AuthRole,
          tier,
          isAuthenticated: true,
          hasFeatureAccess: buildFeatureChecker(tier),
        };
      }
      logger.warn("getAuthContext: resolveVenueAccess returned null", {
        userId: hUserId,
        venueId: normalized,
        hadResolved: !!resolved,
        hadRole: !!resolved?.role,
      });
    } catch (err) {
      logger.error("getAuthContext: resolveVenueAccess threw", {
        userId: hUserId,
        venueId: normalized,
        error: err instanceof Error ? err.message : String(err),
      });
    }

    // User IS authenticated (middleware set x-user-id) even if we
    // can't determine their role for this venue — don't downgrade
    // to "unauthenticated".
    return {
      userId: hUserId,
      email: hEmail,
      venueId: normalized,
      role: null,
      tier: null,
      isAuthenticated: true,
      hasFeatureAccess: () => false,
    };
  }

  // ── Step 3: Cookie-based Supabase server auth ───────────────────
  try {
    const { createServerSupabaseReadOnly } = await import("@/lib/supabase");
    const supabase = await createServerSupabaseReadOnly();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      try {
        const resolved = await resolveVenueAccess(user.id, normalized);
        if (resolved?.role && resolved?.tier) {
          const tier = VALID_TIERS.has(resolved.tier) ? (resolved.tier as AuthTier) : "starter";
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
      } catch (err) {
        logger.error("getAuthContext: cookie-path resolveVenueAccess threw", {
          userId: user.id,
          venueId: normalized,
          error: err instanceof Error ? err.message : String(err),
        });
      }

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
  } catch (err) {
    logger.warn("getAuthContext: cookie-based auth failed", {
      venueId: normalized,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  // ── Step 4: Unauthenticated ─────────────────────────────────────
  return { ...UNAUTHENTICATED };
});
