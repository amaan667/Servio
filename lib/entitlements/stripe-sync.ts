/**
 * Stripe Subscription Synchronization for Entitlements
 * Handles tier changes, add-on management, and downgrade safety
 */

import { createAdminClient } from "@/lib/supabase";
import { Tier } from "@/types/entitlements";

export const STRIPE_PRICE_IDS = {
  STARTER: "price_starter", // Replace with actual Stripe price IDs

};

/**
 * Complete entitlement sync for a subscription update with downgrade safety
 */
export async function syncEntitlementsFromSubscription(
  subscription: { id: string; status: string; items: { data: Array<{ price: { id: string }; id: string }> } },

  const { data: downgradeValid } = await supabase.rpc("validate_tier_downgrade", {

  if (!downgradeValid) {
    

    // BLOCK the downgrade by not updating entitlements
    // Log this as a critical business event
    await supabase.from("subscription_history").insert({

      old_tier: null, // Will be determined by current state

      },

    // DO NOT update entitlements - leave current state intact
    return;
  }

  // Find all venues for this organization
  const { data: venues, error: venueError } = await supabase
    .from("venues")
    .select("venue_id")
    .eq("organization_id", organizationId);

  if (venueError) {
    
    throw venueError;
  }

  // Sync organization tier
  await syncOrganizationTier(organizationId, newTier, subscription.status, subscription.id);

  // Sync each venue's tier and add-ons
  for (const venue of venues || []) {
    await syncVenueTier(venue.venue_id);
    await syncVenueAddons(venue.venue_id, subscription.items.data);
  }

  
}

/**
 * Extract tier from Stripe subscription
 */
async function getTierFromStripeSubscription(subscription: {

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

  return "starter";
}

/**
 * Sync organization tier
 */
async function syncOrganizationTier(

  const { error } = await supabase
    .from("organizations")
    .update({

    .eq("id", organizationId);

  if (error) {
    
    throw error;
  }

  
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
    
    throw fetchError;
  }

  const orgTier = (venueData as { organizations: { subscription_tier: string }[] }).organizations[0].subscription_tier;
  const currentTier = venueData.tier;

  if (orgTier !== currentTier) {
    const { error: updateError } = await supabase
      .from("venues")
      .update({

      .eq("venue_id", venueId);

    if (updateError) {
      
      throw updateError;
    }

    
  }
}

/**
 * Sync venue add-ons from Stripe subscription items
 */
async function syncVenueAddons(

  subscriptionItems: Array<{ price: { id: string }; id: string }>
): Promise<void> {
  const supabase = createAdminClient();

  // Get current add-ons for this venue
  const { data: currentAddons, error: fetchError } = await supabase
    .from("venue_addons")
    .select("addon_key, stripe_subscription_item_id, status")
    .eq("venue_id", venueId);

  if (fetchError) {
    
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
      
      await supabase
        .from("venue_addons")
        .upsert(
          {

          },
          { onConflict: "venue_id,addon_key,status" }
        );
    }
  }

  // Deactivate removed add-ons
  for (const [itemId, addonKey] of currentAddonMap) {
    if (!activeAddons.has(addonKey)) {
      
      await supabase
        .from("venue_addons")
        .update({

        .eq("venue_id", venueId)
        .eq("addon_key", addonKey)
        .eq("stripe_subscription_item_id", itemId);
    }
  }

  ),

}