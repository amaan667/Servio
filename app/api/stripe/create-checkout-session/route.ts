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
    
    // Try to find real organization by owner_id first (most reliable)
    try {
      const { data: orgByOwner } = await supabase
        .from("organizations")
        .select("*")
        .eq("owner_id", user.id)
        .maybeSingle();
      org = orgByOwner;
      if (org) {
        console.log('[STRIPE DEBUG] Found organization by owner_id:', org.id);
      }
    } catch (error) {
      console.log('[STRIPE DEBUG] Organization by owner query failed:', error);
    }
    
    // If organization ID was provided and different from what we found, verify it
    if (organizationId && org && organizationId !== org.id) {
      console.warn('[STRIPE DEBUG] Provided organization ID', organizationId, 'differs from user\'s organization', org.id, '- using user\'s organization');
    }
    
    // If no org found by owner_id, try by provided ID
    if (!org && organizationId && !organizationId.startsWith('legacy-') && !organizationId.startsWith('default-') && !organizationId.startsWith('error-')) {
      try {
        const { data: orgById } = await supabase
          .from("organizations")
          .select("*")
          .eq("id", organizationId)
          .maybeSingle();
        org = orgById;
        if (org) {
          console.log('[STRIPE DEBUG] Found organization by provided ID:', org.id);
        }
      } catch (error) {
        console.log('[STRIPE DEBUG] Organization by ID query failed:', error);
      }
    }
    
    // If still no org, try to find through user_venue_roles
    if (!org) {
      try {
        const { data: userVenueRoles } = await supabase
          .from("user_venue_roles")
          .select("organization_id, organizations(*)")
          .eq("user_id", user.id)
          .limit(1);
        
        if (userVenueRoles && userVenueRoles.length > 0 && userVenueRoles[0].organizations) {
          org = userVenueRoles[0].organizations;
          console.log('[STRIPE DEBUG] Found organization through user_venue_roles:', org.id);
        }
      } catch (error) {
        console.log('[STRIPE DEBUG] User venue role query failed:', error);
      }
    }

    // If STILL no org found, create one now before proceeding
    if (!org) {
      console.log('[STRIPE DEBUG] No organization found, creating one for user:', user.id);
      try {
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
          console.error('[STRIPE DEBUG] Failed to create organization:', createError);
          throw createError;
        }
        
        org = newOrg;
        console.log('[STRIPE DEBUG] Created new organization:', org.id);
        
        // Update any venues to link to this organization
        await supabase
          .from("venues")
          .update({ organization_id: org.id })
          .eq("owner_id", user.id)
          .is("organization_id", null);
      } catch (error) {
        console.error('[STRIPE DEBUG] Error creating organization:', error);
      }
    }

    if (!org || !org.id) {
      console.error("[STRIPE ERROR] No organization found or created for user:", user.id, "providedOrgId:", organizationId);
      return NextResponse.json(
        { error: "Organization not found. Please contact support." },
        { status: 404 }
      );
    }
    
    // Use the actual organization ID we found/created
    const actualOrgId = org.id;

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
      success_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/?upgrade=success`,
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

