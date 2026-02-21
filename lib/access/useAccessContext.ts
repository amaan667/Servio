"use client";

import { useState, useEffect, useCallback } from "react";
import { supabaseBrowser } from "@/lib/supabase";
import { normalizeVenueId } from "@/lib/utils/venueId";

import type { UserRole } from "@/lib/permissions";
import type { AccessContext, Tier, FeatureKey } from "@/lib/tier-limits";
import { hasFeatureAccess } from "@/lib/tier-limits";

interface UseAccessContextReturn {
  context: AccessContext | null;
  loading: boolean;
  error: string | null;
  role: UserRole | null;
  tier: Tier | null;
  hasFeatureAccess: (feature: FeatureKey) => boolean;
  refetch: () => Promise<void>;
}

/**
 * Client-side access context hook.
 *
 * Calls the get_access_context RPC (a single database query) and returns
 * the result.  This is the ONLY client-side source for role and tier.
 *
 * No caches, no __PLATFORM_AUTH__ fallback, no fabricated defaults.
 * If the RPC fails the hook returns null and `loading` stays false so
 * the UI can show an appropriate error state.
 */
export function useAccessContext(venueId?: string | null): UseAccessContextReturn {
  const [context, setContext] = useState<AccessContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchContext = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const normalizedVenueId = normalizeVenueId(venueId);
      let accessContext: AccessContext | null = null;

      // 1. Try RPC directly (fast path)
      try {
        const supabase = supabaseBrowser();
        const { data, error: rpcError } = await supabase.rpc("get_access_context", {
          p_venue_id: normalizedVenueId,
        });

        if (!rpcError && data) {
          const rpc = data as AccessContext;
          if (rpc.user_id && rpc.role && rpc.tier) {
            accessContext = rpc;
          }
        }
      } catch {
        // RPC unavailable — fall through to API fallback
      }

      // 2. Fallback: call /api/auth/access-context (uses admin client server-side)
      if (!accessContext && normalizedVenueId) {
        try {
          const { fetchWithAuth } = await import("@/lib/api-client");
          const res = await fetchWithAuth(
            `/api/auth/access-context?venueId=${encodeURIComponent(normalizedVenueId)}`
          );
          if (res.ok) {
            const apiData = await res.json();
            if (apiData.role && apiData.tier && apiData.userId) {
              accessContext = {
                user_id: apiData.userId,
                venue_id: apiData.venueId ?? normalizedVenueId,
                role: apiData.role,
                tier: apiData.tier,
                venue_ids: [apiData.venueId ?? normalizedVenueId],
                permissions: {},
              } as AccessContext;
            }
          }
        } catch {
          // API fallback also failed
        }
      }

      if (!accessContext) {
        setContext(null);
        return;
      }

      const tier = accessContext.tier.toLowerCase().trim() as Tier;
      if (!["starter", "pro", "enterprise"].includes(tier)) {
        setError(`Unrecognised tier "${accessContext.tier}" in database`);
        setContext(null);
        return;
      }

      setContext({ ...accessContext, tier });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch access context");
      setContext(null);
    } finally {
      setLoading(false);
    }
  }, [venueId]);

  useEffect(() => {
    fetchContext();
  }, [fetchContext]);

  const checkFeatureAccess = useCallback(
    (feature: FeatureKey): boolean => {
      return hasFeatureAccess(context, feature);
    },
    [context]
  );

  return {
    context,
    loading,
    error,
    role: context?.role || null,
    tier: context?.tier || null,
    hasFeatureAccess: checkFeatureAccess,
    refetch: fetchContext,
  };
}
