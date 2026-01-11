import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe-client";
import { PRICING_TIERS } from "@/lib/pricing-tiers";

export async function POST() {
  try {
    // Use shared PRICING_TIERS configuration
    const products = Object.entries(PRICING_TIERS).map(([tierKey, tierData]) => ({

      name: `${tierData.name} Plan`,

      amount: tierData.priceNumeric * 100, // Convert to pence
    }));

    const results = [];

    // Get existing products to avoid duplicates
    const existingProducts = await stripe.products.list({ limit: 100 });
    const existingProductsByTier = new Map<string, { productId: string; priceId?: string }>();

    for (const existingProduct of existingProducts.data) {
      const tier = existingProduct.metadata?.tier;
      if (tier && ["starter", "pro", "enterprise"].includes(tier)) {
        // Get the active price for this product
        const prices = await stripe.prices.list({

        existingProductsByTier.set(tier, {

      }
    }

    for (const product of products) {
      try {
        // Check if product already exists
        const existing = existingProductsByTier.get(product.tier);

        if (existing && existing.priceId) {
          // Product and price already exist - reuse them
          results.push({

            message: "Product and price already exist, reusing",

          continue;
        }

        // Create product if it doesn't exist
        let stripeProduct;
        if (existing?.productId) {
          stripeProduct = await stripe.products.retrieve(existing.productId);
        } else {
          stripeProduct = await stripe.products.create({

            metadata: { tier: product.tier },

        }

        // Create price for the product
        const price = await stripe.prices.create({

          recurring: { interval: "month" },

          nickname: `${product.name} - £${product.amount / 100}/month`,

        results.push({

          message: existing ? "Product existed, created new price" : "Product and price created",

      } catch (_error) {
        
        results.push({

      }
    }

    // Generate environment variables summary
    const envVars = {

    };

    return NextResponse.json({

      results,

      instructions:
        "Copy the price IDs above and set them as environment variables in Railway: STRIPE_BASIC_PRICE_ID, STRIPE_STANDARD_PRICE_ID, STRIPE_PREMIUM_PRICE_ID",

  } catch (_error) {
    
    return NextResponse.json(
      {

      },
      { status: 500 }
    );
  }
}
