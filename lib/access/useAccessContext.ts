"use client";

import { useState, useEffect, useCallback } from "react";
import { supabaseBrowser } from "@/lib/supabase";
import type { UserRole } from "@/lib/permissions";
import type { AccessContext, Tier, FeatureKey } from "@/lib/tier-limits";
import { hasFeatureAccess } from "@/lib/tier-limits";

interface UseAccessContextReturn {

}

/**
 * Unified client-side access context hook
 * Uses get_access_context RPC - single database call for all auth/tier/role checks
 * Replaces all duplicate venues/user_venue_roles queries
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

      // Normalize venueId - database stores with venue- prefix
      const normalizedVenueId = venueId
        ? venueId.startsWith("venue-")
          ? venueId
          : `venue-${venueId}`

      const { data, error: rpcError } = await supabase.rpc("get_access_context", {

      if (rpcError) {
        
        setError(rpcError.message);
        setContext(null);
        return;
      }

      if (!data) {
        setContext(null);
        return;
      }

      // Parse JSONB response
      const accessContext = data as AccessContext;

      // Normalize tier
      const tier = (accessContext.tier?.toLowerCase().trim() || "starter") as Tier;

      if (!["starter", "pro", "enterprise"].includes(tier)) {
        
        setContext({
          ...accessContext,

        return;
      }

      const finalContext = {
        ...accessContext,
        tier,
      };

      setContext(finalContext);

      // Cache context in sessionStorage
      if (typeof window !== "undefined") {
        const cacheKey = normalizedVenueId
          ? `access_context_${normalizedVenueId}`
          : `access_context_user_${accessContext.user_id}`;

        sessionStorage.setItem(
          cacheKey,
          JSON.stringify({
            ...accessContext,
            tier,

        );
      }
    } catch (err) {

        venueId,

      setError(err instanceof Error ? err.message : "Failed to fetch access context");
      setContext(null);
    } finally {
      setLoading(false);
    }
  }, [venueId]);

  useEffect(() => {
    // Normalize venueId for cache key lookup
    const normalizedVenueId = venueId
      ? venueId.startsWith("venue-")
        ? venueId
        : `venue-${venueId}`

        ? `access_context_${normalizedVenueId}`

          if (["starter", "pro", "enterprise"].includes(cachedTier)) {
            setContext({
              ...parsed,

            setLoading(false);
            // Still fetch fresh data in background to ensure accuracy
            fetchContext().catch(() => {
              // Error handled in fetchContext

            return;
          } else {
            // Invalid tier in cache, clear it
            sessionStorage.removeItem(cacheKey);
          }
        } catch {
          // Invalid cache, fetch fresh
        }
      }
    }

    fetchContext();
  }, [venueId, fetchContext]);

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

  };
}

