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

      // Get current user
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setContext(null);
        return;
      }

      // SIMPLIFIED: Get tier directly from user's organization (same as server-side)
      // This is the source of truth synced with Stripe via webhooks
      const { data: userOrg } = await supabase
        .from("organizations")
        .select("subscription_tier, subscription_status")
        .eq("owner_user_id", user.id)
        .maybeSingle();

      const tier = (userOrg?.subscription_tier?.toLowerCase().trim() || "starter") as Tier;

      // Ensure valid tier
      if (!["starter", "pro", "enterprise"].includes(tier)) {
        logger.warn("[USE ACCESS CONTEXT] Invalid tier", { tier, userId: user.id });
        setContext(null);
        return;
      }

      // If subscription is not active, downgrade to starter
      const finalTier =
        userOrg?.subscription_status === "active" ? tier : ("starter" as Tier);

      // Normalize venueId for role check
      const normalizedVenueId = venueId
        ? venueId.startsWith("venue-")
          ? venueId
          : `venue-${venueId}`
        : null;

      // Get role if venueId provided
      let role: "owner" | "manager" | "staff" = "owner";
      if (normalizedVenueId) {
        const { data: venue } = await supabase
          .from("venues")
          .select("owner_user_id")
          .eq("venue_id", normalizedVenueId)
          .maybeSingle();

        if (venue?.owner_user_id === user.id) {
          role = "owner";
        } else {
          const { data: userRole } = await supabase
            .from("user_venue_roles")
            .select("role")
            .eq("venue_id", normalizedVenueId)
            .eq("user_id", user.id)
            .maybeSingle();

          role = (userRole?.role as "manager" | "staff") || "owner";
        }
      }

      const accessContext: AccessContext = {
        user_id: user.id,
        venue_id: normalizedVenueId,
        role,
        tier: finalTier,
        venue_ids: normalizedVenueId ? [normalizedVenueId] : [],
        permissions: {},
      };

      setContext(accessContext);

      // Cache context in sessionStorage
      if (typeof window !== "undefined") {
        const cacheKey = normalizedVenueId
          ? `access_context_${normalizedVenueId}`
          : `access_context_user_${user.id}`;
        sessionStorage.setItem(cacheKey, JSON.stringify(accessContext));
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

