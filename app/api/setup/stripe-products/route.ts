import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe-client";
import { logger } from "@/lib/logger";
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

    for (const product of products) {
      try {
        // Create product first
        const stripeProduct = await stripe.products.create({
          name: product.name,
          description: product.description,
          metadata: { tier: product.tier },
        });

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
          status: "created",
        });

        logger.debug(
          `[STRIPE SETUP] Created ${product.tier}: Product ${stripeProduct.id}, Price ${price.id}`
        );
      } catch (_error) {
        logger.error(`[STRIPE ERROR] Failed to create ${product.tier}:`, {
          error: _error instanceof Error ? _error.message : "Unknown _error",
        });
        results.push({
          tier: product.tier,
          status: "error",
          error: _error instanceof Error ? _error.message : "Unknown _error",
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: "Stripe products setup completed",
      results,
    });
  } catch (_error) {
    logger.error("Stripe products setup error:", {
      error: _error instanceof Error ? _error.message : "Unknown _error",
    });
    return NextResponse.json(
      {
        success: false,
        error: _error instanceof Error ? _error.message : "Unknown _error",
      },
      { status: 500 }
    );
  }
}
