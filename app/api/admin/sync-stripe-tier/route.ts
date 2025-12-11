import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";
import { getStripeClient } from "@/lib/stripe-client";
import { logger } from "@/lib/logger";
import { apiErrors } from "@/lib/api/standard-response";

/**
 * Sync subscription tier from Stripe to database
 * POST /api/admin/sync-stripe-tier
 * Fetches actual subscription from Stripe and updates database
 */
export async function POST() {
  try {
    // Initialize Stripe client inside function to avoid build-time errors
    const stripe = getStripeClient();
    const supabase = await createClient();

    // Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return apiErrors.unauthorized("Unauthorized");
    }

    // Admin role check
    const { data: userRole } = await supabase
      .from("user_venue_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (userRole?.role !== "admin" && userRole?.role !== "owner") {
      return apiErrors.forbidden("Admin access required");
    }

    logger.info("[SYNC STRIPE TIER] Request to sync tier from Stripe", {
      userId: user.id,
      email: user.email,
    });

    // Find organization for this user
    const { data: venues } = await supabase
      .from("venues")
      .select("organization_id")
      .eq("owner_user_id", user.id)
      .limit(1);

    if (!venues || venues.length === 0) {
      return apiErrors.notFound("No organization found");
    }

    const organizationId = venues[0].organization_id;

    // Get current org data
    const { data: org } = await supabase
      .from("organizations")
      .select("*")
      .eq("id", organizationId)
      .single();

    if (!org) {
      return apiErrors.notFound("Organization not found");
    }

    logger.info("[SYNC STRIPE TIER] Current database state", {
      orgId: organizationId,
      currentTier: org.subscription_tier,
      currentStatus: org.subscription_status,
      stripeCustomerId: org.stripe_customer_id,
    });

    if (!org.stripe_customer_id) {
      return NextResponse.json(
        { error: "No Stripe customer ID found. Please set up billing first." },
        { status: 400 }
      );
    }

    // Fetch subscription from Stripe
    logger.info("[SYNC STRIPE TIER] Fetching subscriptions from Stripe...", {
      customerId: org.stripe_customer_id,
    });

    const subscriptions = await stripe.subscriptions.list({
      customer: org.stripe_customer_id,
      limit: 10,
    });

    logger.info("[SYNC STRIPE TIER] Stripe subscriptions found", {
      count: subscriptions.data.length,
      subscriptions: subscriptions.data.map((s) => ({
        id: s.id,
        status: s.status,
        metadata: s.metadata,
      })),
    });

    if (subscriptions.data.length === 0) {
      return apiErrors.notFound("No Stripe subscription found");
    }

    // Get the active subscription (or most recent one)
    const activeSubscription =
      subscriptions.data.find((s) => s.status === "active" || s.status === "trialing") ||
      subscriptions.data[0];

    logger.info("[SYNC STRIPE TIER] Using subscription", {
      id: activeSubscription.id,
      status: activeSubscription.status,
      metadata: activeSubscription.metadata,
    });

    // Get tier from Stripe metadata
    const stripeTier = activeSubscription.metadata?.tier;

    if (!stripeTier) {
      logger.warn("[SYNC STRIPE TIER] No tier in Stripe metadata");

      return NextResponse.json(
        {
          error: "Tier not found in Stripe subscription metadata.",
          hint: "Your Stripe subscription needs a 'tier' field in metadata (starter/pro/enterprise).",
          stripeData: {
            subscriptionId: activeSubscription.id,
            status: activeSubscription.status,
            metadata: activeSubscription.metadata,
          },
          suggestion: "Use /api/admin/set-premium to manually set tier to enterprise",
        },
        { status: 400 }
      );
    }

    // Calculate trial end date
    let trialEndsAt = null;
    if (activeSubscription.trial_end) {
      trialEndsAt = new Date(activeSubscription.trial_end * 1000).toISOString();
    }

    // Update database to match Stripe
    const updateData = {
      subscription_tier: stripeTier,
      subscription_status: activeSubscription.status,
      stripe_subscription_id: activeSubscription.id,
      trial_ends_at: trialEndsAt,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from("organizations")
      .update(updateData)
      .eq("id", organizationId);

    if (error) {
      logger.error("[SYNC STRIPE TIER] Database update failed", { error });
      return apiErrors.internal("Failed to update database");
    }

    logger.info("[SYNC STRIPE TIER] ✅ Successfully synced tier from Stripe", {
      orgId: organizationId,
      newTier: stripeTier,
      newStatus: activeSubscription.status,
    });

    return NextResponse.json({
      success: true,
      message: `Subscription synced from Stripe`,
      before: {
        tier: org.subscription_tier,
        status: org.subscription_status,
      },
      after: {
        tier: stripeTier,
        status: activeSubscription.status,
      },
      stripe: {
        subscriptionId: activeSubscription.id,
        status: activeSubscription.status,
      },
    });
  } catch (err) {
    logger.error("[SYNC STRIPE TIER] Unexpected error", { error: err });
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}
