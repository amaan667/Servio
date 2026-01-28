/**
 * Unified Access Context - Single RPC call for auth/tier/role
 * Replaces scattered per-page checks with a single database call
 */

import { cache } from "react";
import { type AccessContext, type Tier, type FeatureKey, hasFeatureAccess } from "@/lib/tier-limits";
import { createServerSupabaseReadOnly } from "@/lib/supabase";

/**
 * Get unified access context via RPC
 * Uses React cache() for request-level deduplication
 * Cache key includes venueId to ensure different venues get different contexts
 */
export const getAccessContext = cache(
  async (venueId?: string | null): Promise<AccessContext | null> => {
    try {
      // Use shared server Supabase helper so ALL server-side auth (middleware + RPC)
      // goes through a single, consistent configuration and cookie handling path.
      const supabase = await createServerSupabaseReadOnly();

      // Get authenticated user - Supabase's built-in method should work reliably
      const {
        data: { user },
        error: authError,
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
        : null;

      // Call RPC function using the authenticated Supabase client
      // eslint-disable-next-line no-console
      console.log("[GET-ACCESS-CONTEXT] Calling RPC", {
        userId: user.id,
        email: user.email,
        venueId: normalizedVenueId,
        timestamp: new Date().toISOString(),
      });

      const { data, error: rpcError } = await supabase.rpc("get_access_context", {
        p_venue_id: normalizedVenueId,
      });

      // eslint-disable-next-line no-console
      console.log("[GET-ACCESS-CONTEXT] RPC result", {
        hasData: !!data,
        hasError: !!rpcError,
        error: rpcError ? {
          message: rpcError.message,
          code: rpcError.code,
          details: rpcError.details,
          hint: rpcError.hint,
        } : null,
        data: data ? {
          user_id: data.user_id,
          venue_id: data.venue_id,
          role: data.role,
          tier: data.tier,
        } : null,
        userId: user.id,
        venueId: normalizedVenueId,
      });

      if (rpcError) {
        // eslint-disable-next-line no-console
        console.error("[GET-ACCESS-CONTEXT] RPC error", {
          error: rpcError.message,
          code: rpcError.code,
          details: rpcError.details,
          hint: rpcError.hint,
          userId: user.id,
          venueId: normalizedVenueId,
        });
        return null;
      }

      if (!data) {
        // eslint-disable-next-line no-console
        console.error("[GET-ACCESS-CONTEXT] RPC returned null", {
          userId: user.id,
          venueId: normalizedVenueId,
          normalizedVenueId,
        });
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

