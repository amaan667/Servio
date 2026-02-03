"use client";

import { useState, useEffect, useCallback } from "react";
import { supabaseBrowser } from "@/lib/supabase";
import { normalizeVenueId } from "@/lib/utils/venueId";

import type { UserRole } from "@/lib/permissions";
import type { AccessContext, Tier, FeatureKey } from "@/lib/tier-limits";
import { hasFeatureAccess } from "@/lib/tier-limits";

const VALID_ROLES: UserRole[] = ["owner", "manager", "staff", "kitchen", "server", "cashier"];

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
 * Storage helper with cookie fallback when sessionStorage/localStorage unavailable.
 * Same behavior on all devices.
 */
function getUnifiedStorage() {
  if (typeof window === "undefined") {
    return null;
  }
  
  // Test if sessionStorage is available
  const testSessionStorage = () => {
    try {
      const testKey = "__session_storage_test__";
      sessionStorage.setItem(testKey, "test");
      sessionStorage.removeItem(testKey);
      return true;
    } catch {
      return false;
    }
  };
  
  // Test if localStorage is available
  const testLocalStorage = () => {
    try {
      const testKey = "__local_storage_test__";
      localStorage.setItem(testKey, "test");
      localStorage.removeItem(testKey);
      return true;
    } catch {
      return false;
    }
  };
  
  const sessionWorks = testSessionStorage();
  const localWorks = testLocalStorage();
  
  return {
    getItem: (key: string): string | null => {
      if (sessionWorks) {
        return sessionStorage.getItem(key);
      }
      if (localWorks) {
        return localStorage.getItem(key);
      }
      // Fallback to cookies for critical data
      const cookies = document.cookie.split(";");
      const cookie = cookies.find((c) => c.trim().startsWith(`${key}=`));
      if (!cookie) return null;
      const parts = cookie.split("=");
      const v = parts[1];
      return v ? decodeURIComponent(v) : null;
    },
    setItem: (key: string, value: string): void => {
      const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toUTCString();
      
      if (sessionWorks) {
        try {
          sessionStorage.setItem(key, value);
        } catch {
          // Fall through to localStorage
        }
      }
      if (localWorks) {
        try {
          localStorage.setItem(key, value);
        } catch {
          // Fall through to cookies
        }
      }
      // Final fallback to cookies
      document.cookie = `${key}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
    },
    removeItem: (key: string): void => {
      if (sessionWorks) {
        try {
          sessionStorage.removeItem(key);
        } catch {
          // Ignore
        }
      }
      if (localWorks) {
        try {
          localStorage.removeItem(key);
        } catch {
          // Ignore
        }
      }
      // Also remove from cookies
      document.cookie = `${key}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
    },
  };
}

/** Build AccessContext from server-injected __PLATFORM_AUTH__ when RPC fails. */
function getPlatformAuthFallback(venueId?: string | null): AccessContext | null {
  if (typeof window === "undefined") return null;
  const win = window as Window & { __PLATFORM_AUTH__?: { userId?: string; tier?: string; role?: string; venueId?: string } };
  const auth = win.__PLATFORM_AUTH__;
  if (!auth?.userId || !auth?.role) return null;
  const role = auth.role as UserRole;
  if (!VALID_ROLES.includes(role)) return null;
  const normalizedVenueId = normalizeVenueId(venueId ?? auth.venueId);
  const tier = (auth.tier?.toLowerCase().trim() || "starter") as Tier;
  const validTier = ["starter", "pro", "enterprise"].includes(tier) ? tier : ("starter" as Tier);
  return {
    user_id: auth.userId,
    venue_id: normalizedVenueId || null,
    role,
    tier: validTier,
    venue_ids: normalizedVenueId ? [normalizedVenueId] : [],
    permissions: {},
  };
}

/**
 * Unified client-side access context hook
 * Uses get_access_context RPC - single database call for all auth/tier/role checks
 * Replaces all duplicate venues/user_venue_roles queries
 * Falls back to __PLATFORM_AUTH__ when RPC fails so auth is consistent.
 */
export function useAccessContext(venueId?: string | null): UseAccessContextReturn {
  const [context, setContext] = useState<AccessContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const storageRef = typeof window !== "undefined" ? getUnifiedStorage() : null;

  const fetchContext = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const supabase = supabaseBrowser();

      const normalizedVenueId = normalizeVenueId(venueId);

      // Call get_access_context RPC - single database call for all access context
      const { data, error: rpcError } = await supabase.rpc("get_access_context", {
        p_venue_id: normalizedVenueId,
      });

      if (rpcError) {
        setError(rpcError.message);
        const platformFallback = getPlatformAuthFallback(venueId);
        if (platformFallback) {
          setContext(platformFallback);
          setError(null);
        } else {
          setContext(null);
        }
        return;
      }

      if (!data) {
        const platformFallback = getPlatformAuthFallback(venueId);
        if (platformFallback) {
          setContext(platformFallback);
        } else {
          setContext(null);
        }
        return;
      }

      // Parse JSONB response
      const accessContext = data as AccessContext;

      // Normalize tier
      const tier = (accessContext.tier?.toLowerCase().trim() || "starter") as Tier;

      if (!["starter", "pro", "enterprise"].includes(tier)) {
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

      setContext(finalContext);

      // Cache context
      if (storageRef) {
        const cacheKey = normalizedVenueId
          ? `access_context_${normalizedVenueId}`
          : `access_context_user_${accessContext.user_id}`;

        storageRef.setItem(
          cacheKey,
          JSON.stringify({
            ...accessContext,
            tier,
          })
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch access context");
      const platformFallback = getPlatformAuthFallback(venueId);
      if (platformFallback) setContext(platformFallback);
      else setContext(null);
    } finally {
      setLoading(false);
    }
  }, [venueId, storageRef]);

  useEffect(() => {
    const normalizedVenueId = normalizeVenueId(venueId);

    // Try cache first for instant response
    if (storageRef) {
      const cacheKey = normalizedVenueId
        ? `access_context_${normalizedVenueId}`
        : `access_context_user`;
      const cached = storageRef.getItem(cacheKey);

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
            storageRef.removeItem(cacheKey);
          }
        } catch {
          // Invalid cache, fetch fresh
        }
      }

      // No cache: use server-injected __PLATFORM_AUTH__ for instant context
      const platformFallback = getPlatformAuthFallback(venueId);
      if (platformFallback) {
        setContext(platformFallback);
        setLoading(false);
      }
    }

    fetchContext();
  }, [venueId, fetchContext, storageRef]);

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
