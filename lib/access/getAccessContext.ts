/**
 * Unified Access Context - Single RPC call for auth/tier/role
 * Replaces scattered per-page checks with a single database call
 */

import { cache } from "react";
import { createServerSupabase } from "@/lib/supabase";
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
      const supabase = await createServerSupabase();

      // Normalize venueId - database stores with venue- prefix
      const normalizedVenueId = venueId
        ? venueId.startsWith("venue-")
          ? venueId
          : `venue-${venueId}`
        : null;

      // Call RPC function - single database call for all access context
      // RPC now gets tier directly from user's organization (same as settings page)
      const { data, error } = await supabase.rpc("get_access_context", {
        p_venue_id: normalizedVenueId,
      });

      if (error) {
        logger.warn("[ACCESS CONTEXT] RPC error", {
          error: error.message,
          venueId,
        });
        return null;
      }

      if (!data) {
        return null;
      }

      // Parse JSONB response
      const context = data as AccessContext;

      // BROWSER CONSOLE LOGGING - Show RPC call and response
      // eslint-disable-next-line no-console
      console.log('[GET ACCESS CONTEXT] 📡 RPC Call Made:', {
        requestedVenueId: venueId,
        normalizedVenueId,
        timestamp: new Date().toISOString()
      });

      // eslint-disable-next-line no-console
      console.log('[GET ACCESS CONTEXT] 📦 Raw RPC Response:', {
        data: data,
        dataType: typeof data,
        isNull: data === null,
        hasProperties: data ? Object.keys(data) : [],
        venueId: data?.venue_id,
        userId: data?.user_id,
        role: data?.role,
        tier: data?.tier
      });

      // Normalize tier to lowercase - database is source of truth
      const rawTierValue = context.tier;
      const tier = (rawTierValue?.toLowerCase().trim() || "starter") as Tier;

      // eslint-disable-next-line no-console
      console.log('[GET ACCESS CONTEXT] 🔄 Tier Processing:', {
        rawTierValue,
        processedTier: tier,
        validTiers: ["starter", "pro", "enterprise"],
        isValid: ["starter", "pro", "enterprise"].includes(tier),
        fallbackToStarter: !rawTierValue || !["starter", "pro", "enterprise"].includes(tier)
      });

      // Ensure valid tier
      if (!["starter", "pro", "enterprise"].includes(tier)) {
        logger.warn("[ACCESS CONTEXT] Invalid tier from database", { tier, venueId });
        return {
          ...context,
          tier: "starter" as Tier,
        };
      }

      // Return tier from database (webhooks handle Stripe sync automatically)
      return {
        ...context,
        tier,
      };
    } catch (error) {
      logger.error("[ACCESS CONTEXT] Error", {
        error: error instanceof Error ? error.message : String(error),
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

