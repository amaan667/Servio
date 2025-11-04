/**
 * Sync Subscription Tier from Stripe
 * Ensures organization.subscription_tier matches Stripe subscription
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { stripe } from "@/lib/stripe-client";
import { logger } from "@/lib/logger";

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
        tier: org.subscription_tier || "basic",
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
        tier: org.subscription_tier || "basic",
      });
    }

    const subscription = subscriptions.data[0];
    const priceId = subscription.items.data[0]?.price.id;

    logger.info("[SUBSCRIPTION SYNC] Active subscription found", {
      organizationId,
      subscriptionId: subscription.id,
      priceId,
      status: subscription.status,
    });

    // Map Stripe price ID to tier
    const PRICE_TO_TIER: Record<string, string> = {
      [process.env.STRIPE_BASIC_PRICE_ID || ""]: "basic",
      [process.env.STRIPE_STANDARD_PRICE_ID || ""]: "standard",
      [process.env.STRIPE_PREMIUM_PRICE_ID || ""]: "premium",
    };

    const tierFromStripe = PRICE_TO_TIER[priceId] || "basic";

    logger.info("[SUBSCRIPTION SYNC] Price ID mapping", {
      organizationId,
      priceId,
      tierFromStripe,
      currentTierInDB: org.subscription_tier,
      priceIdMatches: {
        isBasic: priceId === process.env.STRIPE_BASIC_PRICE_ID,
        isStandard: priceId === process.env.STRIPE_STANDARD_PRICE_ID,
        isPremium: priceId === process.env.STRIPE_PREMIUM_PRICE_ID,
      },
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
        stripePriceId: priceId,
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
