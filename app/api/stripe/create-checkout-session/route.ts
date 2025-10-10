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

    // ALWAYS get or create a real organization - NO MOCK IDs
    let org = null;
    
    // First priority: Try to find by owner_id (most reliable)
    const { data: orgByOwner, error: ownerError } = await supabase
      .from("organizations")
      .select("*")
      .eq("owner_id", user.id)
      .maybeSingle();
    
    if (orgByOwner) {
      org = orgByOwner;
      console.log('[STRIPE DEBUG] Found existing organization by owner_id:', org.id);
    } else if (ownerError) {
      console.log('[STRIPE DEBUG] Error querying organization by owner_id:', ownerError);
    }
    
    // Second priority: If organizationId provided and valid, verify it matches user
    if (!org && organizationId) {
      const { data: orgById, error: idError } = await supabase
        .from("organizations")
        .select("*")
        .eq("id", organizationId)
        .maybeSingle();
      
      if (orgById && orgById.owner_id === user.id) {
        org = orgById;
        console.log('[STRIPE DEBUG] Found organization by provided ID:', org.id);
      } else if (orgById) {
        console.warn('[STRIPE DEBUG] Organization', organizationId, 'exists but belongs to different user');
      } else if (idError) {
        console.log('[STRIPE DEBUG] Error querying organization by ID:', idError);
      }
    }

    // If NO organization found, create a real one NOW
    if (!org) {
      console.log('[STRIPE DEBUG] No organization found - creating real organization for user:', user.id);
      const userName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'User';
      
      const { data: newOrg, error: createError } = await supabase
        .from("organizations")
        .insert({
          name: `${userName}'s Organization`,
          slug: `org-${user.id.slice(0, 8)}-${Date.now()}`,
          owner_id: user.id,
          subscription_tier: "basic",
          subscription_status: "trialing",
          is_grandfathered: false,
          trial_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select("*")
        .single();

      if (createError) {
        console.error('[STRIPE ERROR] Failed to create organization:', createError);
        return NextResponse.json(
          { error: "Failed to create organization. Please try again." },
          { status: 500 }
        );
      }
      
      org = newOrg;
      console.log('[STRIPE DEBUG] ✅ Created new organization:', org.id);
      
      // Link any existing venues to this organization
      const { error: venueUpdateError } = await supabase
        .from("venues")
        .update({ organization_id: org.id })
        .eq("owner_id", user.id)
        .is("organization_id", null);
      
      if (venueUpdateError) {
        console.warn('[STRIPE DEBUG] Warning: Could not link venues to organization:', venueUpdateError);
      } else {
        console.log('[STRIPE DEBUG] Linked user venues to organization:', org.id);
      }
    }

    // Validate we have a real organization
    if (!org || !org.id) {
      console.error("[STRIPE ERROR] Failed to get or create organization for user:", user.id);
      return NextResponse.json(
        { error: "Could not create organization. Please contact support." },
        { status: 500 }
      );
    }
    
    // Always use the actual organization ID from database
    const actualOrgId = org.id;
    console.log('[STRIPE DEBUG] Using organization ID:', actualOrgId, 'for user:', user.id);

    console.log('[STRIPE DEBUG] Using organization:', {
      id: org.id,
      owner_id: org.owner_id,
      subscription_tier: org.subscription_tier,
      is_grandfathered: org.is_grandfathered,
      stripe_customer_id: org.stripe_customer_id
    });

    // Create or retrieve Stripe customer
    let customerId = org.stripe_customer_id;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: {
          organization_id: actualOrgId,
          user_id: user.id,
        },
      });

      customerId = customer.id;

      // Update organization with customer ID
      await supabase
        .from("organizations")
        .update({ stripe_customer_id: customerId })
        .eq("id", actualOrgId);
      
      console.log('[STRIPE DEBUG] Created Stripe customer:', customerId, 'for org:', actualOrgId);
    } else {
      console.log('[STRIPE DEBUG] Using existing Stripe customer:', customerId);
    }

    // Create checkout session
    const sessionData: Stripe.Checkout.SessionCreateParams = {
      customer: customerId,
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [
        {
          price: priceIds[tier],
          quantity: 1,
        },
      ],
      success_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/checkout/success?session_id={CHECKOUT_SESSION_ID}&tier=${tier}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/?upgrade=cancelled`,
      metadata: {
        organization_id: actualOrgId,
        tier,
        user_id: user.id,
      },
      subscription_data: {
        metadata: {
          organization_id: actualOrgId,
          tier,
          user_id: user.id,
        },
        trial_period_days: 14, // 14-day free trial
      },
    };

    console.log('[STRIPE DEBUG] Creating checkout session with data:', sessionData);

    const session = await stripe.checkout.sessions.create(sessionData);

    console.log('[STRIPE DEBUG] Checkout session created:', {
      id: session.id,
      url: session.url,
      customer: session.customer
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

