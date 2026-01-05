"use client";

import { useState, useEffect, useCallback } from "react";
import { supabaseBrowser } from "@/lib/supabase";
import { logger } from "@/lib/logger";
import type { UserRole } from "@/lib/permissions";
import type { AccessContext, Tier, FeatureKey } from "./getAccessContext";
import { hasFeatureAccess } from "./getAccessContext";

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
        : null;

      // Call get_access_context RPC - single database call
      const { data, error: rpcError } = await supabase.rpc("get_access_context", {
        p_venue_id: normalizedVenueId,
      });

      if (rpcError) {
        logger.warn("[USE ACCESS CONTEXT] RPC error", {
          error: rpcError.message,
          venueId,
        });
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
        logger.warn("[USE ACCESS CONTEXT] Invalid tier", { tier, venueId });
        setContext({
          ...accessContext,
          tier: "starter" as Tier,
        });
        return;
      }

      setContext({
        ...accessContext,
        tier,
      });

      // Cache context in sessionStorage (use normalized venueId for cache key)
      if (typeof window !== "undefined") {
        const cacheKey = normalizedVenueId
          ? `access_context_${normalizedVenueId}`
          : `access_context_user`;
        // Store with normalized tier
        sessionStorage.setItem(
          cacheKey,
          JSON.stringify({
            ...accessContext,
            tier,
          })
        );
      }
    } catch (err) {
      logger.error("[USE ACCESS CONTEXT] Error", {
        error: err instanceof Error ? err.message : String(err),
        venueId,
      });
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
      : null;

    // Try cache first for instant response
    if (typeof window !== "undefined") {
      const cacheKey = normalizedVenueId
        ? `access_context_${normalizedVenueId}`
        : `access_context_user`;
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        try {
          const parsed = JSON.parse(cached) as AccessContext;
          // Validate cached tier is still valid
          const cachedTier = (parsed.tier?.toLowerCase().trim() || "starter") as Tier;
          if (["starter", "pro", "enterprise"].includes(cachedTier)) {
            setContext({
              ...parsed,
              tier: cachedTier,
            });
            setLoading(false);
            // Still fetch fresh data in background to ensure accuracy
            fetchContext().catch(() => {
              // Error handled in fetchContext
            });
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
    role: context?.role || null,
    tier: context?.tier || null,
    hasFeatureAccess: checkFeatureAccess,
    refetch: fetchContext,
  };
}

