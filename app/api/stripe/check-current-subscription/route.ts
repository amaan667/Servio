import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@/lib/supabase";
import { stripe } from "@/lib/stripe-client";
import { getTierFromStripeSubscription } from "@/lib/stripe-tier-helper";
import { apiLogger as logger } from "@/lib/logger";

/**
 * Check current subscription status and tier detection
 * Helps verify what Stripe has vs what the platform is reading
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user's organization
    const { data: org, error: orgError } = await supabase
      .from("organizations")
      .select(
        "id, subscription_tier, subscription_status, stripe_customer_id, stripe_subscription_id, trial_ends_at"
      )
      .eq("owner_user_id", session.user.id)
      .maybeSingle();

    if (orgError || !org) {
      return NextResponse.json(
        { error: "Organization not found", details: orgError?.message },
        { status: 404 }
      );
    }

    const result: {
      organization: {
        id: string;
        subscription_tier: string | null;
        subscription_status: string | null;
        stripe_customer_id: string | null;
        stripe_subscription_id: string | null;
        trial_ends_at: string | null;
      };
      stripe?: {
        customer?: {
          id: string;
          email: string | null;
        };
        subscription?: {
          id: string;
          status: string;
          metadata: Record<string, string>;
          items: Array<{
            priceId: string;
            productId: string;
            productName: string | null;
            productMetadata: Record<string, string>;
            priceMetadata: Record<string, string>;
          }>;
        };
        subscriptionsFound?: Array<{
          id: string;
          status: string;
          metadata: Record<string, string>;
        }>;
        subscriptionError?: string;
        customerError?: string;
        tierFromStripe?: string;
        tierFromMetadata?: string | null;
        tierFromProductName?: string | null;
      };
      match: {
        tierMatches: boolean;
        statusMatches: boolean;
      };
    } = {
      organization: {
        id: org.id,
        subscription_tier: org.subscription_tier,
        subscription_status: org.subscription_status,
        stripe_customer_id: org.stripe_customer_id,
        stripe_subscription_id: org.stripe_subscription_id,
        trial_ends_at: org.trial_ends_at,
      },
      match: {
        tierMatches: false,
        statusMatches: false,
      },
    };

    // If we have a Stripe customer ID, fetch details
    if (org.stripe_customer_id) {
      try {
        const customer = await stripe.customers.retrieve(org.stripe_customer_id);
        if (customer && !customer.deleted) {
          result.stripe = {
            customer: {
              id: customer.id,
              email: customer.email,
            },
            tierFromStripe: "",
            tierFromMetadata: null,
            tierFromProductName: null,
          };

          // If we have a subscription ID, fetch it
          if (org.stripe_subscription_id) {
            try {
              const subscription = await stripe.subscriptions.retrieve(org.stripe_subscription_id, {
                expand: ["data.items.data.price.product"],
              });

              const items = subscription.items.data.map((item) => {
                const price = item.price;
                const product =
                  typeof price.product === "string" ? null : (price.product as Stripe.Product | null);

                return {
                  priceId: price.id,
                  productId: product?.id || "unknown",
                  productName: product?.name || null,
                  productMetadata: product?.metadata || {},
                  priceMetadata: price.metadata || {},
                };
              });

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
                  : items[0].productName.toLowerCase().includes("pro")
                    ? "pro"
                    : items[0].productName.toLowerCase().includes("starter") ||
                        items[0].productName.toLowerCase().includes("basic")
                      ? "starter"
                      : null
                : null;

              result.stripe.subscription = {
                id: subscription.id,
                status: subscription.status,
                metadata: subscription.metadata || {},
                items,
              };

              result.stripe.tierFromStripe = tierFromStripe;
              result.stripe.tierFromMetadata = tierFromMetadata;
              result.stripe.tierFromProductName = tierFromProductName;

              // Check if tier matches (normalize "standard" to "pro" for comparison)
              const normalizedDbTier = org.subscription_tier === "standard" ? "pro" : org.subscription_tier;
              result.match.tierMatches = normalizedDbTier === tierFromStripe;
              result.match.statusMatches = org.subscription_status === subscription.status;
            } catch (subError) {
              logger.error("[STRIPE CHECK] Error fetching subscription:", {
                error: subError instanceof Error ? subError.message : String(subError),
              });
              if (result.stripe) {
                result.stripe.subscriptionError = subError instanceof Error ? subError.message : String(subError);
              }
            }
          } else {
            // No subscription ID, check for any active subscriptions
            const subscriptions = await stripe.subscriptions.list({
              customer: org.stripe_customer_id,
              status: "all",
              limit: 10,
            });

            if (subscriptions.data.length > 0 && result.stripe) {
              // Get the most recent active subscription
              const activeSubscription = subscriptions.data.find((s) => s.status === "active") || subscriptions.data[0];

              if (activeSubscription) {
                try {
                  // Fetch full subscription details with expanded product info
                  const subscription = await stripe.subscriptions.retrieve(activeSubscription.id, {
                    expand: ["data.items.data.price.product"],
                  });

                  const items = subscription.items.data.map((item) => {
                    const price = item.price;
                    const product =
                      typeof price.product === "string" ? null : (price.product as Stripe.Product | null);

                    return {
                      priceId: price.id,
                      productId: product?.id || "unknown",
                      productName: product?.name || null,
                      productMetadata: product?.metadata || {},
                      priceMetadata: price.metadata || {},
                    };
                  });

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
                      : items[0].productName.toLowerCase().includes("pro")
                        ? "pro"
                        : items[0].productName.toLowerCase().includes("starter") ||
                            items[0].productName.toLowerCase().includes("basic")
                          ? "starter"
                          : null
                    : null;

                  result.stripe.subscription = {
                    id: subscription.id,
                    status: subscription.status,
                    metadata: subscription.metadata || {},
                    items,
                  };

                  result.stripe.tierFromStripe = tierFromStripe;
                  result.stripe.tierFromMetadata = tierFromMetadata;
                  result.stripe.tierFromProductName = tierFromProductName;

                  // Check if tier matches (normalize "standard" to "pro")
                  const normalizedDbTier = org.subscription_tier === "standard" ? "pro" : org.subscription_tier;
                  result.match.tierMatches = normalizedDbTier === tierFromStripe;
                  result.match.statusMatches = org.subscription_status === subscription.status;

                  // Also list all subscriptions found
                  result.stripe.subscriptionsFound = subscriptions.data.map((sub) => ({
                    id: sub.id,
                    status: sub.status,
                    metadata: sub.metadata || {},
                  }));
                } catch (subError) {
                  logger.error("[STRIPE CHECK] Error fetching subscription from list:", {
                    error: subError instanceof Error ? subError.message : String(subError),
                  });
                  if (result.stripe) {
                    result.stripe.subscriptionError = subError instanceof Error ? subError.message : String(subError);
                  }
                  result.stripe.subscriptionsFound = subscriptions.data.map((sub) => ({
                    id: sub.id,
                    status: sub.status,
                    metadata: sub.metadata || {},
                  }));
                }
              }
            }
          }
        }
      } catch (customerError) {
        logger.error("[STRIPE CHECK] Error fetching customer:", {
          error: customerError instanceof Error ? customerError.message : String(customerError),
        });
        result.stripe = {
          customerError: customerError instanceof Error ? customerError.message : String(customerError),
          tierFromStripe: "",
          tierFromMetadata: null,
          tierFromProductName: null,
        };
      }
    }

    return NextResponse.json({
      success: true,
      ...result,
      instructions: {
        howToCheckInStripe:
          "1. Go to Stripe Dashboard → Customers → Find your customer → View Subscriptions\n2. Click on the subscription → Check 'Metadata' tab\n3. Check the Product → View metadata (should have tier: starter/pro/enterprise)\n4. Check the Price → View metadata (can also have tier)",
        whatToVerify:
          "Verify that the tier in Stripe (product/price metadata) matches what's shown in 'tierFromStripe' above",
      },
    });
  } catch (error) {
    logger.error("[STRIPE CHECK] Error:", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

