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

      const supabase = supabaseBrowser();
      const normalizedVenueId = normalizeVenueId(venueId);

      const { data, error: rpcError } = await supabase.rpc("get_access_context", {
        p_venue_id: normalizedVenueId,
      });

      if (rpcError) {
        setError(rpcError.message);
        setContext(null);
        return;
      }

      if (!data) {
        setContext(null);
        return;
      }

      const accessContext = data as AccessContext;

      if (!accessContext.user_id || !accessContext.role || !accessContext.tier) {
        setContext(null);
        return;
      }

      const tier = accessContext.tier.toLowerCase().trim() as Tier;
      if (!["starter", "pro", "enterprise"].includes(tier)) {
        // Unrecognised tier from DB — surface it as an error, don't guess.
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
