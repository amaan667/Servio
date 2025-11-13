// Sign Up with Required Subscription
// New accounts must select a plan during signup (14-day free trial)

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { stripe } from "@/lib/stripe-client";
import { logger } from "@/lib/logger";

const PRICE_IDS = {
  starter: process.env.STRIPE_BASIC_PRICE_ID || "price_basic",
  pro: process.env.STRIPE_STANDARD_PRICE_ID || "price_standard",
  enterprise: process.env.STRIPE_PREMIUM_PRICE_ID || "price_premium",
};

export async function POST(_request: NextRequest) {
  let body: {
    email?: string;
    password?: string;
    fullName?: string;
    venueName?: string;
    venueType?: string;
    serviceType?: string;
    tier?: string;
    stripeSessionId?: string;
  } = {};

  try {
    body = await _request.json();
    const {
      email,
      password,
      fullName,
      venueName,
      venueType,
      serviceType = "table_service",
      tier,
      stripeSessionId,
    } = body;

    // Validate required fields
    if (!email || !password || !fullName || !venueName || !tier) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (!["starter", "pro", "enterprise"].includes(tier)) {
      return NextResponse.json({ error: "Invalid tier" }, { status: 400 });
    }

    const supabase = createAdminClient();

    // Check if email already exists as a user
    const { data: existingUsers } = await supabase.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(
      (u) => u.email?.toLowerCase() === email.toLowerCase()
    );

    if (existingUser) {
      // Check if this user has staff roles but no owner venues
      const { data: staffRoles } = await supabase
        .from("user_venue_roles")
        .select("venue_id, role")
        .eq("user_id", existingUser.id)
        .limit(1)
        .maybeSingle();

      const { data: ownerVenues } = await supabase
        .from("venues")
        .select("venue_id")
        .eq("owner_user_id", existingUser.id)
        .limit(1)
        .maybeSingle();

      if (staffRoles && !ownerVenues) {
        // User has staff roles but no owner venues - prevent creating owner account
        // Get venue name for better error message
        const { data: venue } = await supabase
          .from("venues")
          .select("venue_name")
          .eq("venue_id", staffRoles.venue_id)
          .maybeSingle();

        const venueName = venue?.venue_name || "a venue";
        const roleName = staffRoles.role.charAt(0).toUpperCase() + staffRoles.role.slice(1);

        logger.warn("[SIGNUP] Attempted owner account creation for staff-only email", {
          email,
          userId: existingUser.id,
          staffVenueId: staffRoles.venue_id,
          role: staffRoles.role,
          venueName: venue?.venue_name,
        });

        return NextResponse.json(
          {
            error: `You are already a ${roleName} at ${venueName}. Please sign in to your existing account. If you need to create an owner account, please use a different email address.`,
          },
          { status: 409 }
        );
      }

      // User exists and has owner venues - they should sign in instead
      if (ownerVenues) {
        return NextResponse.json(
          {
            error:
              "An account with this email already exists. Please sign in to your existing account.",
          },
          { status: 409 }
        );
      }
    }

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

    // Create or retrieve Stripe customer
    let customer;
    if (stripeSessionId) {
      // Get customer from existing session
      const session = await stripe.checkout.sessions.retrieve(stripeSessionId);
      if (session.customer) {
        customer = await stripe.customers.retrieve(session.customer as string);
      } else {
        // Fallback: create new customer
        customer = await stripe.customers.create({
          email,
          name: fullName,
          metadata: {
            user_id: userId,
            venue_name: venueName,
          },
        });
      }
    } else {
      // Create new customer
      customer = await stripe.customers.create({
        email,
        name: fullName,
        metadata: {
          user_id: userId,
          venue_name: venueName,
        },
      });
    }

    const { data: org, error: orgError } = await supabase
      .from("organizations")
      .insert({
        owner_user_id: userId,
        subscription_tier: tier,
        subscription_status: "trialing",
        stripe_customer_id: customer.id,
        trial_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      })
      .select()
      .single();

    if (orgError || !org) {
      logger.error("[SIGNUP WITH SUBSCRIPTION] Failed to create organization:", {
        error: orgError,
        userId,
        email,
        tier,
        stripeCustomerId: customer.id,
      });

      // Try to clean up created user if organization creation fails
      try {
        await supabase.auth.admin.deleteUser(userId);
      } catch (cleanupError) {
        logger.error(
          "[SIGNUP WITH SUBSCRIPTION] Failed to cleanup user after org creation failure:",
          cleanupError
        );
      }

      return NextResponse.json(
        {
          error: "Failed to create organization",
          details: orgError?.message || "Unknown error",
        },
        { status: 500 }
      );
    }

    // Create venue
    const { error: venueError } = await supabase
      .from("venues")
      .insert({
        venue_id: venueId,
        name: venueName,
        business_type: venueType,
        service_type: serviceType,
        owner_user_id: userId,
        organization_id: org.id,
      })
      .select()
      .single();

    if (venueError) {
      logger.error("[SIGNUP WITH SUBSCRIPTION] Failed to create venue:", {
        error: venueError,
        userId,
        venueId,
        venueName,
        organizationId: org.id,
      });

      // Try to clean up created resources if venue creation fails
      try {
        await supabase.from("organizations").delete().eq("id", org.id);
        await supabase.auth.admin.deleteUser(userId);
      } catch (cleanupError) {
        logger.error(
          "[SIGNUP WITH SUBSCRIPTION] Failed to cleanup after venue creation failure:",
          cleanupError
        );
      }

      return NextResponse.json(
        {
          error: "Failed to create venue",
          details: venueError.message,
        },
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

    // If we have a stripeSessionId, the payment is already complete
    // Otherwise, create a checkout session
    if (stripeSessionId) {
      // Payment already completed, just return success
      return NextResponse.json({
        success: true,
        userId,
        venueId,
        organizationId: org.id,
        message: "Account created successfully! Your 14-day free trial is active.",
      });
    } else {
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
    }
  } catch (_error) {
    const errorMessage = _error instanceof Error ? _error.message : "Unknown error";
    const errorStack = _error instanceof Error ? _error.stack : undefined;

    logger.error("[SIGNUP WITH SUBSCRIPTION] Error:", {
      error: errorMessage,
      stack: errorStack,
      email: body?.email,
      tier: body?.tier,
    });

    return NextResponse.json(
      {
        error: "Signup failed",
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}
