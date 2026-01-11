// Stripe Plan Downgrade - Handle immediate downgrades
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";
import { stripe } from "@/lib/stripe-client";

import { env } from "@/lib/env";
import { apiErrors } from "@/lib/api/standard-response";

export async function POST(_request: NextRequest) {
  try {
    const supabase = await createClient();

    // Check auth - use getUser() for secure authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return apiErrors.unauthorized("Unauthorized");
    }

    const body = await _request.json();
    const { organizationId, newTier } = body;

    if (!organizationId || !newTier) {
      return NextResponse.json(
        { error: "Organization ID and new tier are required" },
        { status: 400 }
      );
    }

    if (!["starter", "pro", "enterprise"].includes(newTier)) {
      return apiErrors.badRequest("Invalid tier");
    }

    // Get organization
    const { data: org } = await supabase
      .from("organizations")
      .select("*")
      .eq("id", organizationId)
      .eq("owner_user_id", user.id)
      .single();

    if (!org) {
      return apiErrors.notFound("Organization not found");
    }

    // If already on the requested tier, no action needed
    if (org.subscription_tier === newTier) {
      return NextResponse.json({
        success: true,
        message: `Already on ${newTier} plan`,
      });
    }

    // For downgrades, we'll update the organization immediately
    // and let Stripe handle the billing changes through their system
    const { error: updateError } = await supabase
      .from("organizations")
      .update({
        subscription_tier: newTier,
        updated_at: new Date().toISOString(),
      })
      .eq("id", org.id);

    if (updateError) {

      return apiErrors.internal("Failed to update subscription tier");
    }

    // If the organization has an active Stripe subscription,
    // we should update it in Stripe as well
    if (org.stripe_customer_id) {
      try {
        // Get the customer's subscriptions
        const subscriptions = await stripe.subscriptions.list({
          customer: org.stripe_customer_id,
          status: "active",
          limit: 1,
        });

        if (subscriptions.data.length > 0) {
          const subscription = subscriptions.data[0];

          // Get the price ID for the new tier
          const priceIds = {
            starter: env("STRIPE_BASIC_PRICE_ID"),
            pro: env("STRIPE_STANDARD_PRICE_ID"),
            enterprise: env("STRIPE_PREMIUM_PRICE_ID"),
          };

          const newPriceId = priceIds[newTier as keyof typeof priceIds];

          if (newPriceId && subscription.items.data[0]) {
            // Update the subscription to the new price immediately
            // Use 'always_invoice' to immediately apply the change
            await stripe.subscriptions.update(subscription.id, {
              items: [
                {
                  id: subscription.items.data[0].id,
                  price: newPriceId,
                },
              ],
              proration_behavior: "always_invoice", // Invoice immediately for the change
              metadata: {
                organization_id: org.id,
                tier: newTier,
                changed_at: new Date().toISOString(),
              },
            });

          }
        }
      } catch (stripeError: unknown) {
        const errorMessage = stripeError instanceof Error ? stripeError.message : "Unknown error";

        // Don't fail the entire operation if Stripe update fails
        // The database update already succeeded
      }
    }

    return NextResponse.json({
      success: true,
      message: `Successfully downgraded to ${newTier} plan`,
      newTier,
    });
  } catch (_error) {
    const errorMessage = _error instanceof Error ? _error.message : "Unknown _error";

    return NextResponse.json(
      { error: errorMessage || "Failed to downgrade plan" },
      { status: 500 }
    );
  }
}
