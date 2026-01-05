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

      // Get current user
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        return null;
      }

      // SIMPLIFIED: Get tier directly from user's organization (same as settings page)
      // This is the source of truth synced with Stripe via webhooks
      const { data: userOrg } = await supabase
        .from("organizations")
        .select("subscription_tier, subscription_status")
        .eq("owner_user_id", user.id)
        .maybeSingle();

      const tier = (userOrg?.subscription_tier?.toLowerCase().trim() || "starter") as Tier;

      // Ensure valid tier
      if (!["starter", "pro", "enterprise"].includes(tier)) {
        logger.warn("[ACCESS CONTEXT] Invalid tier from database", { tier, userId: user.id });
        return null;
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

      logger.info("[ACCESS CONTEXT] Simplified tier lookup", {
        userId: user.id,
        tier: finalTier,
        subscriptionStatus: userOrg?.subscription_status,
        venueId: normalizedVenueId,
        role,
      });

      return {
        user_id: user.id,
        venue_id: normalizedVenueId,
        role,
        tier: finalTier,
        venue_ids: normalizedVenueId ? [normalizedVenueId] : [],
        permissions: {},
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

