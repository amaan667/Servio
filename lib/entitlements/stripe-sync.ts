/**
 * Stripe Subscription Synchronization for Entitlements
 * Handles tier changes, add-on management, and downgrade safety
 */

import { createAdminClient } from "@/lib/supabase";
import { logger } from "@/lib/logger";
import { Tier } from "@/types/entitlements";

export const STRIPE_PRICE_IDS = {
  STARTER: "price_starter", // Replace with actual Stripe price IDs
  PRO: "price_pro",
  ENTERPRISE: "price_enterprise",
  ADDON_KDS_STARTER: "price_kds_starter",
  ADDON_API_PRO_LIGHT: "price_api_pro_light",
};

/**
 * Complete entitlement sync for a subscription update with downgrade safety
 */
export async function syncEntitlementsFromSubscription(
  subscription: { id: string; status: string; items: { data: Array<{ price: { id: string }; id: string }> } },
  organizationId: string
): Promise<void> {
  const supabase = createAdminClient();

  // Get tier from subscription
  const newTier = await getTierFromStripeSubscription(subscription);

  // DOWNGRADE SAFETY: Validate the tier change is allowed
  const { data: downgradeValid } = await supabase.rpc("validate_tier_downgrade", {
    p_organization_id: organizationId,
    p_new_tier: newTier,
  });

  if (!downgradeValid) {
    logger.error("[STRIPE SYNC] DOWNGRADE BLOCKED - tier change would violate business rules", {
      organizationId,
      attemptedTier: newTier,
      subscriptionId: subscription.id,
    });

    // BLOCK the downgrade by not updating entitlements
    // Log this as a critical business event
    await supabase.from("subscription_history").insert({
      organization_id: organizationId,
      event_type: "downgrade_blocked",
      old_tier: null, // Will be determined by current state
      new_tier: newTier,
      stripe_event_id: subscription.id,
      metadata: {
        subscription_id: subscription.id,
        reason: "downgrade_would_violate_business_rules",
        blocked_tier: newTier,
      },
    });

    // DO NOT update entitlements - leave current state intact
    return;
  }

  // Find all venues for this organization
  const { data: venues, error: venueError } = await supabase
    .from("venues")
    .select("venue_id")
    .eq("organization_id", organizationId);

  if (venueError) {
    logger.error("[STRIPE SYNC] Failed to fetch venues for organization", {
      organizationId,
      error: venueError.message,
    });
    throw venueError;
  }

  // Sync organization tier
  await syncOrganizationTier(organizationId, newTier, subscription.status, subscription.id);

  // Sync each venue's tier and add-ons
  for (const venue of venues || []) {
    await syncVenueTier(venue.venue_id);
    await syncVenueAddons(venue.venue_id, subscription.items.data);
  }

  logger.info("[STRIPE SYNC] Complete entitlement sync finished", {
    organizationId,
    tier: newTier,
    venueCount: venues?.length || 0,
  });
}

/**
 * Extract tier from Stripe subscription
 */
async function getTierFromStripeSubscription(subscription: {
  id: string;
  status: string;
  items: { data: Array<{ price: { id: string }; id: string }> };
}): Promise<Tier> {
  // Find the base tier price
  for (const item of subscription.items.data) {
    const priceId = item.price.id;

    if (priceId === STRIPE_PRICE_IDS.STARTER) return "starter";
    if (priceId === STRIPE_PRICE_IDS.PRO) return "pro";
    if (priceId === STRIPE_PRICE_IDS.ENTERPRISE) return "enterprise";
  }

  // Default to starter if no matching tier found
  logger.warn("[STRIPE SYNC] No matching tier price found, defaulting to starter", {
    subscriptionId: subscription.id,
    priceIds: subscription.items.data.map(item => item.price.id),
  });

  return "starter";
}

/**
 * Sync organization tier
 */
async function syncOrganizationTier(
  organizationId: string,
  tier: Tier,
  subscriptionStatus: string,
  subscriptionId: string
): Promise<void> {
  const supabase = createAdminClient();

  const { error } = await supabase
    .from("organizations")
    .update({
      subscription_tier: tier,
      subscription_status: subscriptionStatus,
      stripe_subscription_id: subscriptionId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", organizationId);

  if (error) {
    logger.error("[STRIPE SYNC] Failed to update organization tier", {
      organizationId,
      tier,
      error: error.message,
    });
    throw error;
  }

  logger.info("[STRIPE SYNC] Organization tier updated", {
    organizationId,
    tier,
    subscriptionStatus,
  });
}

/**
 * Sync venue tier (derived from organization)
 */
async function syncVenueTier(venueId: string): Promise<void> {
  const supabase = createAdminClient();

  // Get organization's subscription tier
  const { data: venueData, error: fetchError } = await supabase
    .from("venues")
    .select(`
      organization_id,
      tier,
      organizations!inner (
        subscription_tier
      )
    `)
    .eq("venue_id", venueId)
    .single();

  if (fetchError) {
    logger.error("[STRIPE SYNC] Failed to fetch venue organization data", {
      venueId,
      error: fetchError.message,
    });
    throw fetchError;
  }

  const orgTier = (venueData as { organizations: { subscription_tier: string }[] }).organizations[0].subscription_tier;
  const currentTier = venueData.tier;

  if (orgTier !== currentTier) {
    const { error: updateError } = await supabase
      .from("venues")
      .update({
        tier: orgTier,
        updated_at: new Date().toISOString(),
      })
      .eq("venue_id", venueId);

    if (updateError) {
      logger.error("[STRIPE SYNC] Failed to update venue tier", {
        venueId,
        from: currentTier,
        to: orgTier,
        error: updateError.message,
      });
      throw updateError;
    }

    logger.info("[STRIPE SYNC] Venue tier updated", {
      venueId,
      from: currentTier,
      to: orgTier,
    });
  }
}

/**
 * Sync venue add-ons from Stripe subscription items
 */
async function syncVenueAddons(
  venueId: string,
  subscriptionItems: Array<{ price: { id: string }; id: string }>
): Promise<void> {
  const supabase = createAdminClient();

  // Get current add-ons for this venue
  const { data: currentAddons, error: fetchError } = await supabase
    .from("venue_addons")
    .select("addon_key, stripe_subscription_item_id, status")
    .eq("venue_id", venueId);

  if (fetchError) {
    logger.error("[STRIPE SYNC] Failed to fetch current venue add-ons", {
      venueId,
      error: fetchError.message,
    });
    throw fetchError;
  }

  // Build maps for current state
  const currentAddonMap = new Map<string, string>(); // itemId -> addonKey
  const currentItemMap = new Map<string, string>(); // addonKey -> itemId

  for (const addon of currentAddons || []) {
    if (addon.stripe_subscription_item_id) {
      currentAddonMap.set(addon.stripe_subscription_item_id, addon.addon_key);
    }
    if (addon.status === "active") {
      currentItemMap.set(addon.addon_key, addon.stripe_subscription_item_id || "");
    }
  }

  // Determine active add-ons from subscription items
  const activeAddons = new Map<string, string>(); // addonKey -> itemId

  for (const item of subscriptionItems) {
    const priceId = item.price.id;
    let addonKey: string | null = null;

    if (priceId === STRIPE_PRICE_IDS.ADDON_KDS_STARTER) {
      addonKey = "kds_starter";
    } else if (priceId === STRIPE_PRICE_IDS.ADDON_API_PRO_LIGHT) {
      addonKey = "api_pro_light";
    }

    if (addonKey) {
      activeAddons.set(addonKey, item.id);
    }
  }

  // Update add-on statuses
  // Activate new add-ons
  for (const [addonKey, itemId] of activeAddons) {
    if (!currentAddonMap.has(itemId)) {
      logger.info("[STRIPE SYNC] Activating add-on", { venueId, addonKey, itemId });
      await supabase
        .from("venue_addons")
        .upsert(
          {
            venue_id: venueId,
            addon_key: addonKey,
            status: "active",
            stripe_subscription_item_id: itemId,
            stripe_price_id: subscriptionItems.find(item => item.id === itemId)?.price.id,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "venue_id,addon_key,status" }
        );
    }
  }

  // Deactivate removed add-ons
  for (const [itemId, addonKey] of currentAddonMap) {
    if (!activeAddons.has(addonKey)) {
      logger.info("[STRIPE SYNC] Deactivating add-on", { venueId, addonKey, itemId });
      await supabase
        .from("venue_addons")
        .update({
          status: "cancelled",
          updated_at: new Date().toISOString(),
        })
        .eq("venue_id", venueId)
        .eq("addon_key", addonKey)
        .eq("stripe_subscription_item_id", itemId);
    }
  }

  logger.info("[STRIPE SYNC] Venue add-ons synchronized", {
    venueId,
    activeAddons: Array.from(activeAddons.keys()),
  });
}