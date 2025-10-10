import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe-client";

export async function GET() {
  try {
    // Check environment variables
    const envVars = {
      STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY ? 'Set' : 'Missing',
      STRIPE_BASIC_PRICE_ID: process.env.STRIPE_BASIC_PRICE_ID || 'Missing',
      STRIPE_STANDARD_PRICE_ID: process.env.STRIPE_STANDARD_PRICE_ID || 'Missing',
      STRIPE_PREMIUM_PRICE_ID: process.env.STRIPE_PREMIUM_PRICE_ID || 'Missing',
    };

    // Try to list existing products and prices
    let existingPrices = [];
    try {
      const prices = await stripe.prices.list({ limit: 10 });
      existingPrices = prices.data.map(price => ({
        id: price.id,
        nickname: price.nickname || 'No nickname',
        unit_amount: price.unit_amount,
        currency: price.currency,
        recurring: price.recurring?.interval,
      }));
    } catch (error) {
      console.error('Error listing Stripe prices:', error);
    }

    return NextResponse.json({
      success: true,
      environment: envVars,
      existingPrices,
      message: 'Stripe configuration check complete'
    });

  } catch (error) {
    console.error('Stripe config check error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
