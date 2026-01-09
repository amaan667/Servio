/**
 * Unified Access Context - Single RPC call for auth/tier/role
 * Replaces scattered per-page checks with a single database call
 */

import { cache } from "react";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { logger } from "@/lib/logger";
import { type AccessContext, type Tier, type FeatureKey, hasFeatureAccess } from "@/lib/tier-limits";
import { env } from "@/lib/env";

/**
 * Get unified access context via RPC
 * Uses React cache() for request-level deduplication
 * Cache key includes venueId to ensure different venues get different contexts
 */
export const getAccessContext = cache(
  async (venueId?: string | null): Promise<AccessContext | null> => {
    try {
      // Use Supabase's official SSR client - this should work reliably
      const cookieStore = await cookies();

      const supabase = createServerClient(
        env("NEXT_PUBLIC_SUPABASE_URL")!,
        env("NEXT_PUBLIC_SUPABASE_ANON_KEY")!,
        {
          cookies: {
            get(name: string) {
              return cookieStore.get(name)?.value;
            },
            set() {
              // Read-only for access context - don't set cookies
            },
            remove() {
              // Read-only for access context - don't remove cookies
            },
          },
        }
      );

      // Get authenticated user - Supabase's built-in method should work reliably
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) {
        logger.error("[ACCESS CONTEXT] Auth error with official Supabase client", {
          error: authError.message,
          venueId,
        });
        return null;
      }

      if (!user) {
        logger.error("[ACCESS CONTEXT] No user found with official Supabase client", {
          venueId,
        });
        return null;
      }

      // Normalize venueId - database stores with venue- prefix
      const normalizedVenueId = venueId
        ? venueId.startsWith("venue-")
          ? venueId
          : `venue-${venueId}`
        : null;

      // Call RPC function using the authenticated Supabase client
      const { data, error: rpcError } = await supabase.rpc("get_access_context", {
        p_venue_id: normalizedVenueId,
      });

      if (rpcError) {
        logger.error("[ACCESS CONTEXT] RPC error", {
          error: rpcError.message,
          venueId,
          userId: user.id,
          normalizedVenueId,
        });
        return null;
      }

      if (!data) {
        logger.warn("[ACCESS CONTEXT] No data returned from RPC", {
          venueId,
          userId: user.id,
          normalizedVenueId,
        });
        return null;
      }

      // Parse and validate response
      const context = data as AccessContext;

      if (!context.user_id || !context.role) {
        logger.error("[ACCESS CONTEXT] Invalid RPC response", {
          context,
          venueId,
          userId: user.id,
        });
        return null;
      }

      // Normalize tier
      const tier = (context.tier?.toLowerCase().trim() || "starter") as Tier;

      if (!["starter", "pro", "enterprise"].includes(tier)) {
        logger.warn("[ACCESS CONTEXT] Invalid tier, defaulting to starter", {
          tier,
          venueId,
          userId: user.id,
        });
        return {
          ...context,
          tier: "starter" as Tier,
        };
      }

      return {
        ...context,
        tier,
      };
    } catch (error) {
      logger.error("[ACCESS CONTEXT] Unexpected error", {
        error: error instanceof Error ? error.message : String(error),
        venueId,
      });
      return null;
    }
  }
);


/**
 * Get access context with feature access helper
 */
export async function getAccessContextWithFeatures(
  venueId?: string | null
): Promise<{
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

