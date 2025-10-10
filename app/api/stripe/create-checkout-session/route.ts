// Stripe Checkout Session - Create subscription checkout
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe-client";

// Pricing tiers from homepage
const PRICE_IDS = {
  basic: process.env.STRIPE_BASIC_PRICE_ID || "price_basic",
  standard: process.env.STRIPE_STANDARD_PRICE_ID || "price_standard",
  premium: process.env.STRIPE_PREMIUM_PRICE_ID || "price_premium",
};

export async function POST(request: NextRequest) {
  try {
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

    // Get organization - first try with organizationId if provided
    let org = null;
    
    if (organizationId) {
      const { data: orgById } = await supabase
        .from("organizations")
        .select("*")
        .eq("id", organizationId)
        .single();
      org = orgById;
    }
    
    // If no org found by ID, try to find user's organization by owner_id
    if (!org) {
      const { data: orgByOwner } = await supabase
        .from("organizations")
        .select("*")
        .eq("owner_id", user.id)
        .single();
      org = orgByOwner;
    }
    
    // If still no org, try to find through user_venue_roles
    if (!org) {
      const { data: userVenueRole } = await supabase
        .from("user_venue_roles")
        .select("organization_id, organizations(*)")
        .eq("user_id", user.id)
        .single();
      
      if (userVenueRole && userVenueRole.organizations) {
        org = userVenueRole.organizations;
      }
    }

    if (!org) {
      console.error("No organization found for user:", user.id, "organizationId:", organizationId);
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 }
      );
    }

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
          price: PRICE_IDS[tier as keyof typeof PRICE_IDS],
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

