"use client";

import { useState, useEffect, useCallback } from "react";
import { supabaseBrowser } from "@/lib/supabase";
import { logger } from "@/lib/logger";
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

      console.log("[AUTH DEBUG] fetchContext called with venueId:", venueId);

      const supabase = supabaseBrowser();

      // Normalize venueId - database stores with venue- prefix
      const normalizedVenueId = venueId
        ? venueId.startsWith("venue-")
          ? venueId
          : `venue-${venueId}`
        : null;

      console.log("[AUTH DEBUG] Normalized venueId:", normalizedVenueId);

      // Call get_access_context RPC - single database call for all access context
      const { data, error: rpcError } = await supabase.rpc("get_access_context", {
        p_venue_id: normalizedVenueId,
      });

      console.log("[AUTH DEBUG] RPC call completed", {
        hasError: !!rpcError,
        hasData: !!data,
        error: rpcError?.message,
        data: data
      });

      if (rpcError) {
        console.error("[AUTH DEBUG] RPC error:", rpcError.message);
        logger.error("[USE ACCESS CONTEXT] RPC error", {
          error: rpcError.message,
          venueId,
        });
        setError(rpcError.message);
        setContext(null);
        return;
      }

      if (!data) {
        console.log("[AUTH DEBUG] No data returned from RPC");
        setContext(null);
        return;
      }

      // Parse JSONB response
      const accessContext = data as AccessContext;

      console.log("[AUTH DEBUG] Raw access context from database:", accessContext);
      console.log("[AUTH DEBUG] Raw tier from database:", accessContext.tier);
      console.log("[AUTH DEBUG] User ID from database:", accessContext.user_id);
      console.log("[AUTH DEBUG] Role from database:", accessContext.role);
      console.log("[AUTH DEBUG] Venue ID from database:", accessContext.venue_id);
      console.log("[AUTH DEBUG] Venue IDs from database:", accessContext.venue_ids);

      // Normalize tier
      const tier = (accessContext.tier?.toLowerCase().trim() || "starter") as Tier;

      console.log("[AUTH DEBUG] Normalized tier:", tier);

      if (!["starter", "pro", "enterprise"].includes(tier)) {
        console.warn("[AUTH DEBUG] Invalid tier from database, defaulting to starter", {
          tier,
          originalTier: accessContext.tier
        });
        logger.warn("[USE ACCESS CONTEXT] Invalid tier from database", {
          tier,
          originalTier: accessContext.tier,
          venueId: normalizedVenueId,
        });
        setContext({
          ...accessContext,
          tier: "starter" as Tier,
        });
        return;
      }

      const finalContext = {
        ...accessContext,
        tier,
      };

      console.log("[AUTH DEBUG] Final access context set:", finalContext);
      console.log("[AUTH DEBUG] Final tier being used:", finalContext.tier);

      console.log("[AUTH DEBUG] Setting context in state:", finalContext);
      setContext(finalContext);

      // Cache context in sessionStorage
      if (typeof window !== "undefined") {
        const cacheKey = normalizedVenueId
          ? `access_context_${normalizedVenueId}`
          : `access_context_user_${accessContext.user_id}`;

        console.log("[AUTH DEBUG] Caching context with key:", cacheKey);
        console.log("[AUTH DEBUG] Caching data:", { ...accessContext, tier });

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
    console.log("[AUTH DEBUG] useAccessContext useEffect triggered with venueId:", venueId);

    // Normalize venueId for cache key lookup
    const normalizedVenueId = venueId
      ? venueId.startsWith("venue-")
        ? venueId
        : `venue-${venueId}`
      : null;

    console.log("[AUTH DEBUG] Normalized venueId for cache lookup:", normalizedVenueId);

    // Try cache first for instant response
    if (typeof window !== "undefined") {
      const cacheKey = normalizedVenueId
        ? `access_context_${normalizedVenueId}`
        : `access_context_user`;
      const cached = sessionStorage.getItem(cacheKey);
      console.log("[AUTH DEBUG] Cache lookup for key:", cacheKey);
      console.log("[AUTH DEBUG] Cache found:", !!cached);

      if (cached) {
        try {
          const parsed = JSON.parse(cached) as AccessContext;
          console.log("[AUTH DEBUG] Cached context:", parsed);
          console.log("[AUTH DEBUG] Cached tier:", parsed.tier);

          // Validate cached tier is still valid
          const cachedTier = (parsed.tier?.toLowerCase().trim() || "starter") as Tier;
          console.log("[AUTH DEBUG] Validated cached tier:", cachedTier);

          if (["starter", "pro", "enterprise"].includes(cachedTier)) {
            console.log("[AUTH DEBUG] Using cached context with tier:", cachedTier);
            setContext({
              ...parsed,
              tier: cachedTier,
            });
            setLoading(false);
            // Still fetch fresh data in background to ensure accuracy
            console.log("[AUTH DEBUG] Fetching fresh data in background...");
            fetchContext().catch(() => {
              // Error handled in fetchContext
            });
            return;
          } else {
            // Invalid tier in cache, clear it
            console.log("[AUTH DEBUG] Invalid tier in cache, clearing cache");
            sessionStorage.removeItem(cacheKey);
          }
        } catch (error) {
          console.log("[AUTH DEBUG] Error parsing cache:", error);
          // Invalid cache, fetch fresh
        }
      } else {
        console.log("[AUTH DEBUG] No cache found, fetching fresh data");
      }
    }

    fetchContext();
  }, [venueId, fetchContext]);

  const checkFeatureAccess = useCallback(
    (feature: FeatureKey): boolean => {
      const hasAccess = hasFeatureAccess(context, feature);
      console.log(`[AUTH DEBUG] Feature access check: ${feature} = ${hasAccess}`, {
        tier: context?.tier,
        role: context?.role,
        feature
      });
      return hasAccess;
    },
    [context]
  );

  console.log("[AUTH DEBUG] useAccessContext hook return values:", {
    loading,
    error,
    role: context?.role || null,
    tier: context?.tier || null,
    hasContext: !!context
  });

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

