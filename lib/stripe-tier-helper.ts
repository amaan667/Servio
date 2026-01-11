/**
 * Stripe Tier Helper
 * Extracts subscription tier from Stripe data using metadata or product name
 * No hardcoded values or env vars needed - fully dynamic
 */

import Stripe from "stripe";

export type SubscriptionTier = "starter" | "pro" | "enterprise";

/**
 * Extract tier from Stripe subscription
 * Priority:
 * 1. Price metadata.tier
 * 2. Product metadata.tier
 * 3. Product name parsing
 * 4. Default to starter
 */
export async function getTierFromStripeSubscription(
  subscription: Stripe.Subscription,
  stripe: Stripe
): Promise<SubscriptionTier> {
  try {
    const priceId = subscription.items.data[0]?.price.id;

    if (!priceId) {

      return "starter";
    }

    // Fetch full price details with product
    const price = await stripe.prices.retrieve(priceId, {
      expand: ["product"],
    });

    // 1. Check price metadata first - use raw value from Stripe
    if (price.metadata?.tier) {
      const tier = price.metadata.tier.toLowerCase().trim() as SubscriptionTier;

      // Validate it's a valid tier
      if (["starter", "pro", "enterprise"].includes(tier)) {
        return tier;
      }

    }

    // 2. Check product metadata - use raw value from Stripe
    const product = typeof price.product === "string" ? null : price.product;

    // Type guard: Check if product is not deleted and has metadata
    if (product && !product.deleted && "metadata" in product && product.metadata?.tier) {
      const tier = product.metadata.tier.toLowerCase().trim() as SubscriptionTier;

      // Validate it's a valid tier
      if (["starter", "pro", "enterprise"].includes(tier)) {
        return tier;
      }

    }

    // 3. Parse from product name
    if (product && !product.deleted && "name" in product && product.name) {
      const tier = parseTierFromName(product.name);

      return tier;
    }

    // 4. Default

    return "starter";
  } catch (error) {

    return "starter";
  }
}

/**
 * @deprecated - No longer used. Tiers are pulled directly from Stripe without normalization.
 * Stripe product/price metadata.tier should be set to exactly "starter", "pro", or "enterprise".
 */
export function normalizeTier(tierString: string | null | undefined): SubscriptionTier {
  // Deprecated - kept for backwards compatibility but should not be used
  // All code should use getTierFromStripeSubscription() which returns raw Stripe tier
  if (!tierString || typeof tierString !== "string") {
    return "starter";
  }

  const normalized = tierString.toLowerCase().trim();

  // Direct matches - use as-is
  if (normalized === "enterprise" || normalized === "pro" || normalized === "starter") {
    return normalized as SubscriptionTier;
  }

  // Default to starter if unclear
  return "starter";
}

/**
 * Parse tier from product name
 * Handles: "Premium Plan" → enterprise, "Standard Plan" → pro, "Basic Plan" → starter
 */
function parseTierFromName(name: string): SubscriptionTier {
  const nameLower = name.toLowerCase();

  // Check for enterprise indicators (premium → enterprise)
  if (
    nameLower.includes("premium") ||
    nameLower.includes("enterprise") ||
    nameLower.includes("unlimited")
  ) {
    return "enterprise";
  }

  // Check for pro indicators (standard → pro)
  if (
    nameLower.includes("standard") ||
    nameLower.includes("professional") ||
    nameLower.includes("pro") ||
    (nameLower.includes("plus") && !nameLower.includes("premium")) ||
    nameLower.includes("growth")
  ) {
    return "pro";
  }

  // Check for starter indicators (basic → starter)
  if (
    nameLower.includes("basic") ||
    nameLower.includes("starter") ||
    nameLower.includes("free") ||
    nameLower.includes("trial")
  ) {
    return "starter";
  }

  // Default to starter if unclear
  return "starter";
}

/**
 * Get tier display name
 */
export function getTierDisplayName(tier: SubscriptionTier): string {
  return tier.charAt(0).toUpperCase() + tier.slice(1);
}
