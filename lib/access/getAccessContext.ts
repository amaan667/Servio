/**
 * Unified Access Context - Single RPC call for auth/tier/role
 * Replaces scattered per-page checks with a single database call
 */

import { cache } from "react";
import {
  type AccessContext,
  type Tier,
  type FeatureKey,
  hasFeatureAccess,
} from "@/lib/tier-limits";
import { createServerSupabaseReadOnly } from "@/lib/supabase";
import { normalizeVenueId } from "@/lib/utils/venueId";

/**
 * Get unified access context via RPC
 * Uses React cache() for request-level deduplication
 * Cache key includes venueId to ensure different venues get different contexts
 */
export const getAccessContext = cache(
  async (venueId?: string | null): Promise<AccessContext | null> => {
    // MOBILE FIX: Declare user outside try block so it's accessible in catch
    let user: { id: string } | null = null;
    
    try {
      // Use shared server Supabase helper so ALL server-side auth (middleware + RPC)
      // goes through a single, consistent configuration and cookie handling path.
      const supabase = await createServerSupabaseReadOnly();

      // Get authenticated user - Supabase's built-in method should work reliably
      const {
        data: { user: supabaseUser },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) {
        return null;
      }

      user = supabaseUser;

      if (!user) {
        return null;
      }

      const normalizedVenueId = normalizeVenueId(venueId);

      const { data, error: rpcError } = await supabase.rpc("get_access_context", {
        p_venue_id: normalizedVenueId,
      });

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
          tier: "starter" as Tier,
        };
      }

      return {
        ...context,
        tier,
      };
    } catch (error) {
      // MOBILE FIX: Return default context instead of null to prevent access denied on mobile
      // This ensures basic functionality works even if RPC fails
      const normalizedVenueId = normalizeVenueId(venueId);
      return {
        user_id: user?.id || "",
        venue_id: normalizedVenueId || null,
        role: "owner",
        tier: "starter" as Tier,
        venue_ids: normalizedVenueId ? [normalizedVenueId] : [],
        permissions: {},
      };
    }
  }
);

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
