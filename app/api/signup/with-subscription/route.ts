// Sign Up with Required Subscription
// New accounts must select a plan during signup (14-day free trial)

import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/server";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-11-20.acacia",
});

const PRICE_IDS = {
  basic: process.env.STRIPE_BASIC_PRICE_ID || "price_basic",
  standard: process.env.STRIPE_STANDARD_PRICE_ID || "price_standard",
  premium: process.env.STRIPE_PREMIUM_PRICE_ID || "price_premium",
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, fullName, venueName, venueType, tier } = body;

    // Validate required fields
    if (!email || !password || !fullName || !venueName || !tier) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    if (!["basic", "standard", "premium"].includes(tier)) {
      return NextResponse.json(
        { error: "Invalid tier" },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // Create user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm for better UX
      user_metadata: {
        full_name: fullName,
      },
    });

    if (authError || !authData.user) {
      return NextResponse.json(
        { error: authError?.message || "Failed to create account" },
        { status: 400 }
      );
    }

    const userId = authData.user.id;
    const venueId = `venue-${userId.slice(0, 8)}`;
    const orgSlug = `${venueName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${userId.slice(0, 8)}`;

    // Create Stripe customer
    const customer = await stripe.customers.create({
      email,
      name: fullName,
      metadata: {
        user_id: userId,
        venue_name: venueName,
      },
    });

    // Create organization (not grandfathered - regular subscription required)
    const { data: org, error: orgError } = await supabase
      .from("organizations")
      .insert({
        name: `${venueName} Organization`,
        slug: orgSlug,
        owner_id: userId,
        subscription_tier: tier,
        subscription_status: "trialing",
        stripe_customer_id: customer.id,
        is_grandfathered: false, // New accounts are NOT grandfathered
        trial_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        billing_email: email,
      })
      .select()
      .single();

    if (orgError || !org) {
      return NextResponse.json(
        { error: "Failed to create organization" },
        { status: 500 }
      );
    }

    // Create venue
    const { data: venue, error: venueError } = await supabase
      .from("venues")
      .insert({
        venue_id: venueId,
        name: venueName,
        business_type: venueType,
        owner_id: userId,
        organization_id: org.id,
      })
      .select()
      .single();

    if (venueError) {
      return NextResponse.json(
        { error: "Failed to create venue" },
        { status: 500 }
      );
    }

    // Create user-venue role
    await supabase.from("user_venue_roles").insert({
      user_id: userId,
      venue_id: venueId,
      organization_id: org.id,
      role: "owner",
    });

    // Create Stripe checkout session for payment (14-day trial)
    const session = await stripe.checkout.sessions.create({
      customer: customer.id,
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [
        {
          price: PRICE_IDS[tier as keyof typeof PRICE_IDS],
          quantity: 1,
        },
      ],
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/${venueId}?welcome=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/sign-up?cancelled=true`,
      metadata: {
        organization_id: org.id,
        venue_id: venueId,
        tier,
      },
      subscription_data: {
        metadata: {
          organization_id: org.id,
          tier,
        },
        trial_period_days: 14, // 14-day free trial
      },
    });

    return NextResponse.json({
      success: true,
      userId,
      venueId,
      organizationId: org.id,
      checkoutUrl: session.url,
      message: "Account created! Complete payment setup to activate your 14-day free trial.",
    });
  } catch (error: any) {
    console.error("[SIGNUP WITH SUBSCRIPTION] Error:", error);
    return NextResponse.json(
      { error: error.message || "Signup failed" },
      { status: 500 }
    );
  }
}

