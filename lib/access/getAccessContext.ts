/**
 * Unified Access Context - Single RPC call for auth/tier/role
 * Replaces scattered per-page checks with a single database call
 */

import { cache } from "react";
import { supabaseServer, getAuthenticatedUser } from "@/lib/supabase";
import { logger } from "@/lib/logger";
import { TIER_LIMITS } from "@/lib/tier-restrictions";

import type { UserRole } from "@/lib/permissions";
export type Tier = "starter" | "pro" | "enterprise";
export type FeatureKey =
  | "kds"
  | "inventory"
  | "analytics"
  | "customerFeedback"
  | "loyaltyTracking"
  | "branding"
  | "customBranding"
  | "apiAccess"
  | "aiAssistant"
  | "multiVenue"
  | "customIntegrations";

export interface AccessContext {
  user_id: string;
  venue_id: string | null;
  role: UserRole;
  tier: Tier;
  venue_ids: string[];
  permissions: Record<string, unknown>;
}

/**
 * Get unified access context via RPC
 * Uses React cache() for request-level deduplication
 * Cache key includes venueId to ensure different venues get different contexts
 */
export const getAccessContext = cache(
  async (venueId?: string | null): Promise<AccessContext | null> => {
    try {
      // CRITICAL: Authentication should NEVER fail for properly signed-in users
      const { user, error: authError } = await getAuthenticatedUser();

      if (authError || !user) {
        // LOG CRITICAL ERROR: This should never happen for authenticated users
        logger.error("[ACCESS CONTEXT] CRITICAL AUTH FAILURE - User should be authenticated", {
          error: authError,
          venueId,
          timestamp: new Date().toISOString(),
          stack: new Error().stack, // Capture stack trace for debugging
        });

        // Try alternative auth method as fallback
        try {
          const { cookies } = await import("next/headers");
          const cookieStore = await cookies();

          // Log all cookies for debugging
          const allCookies = cookieStore.getAll();
          logger.error("[ACCESS CONTEXT] Cookie diagnostics", {
            totalCookies: allCookies.length,
            cookieNames: allCookies.map(c => c.name),
            hasSupabaseCookies: allCookies.some(c => c.name.includes('sb-')),
            venueId,
          });

          // Try creating a basic client and checking auth
          const basicSupabase = supabaseServer({
            get: (name) => cookieStore.get(name)?.value,
            set: () => {},
          });

          const { data: { user: fallbackUser }, error: fallbackError } = await basicSupabase.auth.getUser();

          if (fallbackUser && !fallbackError) {
            logger.warn("[ACCESS CONTEXT] Fallback auth succeeded", {
              userId: fallbackUser.id,
              venueId,
            });
            // Use fallback user
            // Continue with fallback user...
          } else {
            logger.error("[ACCESS CONTEXT] Fallback auth also failed", {
              fallbackError: fallbackError?.message,
              venueId,
            });
            return null;
          }
        } catch (fallbackError) {
          logger.error("[ACCESS CONTEXT] Complete auth failure", {
            fallbackError: fallbackError instanceof Error ? fallbackError.message : String(fallbackError),
            venueId,
          });
          return null;
        }
      }

      // If we get here, we should have a valid user
      const authenticatedUser = user!;

      // Create authenticated supabase client
      const { cookies } = await import("next/headers");
      const cookieStore = await cookies();

      const supabase = supabaseServer({
        get: (name) => {
          try {
            const cookie = cookieStore.get(name);
            return cookie?.value;
          } catch (error) {
            logger.warn("[ACCESS CONTEXT] Cookie access error", {
              cookieName: name,
              error: error instanceof Error ? error.message : String(error),
              venueId,
            });
            return undefined;
          }
        },
        set: () => {
          // Read-only mode for access context
        },
      });

      // Normalize venueId - database stores with venue- prefix
      const normalizedVenueId = venueId
        ? venueId.startsWith("venue-")
          ? venueId
          : `venue-${venueId}`
        : null;

      // Call RPC function - single database call for all access context
      const { data, error } = await supabase.rpc("get_access_context", {
        p_venue_id: normalizedVenueId,
      });

      if (error) {
        logger.error("[ACCESS CONTEXT] RPC execution failed", {
          error: error.message,
          venueId,
          userId: authenticatedUser.id,
          normalizedVenueId,
        });
        return null;
      }

      if (!data) {
        logger.error("[ACCESS CONTEXT] RPC returned no data", {
          venueId,
          userId: authenticatedUser.id,
          normalizedVenueId,
        });
        return null;
      }

      // Parse JSONB response
      const context = data as AccessContext;

      // Validate RPC response
      if (!context.user_id || !context.role) {
        logger.error("[ACCESS CONTEXT] Invalid RPC response structure", {
          context,
          venueId,
          userId: authenticatedUser.id,
        });
        return null;
      }

      // Normalize tier to lowercase - database is source of truth
      const rawTierValue = context.tier;
      const tier = (rawTierValue?.toLowerCase().trim() || "starter") as Tier;

      // Ensure valid tier
      if (!["starter", "pro", "enterprise"].includes(tier)) {
        logger.error("[ACCESS CONTEXT] Invalid tier from RPC", {
          tier,
          rawTier: rawTierValue,
          venueId,
          userId: authenticatedUser.id,
          fullContext: JSON.stringify(context),
        });
        return {
          ...context,
          tier: "starter" as Tier,
        };
      }

      logger.info("[ACCESS CONTEXT] Successfully loaded", {
        userId: authenticatedUser.id,
        venueId: context.venue_id,
        role: context.role,
        tier,
        venueIds: context.venue_ids?.length || 0,
      });

      return {
        ...context,
        tier,
      };
    } catch (error) {
      logger.error("[ACCESS CONTEXT] Unexpected error in getAccessContext", {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        venueId,
      });
      return null;
    }
  }
);

/**
 * Check if user has feature access
 */
export function hasFeatureAccess(
  context: AccessContext | null,
  feature: FeatureKey
): boolean {
  if (!context) return false;

  const tierLimits = TIER_LIMITS[context.tier];
  if (!tierLimits) return false;

  // Handle legacy "customBranding" -> "branding" mapping
  const featureKey = feature === "customBranding" ? "branding" : feature;
  const featureValue = tierLimits.features[featureKey as keyof typeof tierLimits.features];

  // For KDS tier, return true if not false
  if (feature === "kds" || featureKey === "kds") {
    return featureValue !== false;
  }

  // For boolean features, return the value directly
  if (typeof featureValue === "boolean") {
    return featureValue;
  }

  // For analytics and supportLevel, they're always allowed (just different levels)
  return true;
}

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

