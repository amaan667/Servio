/**
 * Unified Access Context - Single RPC call for auth/tier/role
 * Replaces scattered per-page checks with a single database call
 */

import { cache } from "react";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
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

      } = await supabase.auth.getUser();

      if (authError) {
        
        return null;
      }

      if (!user) {
        
        return null;
      }

      // Normalize venueId - database stores with venue- prefix
      const normalizedVenueId = venueId
        ? venueId.startsWith("venue-")
          ? venueId
          : `venue-${venueId}`

      const { data, error: rpcError } = await supabase.rpc("get_access_context", {

      if (rpcError) {
        
        return null;
      }

      if (!data) {
        
        return null;
      }

      // Parse and validate response
      const context = data as AccessContext;

      if (!context.user_id || !context.role) {
        
        return null;
      }

      // Normalize tier
      const tier = (context.tier?.toLowerCase().trim() || "starter") as Tier;

      if (!["starter", "pro", "enterprise"].includes(tier)) {
        
        return {
          ...context,

        };
      }

      return {
        ...context,
        tier,
      };
    } catch (error) {

        venueId,

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

} | null> {
  const context = await getAccessContext(venueId);
  if (!context) return null;

  return {
    context,
    hasFeatureAccess: (feature: FeatureKey) => hasFeatureAccess(context, feature),
  };
}

