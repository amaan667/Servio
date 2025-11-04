/**
 * Force Sync Subscription from Stripe
 * Call this endpoint to manually sync when database and Stripe are out of sync
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { stripe } from "@/lib/stripe-client";
import { apiLogger as logger } from "@/lib/logger";

export async function POST(req: NextRequest) {
  try {
    const { organizationId } = await req.json();

    if (!organizationId) {
      return NextResponse.json({ error: "organizationId required" }, { status: 400 });
    }

    logger.info("[FORCE SYNC] Starting sync", { organizationId });

    const supabase = createAdminClient();

    // Get organization
    const { data: org, error: orgError } = await supabase
      .from("organizations")
      .select("id, stripe_customer_id, subscription_tier, subscription_status")
      .eq("id", organizationId)
      .single();

    if (orgError || !org) {
      logger.error("[FORCE SYNC] Organization not found", { organizationId, error: orgError });
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    logger.info("[FORCE SYNC] Current database state", {
      organizationId: org.id,
      currentTier: org.subscription_tier,
      currentStatus: org.subscription_status,
      stripeCustomerId: org.stripe_customer_id,
    });

    if (!org.stripe_customer_id) {
      return NextResponse.json({ error: "No Stripe customer ID" }, { status: 400 });
    }

    // Fetch from Stripe
    logger.info("[FORCE SYNC] Fetching subscriptions from Stripe", {
      stripeCustomerId: org.stripe_customer_id,
    });

    let subscriptions = await stripe.subscriptions.list({
      customer: org.stripe_customer_id,
      status: "active",
      limit: 10,
    });

    logger.info("[FORCE SYNC] Active subscriptions found", {
      count: subscriptions.data.length,
    });

    // If no active, check trialing
    if (subscriptions.data.length === 0) {
      subscriptions = await stripe.subscriptions.list({
        customer: org.stripe_customer_id,
        status: "trialing",
        limit: 10,
      });

      logger.info("[FORCE SYNC] Trialing subscriptions found", {
        count: subscriptions.data.length,
      });
    }

    if (subscriptions.data.length === 0) {
      return NextResponse.json(
        {
          error: "No active or trialing subscriptions in Stripe",
          currentTierInDB: org.subscription_tier,
        },
        { status: 404 }
      );
    }

    const subscription = subscriptions.data[0];
    const priceId = subscription.items.data[0]?.price.id;

    logger.info("[FORCE SYNC] Stripe subscription details", {
      subscriptionId: subscription.id,
      status: subscription.status,
      priceId: priceId,
    });

    // Map price ID to tier
    const PRICE_TO_TIER: Record<string, string> = {
      [process.env.STRIPE_BASIC_PRICE_ID || ""]: "basic",
      [process.env.STRIPE_STANDARD_PRICE_ID || ""]: "standard",
      [process.env.STRIPE_PREMIUM_PRICE_ID || ""]: "premium",
    };

    logger.info("[FORCE SYNC] Price ID matching", {
      priceId,
      matchesBasic: priceId === process.env.STRIPE_BASIC_PRICE_ID,
      matchesStandard: priceId === process.env.STRIPE_STANDARD_PRICE_ID,
      matchesPremium: priceId === process.env.STRIPE_PREMIUM_PRICE_ID,
      basicPriceId: process.env.STRIPE_BASIC_PRICE_ID,
      standardPriceId: process.env.STRIPE_STANDARD_PRICE_ID,
      premiumPriceId: process.env.STRIPE_PREMIUM_PRICE_ID,
    });

    const tierFromStripe = PRICE_TO_TIER[priceId] || "basic";

    logger.info("[FORCE SYNC] Tier mapping", {
      tierFromStripe,
      currentTierInDB: org.subscription_tier,
      needsUpdate: tierFromStripe !== org.subscription_tier,
    });

    // Update database
    if (tierFromStripe !== org.subscription_tier) {
      const { error: updateError } = await supabase
        .from("organizations")
        .update({
          subscription_tier: tierFromStripe,
          subscription_status: subscription.status,
          updated_at: new Date().toISOString(),
        })
        .eq("id", organizationId);

      if (updateError) {
        logger.error("[FORCE SYNC] Update failed", { error: updateError });
        return NextResponse.json({ error: "Failed to update database" }, { status: 500 });
      }

      logger.info("[FORCE SYNC] ✅ Database updated", {
        oldTier: org.subscription_tier,
        newTier: tierFromStripe,
      });

      return NextResponse.json({
        success: true,
        updated: true,
        oldTier: org.subscription_tier,
        newTier: tierFromStripe,
        stripeStatus: subscription.status,
        message: `Successfully updated from ${org.subscription_tier} to ${tierFromStripe}`,
      });
    }

    logger.info("[FORCE SYNC] Already in sync");

    return NextResponse.json({
      success: true,
      updated: false,
      tier: tierFromStripe,
      message: "Database already in sync with Stripe",
    });
  } catch (error) {
    logger.error("[FORCE SYNC] Error", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
