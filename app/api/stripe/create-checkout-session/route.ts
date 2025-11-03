// Stripe Checkout Session - Create subscription checkout
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@/lib/supabase";
import { stripe } from "@/lib/stripe-client";
import { apiLogger as logger } from "@/lib/logger";

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
      tier: "basic",
      name: "Basic Plan",
      description: "Perfect for small cafes and restaurants",
      amount: 9900, // £99.00 in pence
    },
    {
      tier: "standard",
      name: "Standard Plan",
      description: "Most popular for growing businesses",
      amount: 24900, // £249.00 in pence
    },
    {
      tier: "premium",
      name: "Premium Plan",
      description: "Unlimited power for enterprises",
      amount: 44900, // £449.00 in pence
    },
  ];

  const priceIds: Record<string, string> = {
    /* Empty */
  };

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

      priceIds[product.tier] = price.id;
    } catch (_error) {
      logger.error(`[STRIPE ERROR] Failed to create ${product.tier} product/price:`, {
        error: _error instanceof Error ? _error.message : "Unknown _error",
      });
      throw _error;
    }
  }

  return priceIds;
};

export async function POST(_request: NextRequest) {
  try {
    // Ensure Stripe products and prices exist
    const priceIds = await ensureStripeProducts();

    const body = await _request.json();
    const { tier, organizationId, isSignup, email, fullName, venueName } = body;

    if (!tier || !["basic", "standard", "premium"].includes(tier)) {
      return NextResponse.json({ error: "Invalid tier" }, { status: 400 });
    }

    // If this is a signup flow, handle it differently (no auth required)
    if (isSignup) {
      // Create checkout session for new signup
      const sessionData: Stripe.Checkout.SessionCreateParams = {
        mode: "subscription",
        payment_method_types: ["card"],
        line_items: [
          {
            price: priceIds[tier],
            quantity: 1,
          },
        ],
        success_url: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/auth/create-account?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/?cancelled=true`,
        customer_email: email,
        metadata: {
          tier,
          is_signup: "true",
          full_name: fullName || "",
          venue_name: venueName || "",
        },
        subscription_data: {
          metadata: {
            tier,
            is_signup: "true",
            full_name: fullName || "",
            venue_name: venueName || "",
          },
          // Trial period managed by our organization logic, not Stripe
        },
        custom_text: {
          submit: {
            message: "Start your 14-day free trial",
          },
        },
      };

      const session = await stripe.checkout.sessions.create(sessionData);
      return NextResponse.json({ sessionId: session.id, url: session.url });
    }

    // For existing users, check auth
    const supabase = await createClient();
    const {
      data: { session: authSession },
    } = await supabase.auth.getSession();
    const user = authSession?.user;

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // ALWAYS get or create a real organization - NO MOCK IDs
    let org = null;

    // First priority: Try to find by owner_user_id (most reliable)
    const { data: orgByOwner, error: ownerError } = await supabase
      .from("organizations")
      .select("*")
      .eq("owner_user_id", user.id)
      .maybeSingle();

    if (orgByOwner) {
      org = orgByOwner;
    } else if (ownerError) {
      logger.debug("[STRIPE DEBUG] Error querying organization by owner_user_id:", {
        value: ownerError,
      });
    }

    // Second priority: If organizationId provided and valid, verify it matches user
    if (!org && organizationId) {
      const { data: orgById, error: idError } = await supabase
        .from("organizations")
        .select("*")
        .eq("id", organizationId)
        .maybeSingle();

      if (orgById && orgById.owner_user_id === user.id) {
        org = orgById;
      } else if (orgById) {
        logger.warn("[STRIPE DEBUG] Organization exists but belongs to different user", {
          organizationId,
        });
      } else if (idError) {
      }
    }

    // If NO organization found, create a real one NOW
    if (!org) {
      logger.debug(
        "[STRIPE DEBUG] No organization found - creating real organization for user:",
        user.id
      );

      const { data: newOrg, error: createError } = await supabase
        .from("organizations")
        .insert({
          owner_user_id: user.id,
          subscription_tier: "basic",
          subscription_status: "trialing",
          trial_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        })
        .select("*")
        .single();

      if (createError) {
        logger.error("[STRIPE ERROR] Failed to create organization:", { value: createError });
        return NextResponse.json(
          { error: "Failed to create organization. Please try again." },
          { status: 500 }
        );
      }

      org = newOrg;

      // Link unknown existing venues to this organization
      const { error: venueUpdateError } = await supabase
        .from("venues")
        .update({ organization_id: org.id })
        .eq("owner_user_id", user.id)
        .is("organization_id", null);

      if (venueUpdateError) {
        logger.warn("[STRIPE DEBUG] Warning: Could not link venues to organization:", {
          value: venueUpdateError,
        });
      } else {
      }
    }

    // Validate we have a real organization
    if (!org || !org.id) {
      logger.error("[STRIPE ERROR] Failed to get or create organization for user:", user.id);
      return NextResponse.json(
        { error: "Could not create organization. Please contact support." },
        { status: 500 }
      );
    }

    // Always use the actual organization ID from database
    const actualOrgId = org.id;
    logger.debug("[STRIPE DEBUG] Using organization ID:", {
      data: { orgId: actualOrgId, userId: user.id },
    });

    logger.debug("[STRIPE DEBUG] Using organization:", {
      id: org.id,
      owner_user_id: org.owner_user_id,
      subscription_tier: org.subscription_tier,
      stripe_customer_id: org.stripe_customer_id,
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

      logger.debug("[STRIPE DEBUG] Created Stripe customer:", {
        data: { customerId, orgId: actualOrgId },
      });
    } else {
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
      success_url: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/checkout/success?session_id={CHECKOUT_SESSION_ID}&tier=${tier}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/?upgrade=cancelled`,
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
        // Trial period managed by our organization logic, not Stripe
      },
    };


    const session = await stripe.checkout.sessions.create(sessionData);

    logger.debug("[STRIPE DEBUG] Checkout session created:", {
      id: session.id,
      url: session.url,
      customer: session.customer,
    });

    return NextResponse.json({ sessionId: session.id, url: session.url });
  } catch (_error) {
    const errorMessage = _error instanceof Error ? _error.message : "Unknown _error";
    logger.error("[STRIPE CHECKOUT] Error:", { error: errorMessage });
    return NextResponse.json(
      { error: errorMessage || "Failed to create checkout session" },
      { status: 500 }
    );
  }
}
