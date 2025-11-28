// API endpoint to manually refresh subscription status
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";
import { stripe } from "@/lib/stripe-client";
import { logger } from "@/lib/logger";
import { success, apiErrors, isZodError, handleZodError } from '@/lib/api/standard-response';

export async function POST(_request: NextRequest) {
  try {
    const supabase = await createClient();

    // Check auth - use getUser() for secure authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return apiErrors.unauthorized('Unauthorized');
    }

    const body = await _request.json();
    const { organizationId } = body;

    if (!organizationId) {
      return apiErrors.badRequest('Organization ID required');
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
      return apiErrors.notFound('Organization not found');
    }

    // If no Stripe subscription ID, return current status
    if (!org.stripe_subscription_id) {
      return NextResponse.json({
        success: true,
        subscription: {
          tier: org.subscription_tier || "starter",
          status: org.subscription_status || "starter",
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

      // Get tier from Stripe subscription (price/product metadata) - most reliable, no normalization
      const { getTierFromStripeSubscription } = await import("@/lib/stripe-tier-helper");
      const stripeClient = await import("@/lib/stripe-client").then((m) => m.stripe);
      
      // Get tier directly from Stripe - this is the source of truth
      let finalTier: string;
      try {
        finalTier = await getTierFromStripeSubscription(stripeSubscription, stripeClient);
      } catch (error) {
        logger.error("[SUBSCRIPTION REFRESH] Error getting tier from Stripe, using existing", {
          error: error instanceof Error ? error.message : String(error),
        });
        // Fallback to existing tier if Stripe fetch fails
        finalTier = org.subscription_tier || "starter";
      }

      logger.debug("[SUBSCRIPTION REFRESH] Tier from Stripe:", {
        finalTier,
        subscriptionId: stripeSubscription.id,
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

      // If subscription doesn't exist in Stripe, reset to starter
      const { error: resetError } = await supabase
        .from("organizations")
        .update({
          subscription_tier: "starter",
          subscription_status: "starter",
          stripe_subscription_id: null,
          trial_ends_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", organizationId);

      if (resetError) {
        logger.error("[SUBSCRIPTION REFRESH] Error resetting organization:", { value: resetError });
        return apiErrors.internal('Failed to reset subscription status');
      }

      return NextResponse.json({
        success: true,
        subscription: {
          tier: "starter",
          status: "starter",
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
