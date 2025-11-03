// API endpoint to manually refresh subscription status
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";
import { stripe } from "@/lib/stripe-client";
import { logger } from "@/lib/logger";

export async function POST(_request: NextRequest) {
  try {
    const supabase = await createClient();

    // Check auth
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const user = session?.user;

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await _request.json();
    const { organizationId } = body;

    if (!organizationId) {
      return NextResponse.json({ error: "Organization ID required" }, { status: 400 });
    }

    logger.debug("[SUBSCRIPTION REFRESH] Refreshing subscription status for org:", {
      value: organizationId,
    });

    // Get organization details
    const { data: org, error: orgError } = await supabase
      .from("organizations")
      .select("*")
      .eq("id", organizationId)
      .single();

    if (orgError || !org) {
      logger.error("[SUBSCRIPTION REFRESH] Organization not found:", { value: orgError });
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    // If no Stripe subscription ID, return current status
    if (!org.stripe_subscription_id) {
      return NextResponse.json({
        success: true,
        subscription: {
          tier: org.subscription_tier || "basic",
          status: org.subscription_status || "basic",
        },
      });
    }

    // Fetch latest subscription status from Stripe
    try {
      const stripeSubscription = await stripe.subscriptions.retrieve(org.stripe_subscription_id);

      logger.debug("[SUBSCRIPTION REFRESH] Stripe subscription status:", {
        id: stripeSubscription.id,
        status: stripeSubscription.status,
        metadata: stripeSubscription.metadata,
      });

      // Calculate trial end date
      let trialEndsAt = null;
      if (stripeSubscription.trial_end) {
        trialEndsAt = new Date(stripeSubscription.trial_end * 1000).toISOString();
      }

      // Get tier from Stripe metadata or fallback to existing
      const stripeTier = stripeSubscription.metadata?.tier;
      const currentTier = org.subscription_tier;

      // Use Stripe tier if available, otherwise keep current tier
      const finalTier = stripeTier || currentTier || "basic";

      logger.debug("[SUBSCRIPTION REFRESH] Tier detection:", {
        stripeTier,
        currentTier,
        finalTier,
      });

      // Update organization with latest Stripe data
      const updateData = {
        subscription_status: stripeSubscription.status,
        subscription_tier: finalTier,
        trial_ends_at: trialEndsAt,
        updated_at: new Date().toISOString(),
      };

      const { error: updateError } = await supabase
        .from("organizations")
        .update(updateData)
        .eq("id", organizationId);

      if (updateError) {
        logger.error("[SUBSCRIPTION REFRESH] Error updating organization:", { value: updateError });
        return NextResponse.json(
          { error: "Failed to update subscription status" },
          { status: 500 }
        );
      }


      return NextResponse.json({
        success: true,
        subscription: {
          tier: updateData.subscription_tier,
          status: updateData.subscription_status,
        },
      });
    } catch (stripeError: unknown) {
      logger.error("[SUBSCRIPTION REFRESH] Stripe error:", { value: stripeError });

      // If subscription doesn't exist in Stripe, reset to basic
      const { error: resetError } = await supabase
        .from("organizations")
        .update({
          subscription_tier: "basic",
          subscription_status: "basic",
          stripe_subscription_id: null,
          trial_ends_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", organizationId);

      if (resetError) {
        logger.error("[SUBSCRIPTION REFRESH] Error resetting organization:", { value: resetError });
        return NextResponse.json({ error: "Failed to reset subscription status" }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        subscription: {
          tier: "basic",
          status: "basic",
        },
        reset: true,
      });
    }
  } catch (_error) {
    logger.error("[SUBSCRIPTION REFRESH] Error:", {
      error: _error instanceof Error ? _error.message : "Unknown _error",
    });
    return NextResponse.json(
      { error: _error instanceof Error ? _error.message : "Failed to refresh subscription status" },
      { status: 500 }
    );
  }
}
