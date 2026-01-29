import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe-client";

import { PRICING_TIERS } from "@/lib/pricing-tiers";

export async function POST() {
  try {
    // Use shared PRICING_TIERS configuration
    const products = Object.entries(PRICING_TIERS).map(([tierKey, tierData]) => ({
      tier: tierKey,
      name: `${tierData.name} Plan`,
      description: tierData.description,
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
          product: existingProduct.id,
          active: true,
          limit: 1,
        });
        existingProductsByTier.set(tier, {
          productId: existingProduct.id,
          priceId: prices.data[0]?.id,
        });
      }
    }

    for (const product of products) {
      try {
        // Check if product already exists
        const existing = existingProductsByTier.get(product.tier);

        if (existing && existing.priceId) {
          // Product and price already exist - reuse them
          results.push({
            tier: product.tier,
            productId: existing.productId,
            priceId: existing.priceId,
            status: "existing",
            message: "Product and price already exist, reusing",
          });

          continue;
        }

        // Create product if it doesn't exist
        let stripeProduct;
        if (existing?.productId) {
          stripeProduct = await stripe.products.retrieve(existing.productId);
        } else {
          stripeProduct = await stripe.products.create({
            name: product.name,
            description: product.description,
            metadata: { tier: product.tier },
          });
        }

        // Create price for the product
        const price = await stripe.prices.create({
          unit_amount: product.amount,
          currency: "gbp",
          recurring: { interval: "month" },
          product: stripeProduct.id,
          nickname: `${product.name} - £${product.amount / 100}/month`,
        });

        results.push({
          tier: product.tier,
          productId: stripeProduct.id,
          priceId: price.id,
          status: existing ? "price_created" : "created",
          message: existing ? "Product existed, created new price" : "Product and price created",
          envVarName:
            product.tier === "starter"
              ? "STRIPE_BASIC_PRICE_ID"
              : product.tier === "pro"
                ? "STRIPE_STANDARD_PRICE_ID"
                : "STRIPE_PREMIUM_PRICE_ID",
        });
      } catch (_error) {
        results.push({
          tier: product.tier,
          status: "error",
          error: _error instanceof Error ? _error.message : "Unknown _error",
        });
      }
    }

    // Generate environment variables summary
    const envVars = {
      STRIPE_BASIC_PRICE_ID: results.find((r) => r.tier === "starter")?.priceId || "NOT_SET",
      STRIPE_STANDARD_PRICE_ID: results.find((r) => r.tier === "pro")?.priceId || "NOT_SET",
      STRIPE_PREMIUM_PRICE_ID: results.find((r) => r.tier === "enterprise")?.priceId || "NOT_SET",
    };

    return NextResponse.json({
      success: true,
      message: "Stripe products setup completed",
      results,
      environmentVariables: envVars,
      instructions:
        "Copy the price IDs above and set them as environment variables in Railway: STRIPE_BASIC_PRICE_ID, STRIPE_STANDARD_PRICE_ID, STRIPE_PREMIUM_PRICE_ID",
    });
  } catch (_error) {
    return NextResponse.json(
      {
        success: false,
        error: _error instanceof Error ? _error.message : "Unknown _error",
      },
      { status: 500 }
    );
  }
}
