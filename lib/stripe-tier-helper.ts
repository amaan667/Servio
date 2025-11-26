/**
 * Stripe Tier Helper
 * Extracts subscription tier from Stripe data using metadata or product name
 * No hardcoded values or env vars needed - fully dynamic
 */

import Stripe from "stripe";
import { logger } from "@/lib/logger";

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
      logger.warn("[STRIPE TIER] No price ID found in subscription", {
        subscriptionId: subscription.id,
      });
      return "starter";
    }

    // Fetch full price details with product
    const price = await stripe.prices.retrieve(priceId, {
      expand: ["product"],
    });

    logger.info("[STRIPE TIER] Fetched price details", {
      priceId: price.id,
      hasMetadata: !!price.metadata,
      productId: typeof price.product === "string" ? price.product : price.product.id,
    });

    // 1. Check price metadata first
    if (price.metadata?.tier) {
      const tier = normalizeTier(price.metadata.tier);
      logger.info("[STRIPE TIER] Found tier in price metadata", {
        tier,
        rawValue: price.metadata.tier,
      });
      return tier;
    }

    // 2. Check product metadata
    const product = typeof price.product === "string" ? null : price.product;

    // Type guard: Check if product is not deleted and has metadata
    if (product && !product.deleted && "metadata" in product && product.metadata?.tier) {
      const tier = normalizeTier(product.metadata.tier);
      logger.info("[STRIPE TIER] Found tier in product metadata", {
        tier,
        rawValue: product.metadata.tier,
      });
      return tier;
    }

    // 3. Parse from product name
    if (product && !product.deleted && "name" in product && product.name) {
      const tier = parseTierFromName(product.name);
      logger.info("[STRIPE TIER] Parsed tier from product name", {
        tier,
        productName: product.name,
      });
      return tier;
    }

    // 4. Default
    logger.warn("[STRIPE TIER] Could not determine tier, defaulting to starter", {
      priceId: price.id,
      productName: product && "name" in product ? product.name : "unknown",
    });
    return "starter";
  } catch (error) {
    logger.error("[STRIPE TIER] Error extracting tier", {
      error: error instanceof Error ? error.message : String(error),
      subscriptionId: subscription.id,
    });
    return "starter";
  }
}

/**
 * Normalize tier string to valid tier type
 * Ensures ONLY starter/pro/enterprise are returned - normalizes all legacy names
 * This is the single source of truth for tier normalization
 */
export function normalizeTier(tierString: string | null | undefined): SubscriptionTier {
  if (!tierString || typeof tierString !== "string") {
    return "starter";
  }

  const normalized = tierString.toLowerCase().trim();

  // Direct matches - use as-is
  if (normalized === "enterprise") {
    return "enterprise";
  }
  if (normalized === "pro") {
    return "pro";
  }
  if (normalized === "starter") {
    return "starter";
  }

  // Legacy/alternative names - normalize to new names
  if (normalized === "premium") {
    return "enterprise";
  }
  if (normalized === "standard" || normalized === "professional" || normalized === "plus") {
    return "pro";
  }
  if (normalized === "basic") {
    return "starter";
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
