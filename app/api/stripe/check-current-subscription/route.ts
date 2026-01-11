import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@/lib/supabase";
import { stripe } from "@/lib/stripe-client";
import { getTierFromStripeSubscription } from "@/lib/stripe-tier-helper";
import { apiErrors } from "@/lib/api/standard-response";

/**
 * Check current subscription status and tier detection
 * Helps verify what Stripe has vs what the platform is reading
 */
export async function GET() {
  try {
    const supabase = await createClient();
    // Use getUser() for secure authentication
    const {
      data: { user },

    } = await supabase.auth.getUser();

    if (authError || !user) {
      return apiErrors.unauthorized("Unauthorized");
    }

    // Get user's organization
    const { data: org, error: orgError } = await supabase
      .from("organizations")
      .select(
        "id, subscription_tier, subscription_status, stripe_customer_id, stripe_subscription_id, trial_ends_at"
      )
      .eq("owner_user_id", user.id)
      .maybeSingle();

    if (orgError || !org) {
      return NextResponse.json(
        { error: "Organization not found", details: orgError?.message },
        { status: 404 }
      );
    }

    const result: {

      };
      stripe?: {
        customer?: {

        };
        subscription?: {

          metadata: Record<string, string>;

            productMetadata: Record<string, string>;
            priceMetadata: Record<string, string>;
          }>;
        };
        subscriptionsFound?: Array<{

          metadata: Record<string, string>;
        }>;
        subscriptionError?: string;
        customerError?: string;
        tierFromStripe?: string;
        tierFromMetadata?: string | null;
        tierFromProductName?: string | null;
      };

      };
    } = {

      },

      },
    };

    // If we have a Stripe customer ID, fetch details
    if (org.stripe_customer_id) {
      try {
        const customer = await stripe.customers.retrieve(org.stripe_customer_id);
        if (customer && !customer.deleted) {
          result.stripe = {

            },

          };

          // If we have a subscription ID, fetch it
          if (org.stripe_subscription_id) {
            try {
              const subscription = await stripe.subscriptions.retrieve(org.stripe_subscription_id, {

              const items = subscription.items.data.map((item) => {
                const price = item.price;
                const product =
                  typeof price.product === "string"
                    ? null

                  productMetadata: product?.metadata || {},
                  priceMetadata: price.metadata || {},
                };

              // Get tier using the helper function
              const tierFromStripe = await getTierFromStripeSubscription(subscription, stripe);

              // Also check metadata directly
              const tierFromMetadata =
                subscription.metadata?.tier ||
                items[0]?.priceMetadata?.tier ||
                items[0]?.productMetadata?.tier ||
                null;

              // Parse from product name
              const tierFromProductName = items[0]?.productName
                ? items[0].productName.toLowerCase().includes("enterprise")
                  ? "enterprise"

                metadata: subscription.metadata || {},
                items,
              };

              result.stripe.tierFromStripe = tierFromStripe;
              result.stripe.tierFromMetadata = tierFromMetadata;
              result.stripe.tierFromProductName = tierFromProductName;

              // Check if tier matches (normalize "standard" to "pro" for comparison)
              const normalizedDbTier =
                org.subscription_tier === "standard" ? "pro" : org.subscription_tier;
              result.match.tierMatches = normalizedDbTier === tierFromStripe;
              result.match.statusMatches = org.subscription_status === subscription.status;
            } catch (subError) {

              if (result.stripe) {
                result.stripe.subscriptionError =
                  subError instanceof Error ? subError.message : String(subError);
              }
            }
          } else {
            // No subscription ID, check for any active subscriptions
            const subscriptions = await stripe.subscriptions.list({

            if (subscriptions.data.length > 0 && result.stripe) {
              // Get the most recent active subscription
              const activeSubscription =
                subscriptions.data.find((s) => s.status === "active") || subscriptions.data[0];

              if (activeSubscription) {
                try {
                  // Fetch full subscription details with expanded product info
                  const subscription = await stripe.subscriptions.retrieve(activeSubscription.id, {

                  const items = subscription.items.data.map((item) => {
                    const price = item.price;
                    const product =
                      typeof price.product === "string"
                        ? null

                      productMetadata: product?.metadata || {},
                      priceMetadata: price.metadata || {},
                    };

                  // Get tier using the helper function
                  const tierFromStripe = await getTierFromStripeSubscription(subscription, stripe);

                  // Also check metadata directly
                  const tierFromMetadata =
                    subscription.metadata?.tier ||
                    items[0]?.priceMetadata?.tier ||
                    items[0]?.productMetadata?.tier ||
                    null;

                  // Parse from product name
                  const tierFromProductName = items[0]?.productName
                    ? items[0].productName.toLowerCase().includes("enterprise")
                      ? "enterprise"

                    metadata: subscription.metadata || {},
                    items,
                  };

                  result.stripe.tierFromStripe = tierFromStripe;
                  result.stripe.tierFromMetadata = tierFromMetadata;
                  result.stripe.tierFromProductName = tierFromProductName;

                  // Check if tier matches (normalize "standard" to "pro")
                  const normalizedDbTier =
                    org.subscription_tier === "standard" ? "pro" : org.subscription_tier;
                  result.match.tierMatches = normalizedDbTier === tierFromStripe;
                  result.match.statusMatches = org.subscription_status === subscription.status;

                  // Also list all subscriptions found
                  result.stripe.subscriptionsFound = subscriptions.data.map((sub) => ({

                    metadata: sub.metadata || {},
                  }));
                } catch (subError) {

                  if (result.stripe) {
                    result.stripe.subscriptionError =
                      subError instanceof Error ? subError.message : String(subError);
                  }
                  result.stripe.subscriptionsFound = subscriptions.data.map((sub) => ({

                    metadata: sub.metadata || {},
                  }));
                }
              }
            }
          }
        }
      } catch (customerError) {

        result.stripe = {

        };
      }
    }

    return NextResponse.json({

      ...result,

      },

  } catch (error) {

    return NextResponse.json(
      {

      },
      { status: 500 }
    );
  }
}
