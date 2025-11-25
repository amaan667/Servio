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
import { requireVenueAccessForAPI } from '@/lib/auth/api';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';

export async function POST(req: NextRequest) {
  try {

    // CRITICAL: Authentication check
    const { requireAuthForAPI } = await import('@/lib/auth/api');
    const authResult = await requireAuthForAPI();
    if (authResult.error || !authResult.user) {
      return NextResponse.json(
        { error: 'Unauthorized', message: authResult.error || 'Authentication required' },
        { status: 401 }
      );
    }

    // CRITICAL: Rate limiting
    const { rateLimit, RATE_LIMITS } = await import('@/lib/rate-limit');
    const rateLimitResult = await rateLimit(req as unknown as NextRequest, RATE_LIMITS.GENERAL);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        {
          error: 'Too many requests',
          message: `Rate limit exceeded. Try again in ${Math.ceil((rateLimitResult.reset - Date.now()) / 1000)} seconds.`,
        },
        { status: 429 }
      );
    }

    const { organizationId } = await req.json();

    if (!organizationId) {
      return NextResponse.json({ error: "organizationId required" }, { status: 400 });
    }

    const { createAdminClient } = await import("@/lib/supabase");
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
    let tierFromStripe: string;
    try {
      tierFromStripe = await getTierFromStripeSubscription(subscription, stripe);
    } catch (tierError) {
      logger.error("[SUBSCRIPTION SYNC] Failed to extract tier from Stripe", {
        organizationId,
        error: tierError instanceof Error ? tierError.message : String(tierError),
      });
      return NextResponse.json(
        { error: "Failed to extract tier from Stripe subscription" },
        { status: 500 }
      );
    }

    // Normalize tier from old names to new ones for backwards compatibility
    const normalizeTier = (tier: string): string => {
      const normalized = tier.toLowerCase().trim();
      if (normalized === "premium") return "enterprise";
      if (normalized === "standard" || normalized === "professional") return "pro";
      if (normalized === "basic") return "starter";
      return normalized;
    };

    const normalizedTierFromStripe = normalizeTier(tierFromStripe);
    const normalizedCurrentTier = org.subscription_tier
      ? normalizeTier(org.subscription_tier)
      : null;

    logger.info("[SUBSCRIPTION SYNC] Tier extracted from Stripe", {
      organizationId,
      tierFromStripe,
      normalizedTierFromStripe,
      currentTierInDB: org.subscription_tier,
      normalizedCurrentTier,
      needsUpdate: normalizedTierFromStripe !== normalizedCurrentTier,
    });

    // Update organization if tier changed (compare normalized values)
    if (normalizedTierFromStripe !== normalizedCurrentTier) {
      const { error: updateError } = await supabase
        .from("organizations")
        .update({
          subscription_tier: normalizedTierFromStripe,
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
        newTier: normalizedTierFromStripe,
      });

      return NextResponse.json({
        synced: true,
        updated: true,
        oldTier: org.subscription_tier,
        newTier: normalizedTierFromStripe,
      });
    }

    logger.info("[SUBSCRIPTION SYNC] ✅ Tier already in sync", {
      organizationId,
      tier: normalizedTierFromStripe,
    });

    return NextResponse.json({
      synced: true,
      updated: false,
      tier: normalizedTierFromStripe,
    });
  } catch (error) {
    logger.error("[SUBSCRIPTION SYNC] Unexpected error", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
