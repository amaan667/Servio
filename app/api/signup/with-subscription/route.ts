// Sign Up with Required Subscription
// New accounts must select a plan during signup (14-day free trial)
// Note: This route allows unauthenticated access for signup

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";
import { stripe } from "@/lib/stripe-client";
import { logger } from "@/lib/logger";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";

const PRICE_IDS = {
  starter: process.env.STRIPE_BASIC_PRICE_ID || "price_basic",
  pro: process.env.STRIPE_STANDARD_PRICE_ID || "price_standard",
  enterprise: process.env.STRIPE_PREMIUM_PRICE_ID || "price_premium",
};

export async function POST(req: NextRequest) {
  let body: {
    email?: string;
    password?: string;
    fullName?: string;
    venueName?: string;
    venueType?: string;
    serviceType?: string;
    tier?: string;
    stripeSessionId?: string;
  } | null = null;
  
  try {
    // STEP 1: Rate limiting (ALWAYS FIRST)
    const rateLimitResult = await rateLimit(req, RATE_LIMITS.AUTH);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        {
          error: "Too many requests",
          message: `Rate limit exceeded. Try again in ${Math.ceil((rateLimitResult.reset - Date.now()) / 1000)} seconds.`,
        },
        { status: 429 }
      );
    }

    // STEP 2: Parse request
    body = await req.json();
    if (!body) {
      return NextResponse.json({ error: "Request body is required" }, { status: 400 });
    }
    
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

    // STEP 3: Validate inputs
    if (!email || !password || !fullName || !venueName || !tier) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (!["starter", "pro", "enterprise"].includes(tier)) {
      return NextResponse.json({ error: "Invalid tier" }, { status: 400 });
    }

    // STEP 4: Security - Signup route allows unauthenticated access
    // STEP 5: Business logic
    const supabase = await createClient();

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

    // Create user FIRST (we'll add customer ID to metadata after)
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: false, // Require email verification
      user_metadata: {
        full_name: fullName,
        // Store signup data temporarily - will be used to create org/venue after onboarding
        pending_signup: {
          venueName,
          venueType,
          serviceType,
          tier,
          stripeSessionId,
        },
      },
    });

    if (authError || !authData.user) {
      logger.error("[SIGNUP] Error creating user:", {
        error: authError?.message,
        email,
      });
      return NextResponse.json(
        {
          error: authError?.message || "Failed to create account",
          message: process.env.NODE_ENV === "development" ? authError?.message : "Account creation failed",
        },
        { status: 400 }
      );
    }

    const userId = authData.user.id;

    // Create or retrieve Stripe customer (needed for subscription)
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
            pending_setup: "true", // Mark as pending until onboarding completes
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
          pending_setup: "true",
        },
      });
    }

    // Store Stripe customer ID in user metadata for later use
    await supabase.auth.admin.updateUserById(userId, {
      user_metadata: {
        full_name: fullName,
        pending_signup: {
          venueName,
          venueType,
          serviceType,
          tier,
          stripeSessionId,
          stripeCustomerId: customer.id,
        },
      },
    });

    // STEP 6: Return success response
    return NextResponse.json({
      success: true,
      userId,
      message: "Account created successfully! Please complete onboarding to finish setup.",
    });
  } catch (_error) {
    const errorMessage = _error instanceof Error ? _error.message : "An unexpected error occurred";
    const errorStack = _error instanceof Error ? _error.stack : undefined;

    logger.error("[SIGNUP WITH SUBSCRIPTION] Unexpected error:", {
      error: errorMessage,
      stack: errorStack,
      email: body?.email,
      tier: body?.tier,
    });

    if (errorMessage.includes("Unauthorized") || errorMessage.includes("Forbidden")) {
      return NextResponse.json(
        {
          error: errorMessage.includes("Unauthorized") ? "Unauthorized" : "Forbidden",
          message: errorMessage,
        },
        { status: errorMessage.includes("Unauthorized") ? 401 : 403 }
      );
    }

    return NextResponse.json(
      {
        error: "Signup failed",
        details: errorMessage,
        message: process.env.NODE_ENV === "development" ? errorMessage : "Request processing failed",
        ...(process.env.NODE_ENV === "development" && errorStack ? { stack: errorStack } : {}),
      },
      { status: 500 }
    );
  }
}
