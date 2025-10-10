// Stripe Checkout Session - Create subscription checkout
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe-client";

// Pricing tiers from homepage
const PRICE_IDS = {
  basic: process.env.STRIPE_BASIC_PRICE_ID,
  standard: process.env.STRIPE_STANDARD_PRICE_ID,
  premium: process.env.STRIPE_PREMIUM_PRICE_ID,
};

// Create Stripe products and prices if they don't exist
const ensureStripeProducts = async () => {
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

  const priceIds: Record<string, string> = {};

  for (const product of products) {
    try {
      // Check if we already have a price ID for this tier
      const existingPriceId = PRICE_IDS[product.tier as keyof typeof PRICE_IDS];
      if (existingPriceId) {
        priceIds[product.tier] = existingPriceId;
        continue;
      }

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

      priceIds[product.tier] = price.id;
      console.log(`[STRIPE SETUP] Created ${product.tier} price: ${price.id}`);

    } catch (error) {
      console.error(`[STRIPE ERROR] Failed to create ${product.tier} product/price:`, error);
      throw error;
    }
  }

  return priceIds;
};

export async function POST(request: NextRequest) {
  try {
    // Ensure Stripe products and prices exist
    const priceIds = await ensureStripeProducts();

    const supabase = await createClient();

    // Check auth
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { tier, organizationId } = body;

    if (!tier || !["basic", "standard", "premium"].includes(tier)) {
      return NextResponse.json(
        { error: "Invalid tier" },
        { status: 400 }
      );
    }

    // Get organization with multiple fallback approaches
    let org = null;
    
    // Handle mock organization IDs (legacy/default accounts)
    if (organizationId && (organizationId.startsWith('legacy-') || organizationId.startsWith('default-') || organizationId.startsWith('error-'))) {
      console.log('[STRIPE DEBUG] Using mock organization ID:', organizationId);
      // Create a mock organization object for legacy accounts
      org = {
        id: organizationId,
        owner_id: user.id,
        subscription_tier: 'basic',
        is_grandfathered: false,
        stripe_customer_id: null
      };
    } else {
      // Try to find real organization
      if (organizationId) {
        try {
          const { data: orgById } = await supabase
            .from("organizations")
            .select("*")
            .eq("id", organizationId)
            .single();
          org = orgById;
        } catch (error) {
          console.log('[STRIPE DEBUG] Organization by ID failed:', error);
        }
      }
      
      // If no org found by ID, try to find user's organization by owner_id
      if (!org) {
        try {
          const { data: orgByOwner } = await supabase
            .from("organizations")
            .select("*")
            .eq("owner_id", user.id)
            .single();
          org = orgByOwner;
        } catch (error) {
          console.log('[STRIPE DEBUG] Organization by owner failed:', error);
        }
      }
      
      // If still no org, try to find through user_venue_roles
      if (!org) {
        try {
          const { data: userVenueRole } = await supabase
            .from("user_venue_roles")
            .select("organization_id, organizations(*)")
            .eq("user_id", user.id)
            .single();
          
          if (userVenueRole && userVenueRole.organizations) {
            org = userVenueRole.organizations;
          }
        } catch (error) {
          console.log('[STRIPE DEBUG] User venue role query failed:', error);
        }
      }

      // If still no org, try venues table for legacy accounts
      if (!org) {
        try {
          const { data: venues } = await supabase
            .from("venues")
            .select("venue_id, name, owner_id")
            .eq("owner_id", user.id)
            .limit(1);
          
          if (venues && venues.length > 0) {
            // Create mock organization for legacy account
            org = {
              id: `legacy-${user.id}`,
              owner_id: user.id,
              subscription_tier: 'basic',
              is_grandfathered: false,
              stripe_customer_id: null
            };
          }
        } catch (error) {
          console.log('[STRIPE DEBUG] Venues query failed:', error);
        }
      }
    }

    if (!org) {
      console.error("No organization found for user:", user.id, "organizationId:", organizationId);
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 }
      );
    }

    console.log('[STRIPE DEBUG] Using organization:', {
      id: org.id,
      owner_id: org.owner_id,
      subscription_tier: org.subscription_tier,
      is_grandfathered: org.is_grandfathered
    });

    // Create or retrieve Stripe customer
    let customerId = org.stripe_customer_id;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: {
          organization_id: organizationId,
          user_id: user.id,
        },
      });

      customerId = customer.id;

      // Update organization with customer ID
      await supabase
        .from("organizations")
        .update({ stripe_customer_id: customerId })
        .eq("id", organizationId);
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [
        {
          price: priceIds[tier],
          quantity: 1,
        },
      ],
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?upgrade=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?upgrade=cancelled`,
      metadata: {
        organization_id: organizationId,
        tier,
      },
      subscription_data: {
        metadata: {
          organization_id: organizationId,
          tier,
        },
        trial_period_days: 14, // 14-day free trial
      },
    });

    return NextResponse.json({ sessionId: session.id, url: session.url });
  } catch (error: any) {
    console.error("[STRIPE CHECKOUT] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create checkout session" },
      { status: 500 }
    );
  }
}

