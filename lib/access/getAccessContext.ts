/**
 * Unified Access Context - Single RPC call for auth/tier/role
 * Replaces scattered per-page checks with a single database call
 *
 * getAccessContextWithRequest(venueId, request) uses Bearer token when cookies
 * are not sent, so API routes work the same regardless of device.
 *
 * All functions fall back to resolveVenueAccess (admin/service-role) when
 * the RPC is unavailable or fails, so access always resolves correctly.
 */

import { cache } from "react";
import type { NextRequest } from "next/server";
import {
  type AccessContext,
  type Tier,
  type FeatureKey,
  hasFeatureAccess,
} from "@/lib/tier-limits";
import { createServerSupabaseReadOnly, createServerSupabaseWithToken } from "@/lib/supabase";
import { normalizeVenueId } from "@/lib/utils/venueId";

/**
 * Get unified access context via RPC
 * Uses React cache() for request-level deduplication
 * Falls back to resolveVenueAccess (admin client) when RPC fails.
 */
export const getAccessContext = cache(
  async (venueId?: string | null): Promise<AccessContext | null> => {
    let user: { id: string } | null = null;
    const normalizedVenueId = normalizeVenueId(venueId);

    try {
      const supabase = await createServerSupabaseReadOnly();

      const {
        data: { user: supabaseUser },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !supabaseUser) {
        return null;
      }

      user = supabaseUser;

      // Try RPC (SECURITY DEFINER — bypasses RLS)
      const { data, error: rpcError } = await supabase.rpc("get_access_context", {
        p_venue_id: normalizedVenueId,
      });

      if (!rpcError && data) {
        const context = data as AccessContext;
        if (context.user_id && context.role) {
          const tier = (context.tier?.toLowerCase().trim() || "starter") as Tier;
          const validTier = ["starter", "pro", "enterprise"].includes(tier)
            ? tier
            : ("starter" as Tier);
          return { ...context, tier: validTier };
        }
      }
    } catch {
      // RPC failed — fall through to admin fallback
    }

    // Admin fallback via resolveVenueAccess (service-role, no RLS)
    if (user && normalizedVenueId) {
      try {
        const { resolveVenueAccess } = await import("@/lib/auth/resolve-access");
        const resolved = await resolveVenueAccess(user.id, normalizedVenueId);
        if (resolved?.role && resolved?.tier) {
          const tier = ["starter", "pro", "enterprise"].includes(resolved.tier)
            ? (resolved.tier as Tier)
            : ("starter" as Tier);
          return {
            user_id: resolved.userId,
            venue_id: resolved.venueId,
            role: resolved.role,
            tier,
            venue_ids: [resolved.venueId],
            permissions: {},
          } as AccessContext;
        }
      } catch {
        // Admin fallback also failed
      }
    }

    return null;
  }
);

/**
 * Get access context using request's Bearer token when cookies are empty.
 * Falls back to resolveVenueAccess (admin client) when RPC fails.
 */
export async function getAccessContextWithRequest(
  venueId: string | null | undefined,
  request: NextRequest
): Promise<AccessContext | null> {
  const normalizedVenueId = normalizeVenueId(venueId);

  // 1. Try cookie-based RPC
  const contextFromCookies = await getAccessContext(venueId);
  if (contextFromCookies) return contextFromCookies;

  // 2. Try Bearer token RPC
  const authHeader = request.headers.get("Authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  let userId: string | null = null;

  if (token) {
    try {
      const supabase = createServerSupabaseWithToken(token);
      const { data: userData, error: userError } = await supabase.auth.getUser(token);
      if (!userError && userData?.user) {
        userId = userData.user.id;

        const { data, error: rpcError } = await supabase.rpc("get_access_context", {
          p_venue_id: normalizedVenueId,
        });

        if (!rpcError && data) {
          const context = data as AccessContext;
          if (context.user_id && context.role) {
            const tier = (context.tier?.toLowerCase().trim() || "starter") as Tier;
            const validTier = ["starter", "pro", "enterprise"].includes(tier)
              ? tier
              : ("starter" as Tier);
            return { ...context, tier: validTier };
          }
        }
      }
    } catch {
      // Token RPC failed
    }
  }

  // 3. Try middleware header userId
  if (!userId) {
    userId = request.headers.get("x-user-id");
  }

  // 4. Admin fallback via resolveVenueAccess (service-role, no RLS)
  if (userId && normalizedVenueId) {
    try {
      const { resolveVenueAccess } = await import("@/lib/auth/resolve-access");
      const resolved = await resolveVenueAccess(userId, normalizedVenueId);
      if (resolved?.role && resolved?.tier) {
        const tier = ["starter", "pro", "enterprise"].includes(resolved.tier)
          ? (resolved.tier as Tier)
          : ("starter" as Tier);
        return {
          user_id: resolved.userId,
          venue_id: resolved.venueId,
          role: resolved.role,
          tier,
          venue_ids: [resolved.venueId],
          permissions: {},
        } as AccessContext;
      }
    } catch {
      // Admin fallback also failed
    }
  }

  return null;
}

/**
 * Get access context with feature access helper
 */
export async function getAccessContextWithFeatures(venueId?: string | null): Promise<{
  context: AccessContext | null;
  hasFeatureAccess: (feature: FeatureKey) => boolean;
} | null> {
  const context = await getAccessContext(venueId);
  if (!context) return null;

  return {
    context,
    hasFeatureAccess: (feature: FeatureKey) => hasFeatureAccess(context, feature),
  };
}
