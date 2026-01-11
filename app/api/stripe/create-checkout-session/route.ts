// Stripe Checkout Session - Create subscription checkout
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@/lib/supabase";
import { stripe } from "@/lib/stripe-client";

import { env } from "@/lib/env";
import { apiErrors } from "@/lib/api/standard-response";

// Pricing tiers from homepage - these are optional env vars
const getPriceIds = () => ({
  starter: env("STRIPE_BASIC_PRICE_ID") ?? undefined,
  pro: env("STRIPE_STANDARD_PRICE_ID") ?? undefined,
  enterprise: env("STRIPE_PREMIUM_PRICE_ID") ?? undefined,
});

// Get Stripe products and prices - reads only, never creates
const getStripePriceIds = async (): Promise<Record<string, string>> => {
  const priceIds: Record<string, string> = {
    starter: "",
    pro: "",
    enterprise: "",
  };

  // First, check if env vars are set (takes priority)
  const envPriceIds = getPriceIds();
  for (const tier of ["starter", "pro", "enterprise"] as const) {
    const envPriceId = envPriceIds[tier];
    if (envPriceId) {
      priceIds[tier] = envPriceId;
    }
  }

  // If all price IDs are found via env vars, return early
  if (priceIds.starter && priceIds.pro && priceIds.enterprise) {
    return priceIds;
  }

  // Otherwise, search for existing products by tier metadata in Stripe
  const existingProducts = await stripe.products.list({ limit: 100, active: true });
  const productsByTier = new Map<string, { productId: string; priceId?: string }>();

  // Find products with tier metadata
  for (const product of existingProducts.data) {
    const tier = product.metadata?.tier;
    if (tier && ["starter", "pro", "enterprise"].includes(tier)) {
      // Skip if we already found one for this tier (avoid duplicates)
      if (productsByTier.has(tier)) {
        continue;
      }

      // Get the most recent active price for this product
      const prices = await stripe.prices.list({
        product: product.id,
        active: true,
      });

      // Sort by created date, most recent first
      const sortedPrices = prices.data.sort((a, b) => b.created - a.created);
      const latestPrice = sortedPrices[0];

      if (latestPrice) {
        productsByTier.set(tier, {
          productId: product.id,
          priceId: latestPrice.id,
        });
      }
    }
  }

  // Use existing products/prices from Stripe (fill in any missing from env vars)
  for (const tier of ["starter", "pro", "enterprise"] as const) {
    if (!priceIds[tier]) {
      const existing = productsByTier.get(tier);
      if (existing?.priceId) {
        priceIds[tier] = existing.priceId;

      }
    }
  }

  // Validate all tiers are found
  const missingTiers: string[] = [];
  for (const tier of ["starter", "pro", "enterprise"] as const) {
    if (!priceIds[tier]) {
      missingTiers.push(tier);
    }
  }

  if (missingTiers.length > 0) {
    throw new Error(
      `Missing Stripe products/prices for tiers: ${missingTiers.join(", ")}. ` +
        `Please create them in Stripe Dashboard with metadata tier=${missingTiers.join(" or tier=")} ` +
        `or set environment variables: STRIPE_BASIC_PRICE_ID, STRIPE_STANDARD_PRICE_ID, STRIPE_PREMIUM_PRICE_ID`
    );
  }

  return priceIds;
};

export async function POST(_request: NextRequest) {
  try {
    // Get Stripe products and prices (read-only, never creates)
    const priceIds = await getStripePriceIds();

    const body = await _request.json();
    let { tier, organizationId, isSignup, email, fullName, venueName } = body;

    // Normalize tier to ensure only starter/pro/enterprise
    if (tier) {
      // Validate tier is one of the expected values (should already be correct from Stripe)
      const tierLower = tier.toLowerCase().trim();
      if (!["starter", "pro", "enterprise"].includes(tierLower)) {

        return apiErrors.badRequest("Invalid tier");
      }
      tier = tierLower as "starter" | "pro" | "enterprise";
    }

    if (!tier || !["starter", "pro", "enterprise"].includes(tier)) {
      return apiErrors.badRequest("Invalid tier");
    }

    // If this is a signup flow, handle it differently (no auth required)
    if (isSignup) {
      // Note: Email is NOT required at plan selection stage
      // Stripe checkout will collect the email during checkout
      // Email/fullName/venueName are optional here - only included if provided (e.g., from OAuth pre-fill)

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
        success_url: `${env("NEXT_PUBLIC_APP_URL") || "http://localhost:3000"}/auth/create-account?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${env("NEXT_PUBLIC_APP_URL") || "http://localhost:3000"}/?cancelled=true`,
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

      // Only include customer_email if provided (optional - Stripe will collect it during checkout)
      // This is mainly for OAuth flows where email might be pre-filled
      if (email && typeof email === "string" && email.trim() !== "") {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (emailRegex.test(email.trim())) {
          sessionData.customer_email = email.trim();
        }
      }

      const session = await stripe.checkout.sessions.create(sessionData);

      return NextResponse.json({ sessionId: session.id, url: session.url });
    }

    // For existing users, check auth - use getUser() for secure authentication
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return apiErrors.unauthorized("Unauthorized");
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
    } else if (ownerError) { /* Condition handled */ }

    // Second priority: If organizationId provided and valid, verify it matches user
    if (!org && organizationId) {
      const { data: orgById, error: idError } = await supabase
        .from("organizations")
        .select("*")
        .eq("id", organizationId)
        .maybeSingle();

      if (orgById && orgById.owner_user_id === user.id) {
        org = orgById;
      } else if (orgById) { /* Condition handled */ } else if (idError) {
        // Error getting organization ID
      }
    }

    // If NO organization found, create a real one NOW
    if (!org) {

      const { data: newOrg, error: createError } = await supabase
        .from("organizations")
        .insert({
          owner_user_id: user.id,
          subscription_tier: "starter",
          subscription_status: "trialing",
          trial_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        })
        .select("*")
        .single();

      if (createError) {

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

      if (venueUpdateError) { /* Condition handled */ } else {
        // Block handled
      }
    }

    // Validate we have a real organization
    if (!org || !org.id) {

      return NextResponse.json(
        { error: "Could not create organization. Please contact support." },
        { status: 500 }
      );
    }

    // Always use the actual organization ID from database
    const actualOrgId = org.id;

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

    } else {
      // Block handled
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
      success_url: `${env("NEXT_PUBLIC_APP_URL") || "http://localhost:3000"}/checkout/success?session_id={CHECKOUT_SESSION_ID}&tier=${tier}`,
      cancel_url: `${env("NEXT_PUBLIC_APP_URL") || "http://localhost:3000"}/?upgrade=cancelled`,
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
        // Only start trial if customer hasn't already used their trial
        // Check if trial has ended or if subscription is already active
        ...((org.trial_ends_at && new Date(org.trial_ends_at) < new Date()) ||
        org.subscription_status === "active"
          ? {} // No trial - customer already used it or is active
          : { trial_period_days: 14 }), // Start 14-day trial for new customers
      },
    };

    const session = await stripe.checkout.sessions.create(sessionData);

    return NextResponse.json({ sessionId: session.id, url: session.url });
  } catch (_error) {
    const errorMessage = _error instanceof Error ? _error.message : "Unknown _error";

    return NextResponse.json(
      { error: errorMessage || "Failed to create checkout session" },
      { status: 500 }
    );
  }
}
