/**
 * Sync Subscription Tier from Stripe
 * Ensures organization.subscription_tier matches Stripe subscription
 * Uses metadata and product name - NO hardcoded Price IDs needed
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { stripe } from "@/lib/stripe-client";
import { logger } from "@/lib/logger";
import { getTierFromStripeSubscription } from "@/lib/stripe-tier-helper";

export async function POST(req: NextRequest) {
  try {
    const { organizationId } = await req.json();

    if (!organizationId) {
      return NextResponse.json({ error: "organizationId required" }, { status: 400 });
    }

    const supabase = createAdminClient();

    // Get organization with Stripe customer ID
    const { data: org, error: orgError } = await supabase
      .from("organizations")
      .select("id, stripe_customer_id, subscription_tier")
      .eq("id", organizationId)
      .single();

    if (orgError || !org) {
      logger.error("[SUBSCRIPTION SYNC] Organization not found", {
        organizationId,
        error: orgError?.message,
      });
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    if (!org.stripe_customer_id) {
      logger.warn("[SUBSCRIPTION SYNC] No Stripe customer ID", {
        organizationId,
        currentTier: org.subscription_tier,
      });
      return NextResponse.json({
        synced: false,
        message: "No Stripe customer - using default tier",
        tier: org.subscription_tier || "starter",
      });
    }

    // Fetch active subscriptions from Stripe
    const subscriptions = await stripe.subscriptions.list({
      customer: org.stripe_customer_id,
      status: "active",
      limit: 1,
    });

    logger.info("[SUBSCRIPTION SYNC] Stripe subscriptions fetched", {
      organizationId,
      stripeCustomerId: org.stripe_customer_id,
      activeSubscriptionCount: subscriptions.data.length,
    });

    if (subscriptions.data.length === 0) {
      logger.warn("[SUBSCRIPTION SYNC] No active Stripe subscription", {
        organizationId,
        stripeCustomerId: org.stripe_customer_id,
        currentTierInDB: org.subscription_tier,
      });
      return NextResponse.json({
        synced: false,
        message: "No active subscription in Stripe",
        tier: org.subscription_tier || "starter",
      });
    }

    const subscription = subscriptions.data[0];

    logger.info("[SUBSCRIPTION SYNC] Active subscription found", {
      organizationId,
      subscriptionId: subscription.id,
      status: subscription.status,
    });

    // Extract tier from Stripe using metadata or product name - NO env vars needed
    const tierFromStripe = await getTierFromStripeSubscription(subscription, stripe);

    logger.info("[SUBSCRIPTION SYNC] Tier extracted from Stripe", {
      organizationId,
      tierFromStripe,
      currentTierInDB: org.subscription_tier,
      needsUpdate: tierFromStripe !== org.subscription_tier,
    });

    // Update organization if tier changed
    if (tierFromStripe !== org.subscription_tier) {
      const { error: updateError } = await supabase
        .from("organizations")
        .update({
          subscription_tier: tierFromStripe,
          subscription_status: subscription.status,
        })
        .eq("id", organizationId);

      if (updateError) {
        logger.error("[SUBSCRIPTION SYNC] Failed to update tier", {
          organizationId,
          error: updateError.message,
        });
        return NextResponse.json({ error: "Failed to update tier" }, { status: 500 });
      }

      logger.info("[SUBSCRIPTION SYNC] ✅ Tier updated", {
        organizationId,
        oldTier: org.subscription_tier,
        newTier: tierFromStripe,
      });

      return NextResponse.json({
        synced: true,
        updated: true,
        oldTier: org.subscription_tier,
        newTier: tierFromStripe,
      });
    }

    logger.info("[SUBSCRIPTION SYNC] ✅ Tier already in sync", {
      organizationId,
      tier: tierFromStripe,
    });

    return NextResponse.json({
      synced: true,
      updated: false,
      tier: tierFromStripe,
    });
  } catch (error) {
    logger.error("[SUBSCRIPTION SYNC] Unexpected error", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
