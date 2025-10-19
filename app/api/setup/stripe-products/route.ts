export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { stripe } from "@/lib/stripe-client";
import { apiLogger, logger } from '@/lib/logger';
import { getErrorMessage, getErrorDetails } from '@/lib/utils/errors';

export async function POST() {
  try {
    const products = [
      {
        tier: 'basic',
        name: 'Basic Plan',
        description: 'Perfect for small cafes and restaurants',
        amount: 9900, // £99.00 in pence
      },
      {
        tier: 'standard', 
        name: 'Standard Plan',
        description: 'Most popular for growing businesses',
        amount: 24900, // £249.00 in pence
      },
      {
        tier: 'premium',
        name: 'Premium Plan', 
        description: 'Unlimited power for enterprises',
        amount: 44900, // £449.00 in pence
      }
    ];

    const results = [];

    for (const product of products) {
      try {
        // Create product first
        const stripeProduct = await stripe.products.create({
          name: product.name,
          description: product.description,
          metadata: { tier: product.tier }
        });

        // Create price for the product
        const price = await stripe.prices.create({
          unit_amount: product.amount,
          currency: 'gbp',
          recurring: { interval: 'month' },
          product: stripeProduct.id,
          nickname: `${product.name} - £${product.amount / 100}/month`
        });

        results.push({
          tier: product.tier,
          productId: stripeProduct.id,
          priceId: price.id,
          status: 'created'
        });

        logger.debug(`[STRIPE SETUP] Created ${product.tier}: Product ${stripeProduct.id}, Price ${price.id}`);

      } catch (error: unknown) {
        logger.error(`[STRIPE ERROR] Failed to create ${product.tier}:`, { error: error instanceof Error ? getErrorMessage(error) : 'Unknown error' });
        results.push({
          tier: product.tier,
          status: 'error',
          error: error instanceof Error ? getErrorMessage(error) : 'Unknown error'
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Stripe products setup completed',
      results
    });

  } catch (error: unknown) {
    logger.error('Stripe products setup error:', { error: error instanceof Error ? getErrorMessage(error) : 'Unknown error' });
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? getErrorMessage(error) : 'Unknown error'
    }, { status: 500 });
  }
}
