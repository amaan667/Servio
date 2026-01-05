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
 */
export const getAccessContext = cache(
  async (venueId?: string | null): Promise<AccessContext | null> => {
    try {
      const supabase = await createServerSupabase();

      // Call RPC function - single database call
      const { data, error } = await supabase.rpc("get_access_context", {
        p_venue_id: venueId || null,
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

      // Normalize tier to lowercase
      let tier = (context.tier?.toLowerCase().trim() || "starter") as Tier;

      // Ensure valid tier
      if (!["starter", "pro", "enterprise"].includes(tier)) {
        logger.warn("[ACCESS CONTEXT] Invalid tier", { tier, venueId });
        tier = "starter" as Tier;
      }

      // Sync tier from Stripe if organization has Stripe customer (same as settings page)
      // This ensures tier is always accurate, matching settings page behavior
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.id) {
          // Get organization with Stripe customer ID
          const { data: orgData } = await supabase
            .from("organizations")
            .select("id, subscription_tier, stripe_customer_id, subscription_status")
            .eq("owner_user_id", user.id)
            .limit(1)
            .maybeSingle();

          if (orgData?.stripe_customer_id && orgData.id) {
            try {
              const { stripe } = await import("@/lib/stripe-client");
              const { getTierFromStripeSubscription } = await import("@/lib/stripe-tier-helper");

              // Get active subscription from Stripe
              const subscriptions = await stripe.subscriptions.list({
                customer: orgData.stripe_customer_id,
                status: "active",
                limit: 1,
              });

              if (subscriptions.data.length > 0) {
                const subscription = subscriptions.data[0];
                const stripeTier = await getTierFromStripeSubscription(subscription, stripe);

                // Update database if tier differs (use Stripe as source of truth)
                if (stripeTier !== orgData.subscription_tier) {
                  logger.info("[ACCESS CONTEXT] Syncing tier from Stripe", {
                    organizationId: orgData.id,
                    databaseTier: orgData.subscription_tier,
                    stripeTier,
                    userId: user.id,
                  });

                  const { error: updateError } = await supabase
                    .from("organizations")
                    .update({
                      subscription_tier: stripeTier,
                      subscription_status: subscription.status,
                      updated_at: new Date().toISOString(),
                    })
                    .eq("id", orgData.id);

                  if (!updateError) {
                    tier = stripeTier.toLowerCase().trim() as Tier;
                    logger.info("[ACCESS CONTEXT] Tier synced from Stripe", {
                      organizationId: orgData.id,
                      newTier: tier,
                    });
                  }
                } else {
                  // Even if tiers match, use Stripe tier to ensure consistency
                  tier = stripeTier.toLowerCase().trim() as Tier;
                }
              }
            } catch (syncError) {
              // Log but don't fail - webhooks will handle sync eventually
              logger.warn("[ACCESS CONTEXT] Tier sync failed (non-critical)", {
                error: syncError instanceof Error ? syncError.message : String(syncError),
                organizationId: orgData.id,
              });
            }
          }
        }
      } catch (syncError) {
        // Log but don't fail - continue with database tier
        logger.warn("[ACCESS CONTEXT] Tier sync error (non-critical)", {
          error: syncError instanceof Error ? syncError.message : String(syncError),
        });
      }

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

