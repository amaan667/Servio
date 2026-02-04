/**
 * Stripe Service
 * Handles all Stripe-related business logic for subscriptions and payments
 */

import { BaseService } from "./BaseService";
import { stripe } from "@/lib/stripe-client";
import { env } from "@/lib/env";
import Stripe from "stripe";
import { trackPaymentError } from "@/lib/monitoring/error-tracking";
import { createClient } from "@/lib/supabase";

export class StripeService extends BaseService {
  /**
   * Get Stripe price IDs for tiers
   */
  async getTierPriceIds(): Promise<Record<string, string>> {
    const cacheKey = "stripe:tier_prices";

    return this.withCache(
      cacheKey,
      async () => {
        const priceIds: Record<string, string> = {
          starter: env("STRIPE_BASIC_PRICE_ID") || "",
          pro: env("STRIPE_STANDARD_PRICE_ID") || "",
          enterprise: env("STRIPE_PREMIUM_PRICE_ID") || "",
        };

        if (priceIds.starter && priceIds.pro && priceIds.enterprise) {
          return priceIds;
        }

        // Search Stripe if env vars missing
        const products = await stripe.products.list({ limit: 100, active: true });
        for (const product of products.data) {
          const tier = product.metadata?.tier;
          if (tier && ["starter", "pro", "enterprise"].includes(tier) && !priceIds[tier]) {
            const prices = await stripe.prices.list({ product: product.id, active: true });
            if (prices.data[0]) {
              priceIds[tier] = prices.data[0].id;
            }
          }
        }

        return priceIds;
      },
      3600
    ); // Cache for 1 hour
  }

  /**
   * Create or retrieve a Stripe customer for an organization
   */
  async getOrCreateCustomer(
    org: { id: string; stripe_customer_id?: string | null },
    user: { id: string; email: string }
  ): Promise<string> {
    if (org.stripe_customer_id) return org.stripe_customer_id;

    const customer = await stripe.customers.create({
      email: user.email,
      metadata: {
        organization_id: org.id,
        user_id: user.id,
      },
    });

    return customer.id;
  }

  /**
   * Create a checkout session for subscription
   */
  async createSubscriptionSession(params: {
    customerId?: string;
    customerEmail?: string;
    priceId: string;
    tier: string;
    orgId?: string;
    userId?: string;
    isSignup?: boolean;
    metadata?: Record<string, string>;
  }): Promise<Stripe.Checkout.Session> {
    const { isSignup, customerId, customerEmail, priceId, tier, orgId, userId, metadata } = params;

    const successUrl = isSignup
      ? `${env("NEXT_PUBLIC_APP_URL")}/auth/create-account?session_id={CHECKOUT_SESSION_ID}`
      : `${env("NEXT_PUBLIC_APP_URL")}/checkout/success?session_id={CHECKOUT_SESSION_ID}&tier=${tier}`;

    const cancelUrl = isSignup
      ? `${env("NEXT_PUBLIC_APP_URL")}/?cancelled=true`
      : `${env("NEXT_PUBLIC_APP_URL")}/?upgrade=cancelled`;

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      customer: customerId,
      customer_email: !customerId ? customerEmail : undefined,
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        ...metadata,
        tier,
        is_signup: isSignup ? "true" : "false",
        organization_id: orgId || "",
        user_id: userId || "",
      },
      subscription_data: {
        metadata: {
          tier,
          is_signup: isSignup ? "true" : "false",
          organization_id: orgId || "",
          user_id: userId || "",
        },
      },
    };

    return await stripe.checkout.sessions.create(sessionParams);
  }

  /**
   * Create a checkout session for a one-time order payment.
   * When orderId is omitted, order is created after payment via create-from-checkout-session.
   */
  async createOrderCheckoutSession(params: {
    amount: number;
    venueName: string;
    venueId: string;
    tableNumber: string;
    orderId?: string;
    customerName: string;
    customerPhone?: string;
    customerEmail?: string;
    items?: unknown[];
    source?: string;
    qrType?: string;
    successUrl: string;
    cancelUrl: string;
  }): Promise<Stripe.Checkout.Session> {
    const amountInPence = Math.round(params.amount * 100);

    const metadata: Record<string, string> = {
      venueId: params.venueId,
      tableNumber: params.tableNumber,
      customerName: params.customerName,
      source: params.source || "qr",
      qr_type: params.qrType || "TABLE_FULL_SERVICE",
      items: JSON.stringify(params.items || []).substring(0, 5000),
      amount: String(params.amount),
    };
    if (params.orderId) metadata.orderId = params.orderId;
    if (params.customerPhone) metadata.customerPhone = params.customerPhone;

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "gbp",
            product_data: {
              name: `Order at ${params.venueName || "Restaurant"}`,
              description: `Table: ${params.tableNumber || "N/A"}`,
            },
            unit_amount: amountInPence,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      customer_email: params.customerEmail,
      metadata,
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
    };

    return await stripe.checkout.sessions.create(sessionParams);
  }

  /**
   * Log and check if a Stripe webhook event has already been processed
   */
  async checkWebhookEvent(eventId: string): Promise<{ processed: boolean; status?: string }> {
    const supabase = await createClient();
    const { data } = await supabase
      .from("stripe_webhook_events")
      .select("status")
      .eq("event_id", eventId)
      .maybeSingle();

    return {
      processed: data?.status === "succeeded",
      status: data?.status,
    };
  }

  /**
   * Record a Stripe webhook event as processing
   */
  async recordWebhookProcessing(event: Stripe.Event): Promise<void> {
    const supabase = await createClient();
    await supabase.from("stripe_webhook_events").upsert(
      {
        event_id: event.id,
        type: event.type,
        status: "processing",
        payload: event as unknown as Record<string, unknown>,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "event_id" }
    );
  }

  /**
   * Finalize a Stripe webhook event status
   */
  async finalizeWebhookEvent(
    eventId: string,
    status: "succeeded" | "failed",
    error?: Error
  ): Promise<void> {
    const supabase = await createClient();
    await supabase
      .from("stripe_webhook_events")
      .update({
        status,
        processed_at: status === "succeeded" ? new Date().toISOString() : null,
        last_error: error ? { message: error.message, stack: error.stack } : null,
        updated_at: new Date().toISOString(),
      })
      .eq("event_id", eventId);
  }

  /**
   * Handle order payment success (QR orders)
   */
  async handleOrderPaymentSucceeded(session: Stripe.Checkout.Session): Promise<void> {
    const supabase = await createClient();
    const orderId = session.metadata?.orderId;
    const venueId = session.metadata?.venueId;

    if (!orderId || !venueId) return;

    try {
      // 1. Update order status
      const { data: updatedOrder, error } = await supabase
        .from("orders")
        .update({
          payment_status: "PAID",
          stripe_session_id: session.id,
          stripe_payment_intent_id: String(session.payment_intent || ""),
          updated_at: new Date().toISOString(),
        })
        .eq("id", orderId)
        .eq("venue_id", venueId)
        .select()
        .single();

      if (error) throw error;

      // 2. Create KDS Tickets if PAY_NOW
      if (updatedOrder.payment_method === "PAY_NOW") {
        const { kdsService } = await import("./KDSService");
        await kdsService.autoBackfill(venueId);
      }
    } catch (err) {
      trackPaymentError(err, { orderId, venueId, stripeSessionId: session.id });
      throw err;
    }
  }

  /**
   * Handle subscription changes (Organization level)
   */
  private async handleSubscriptionChange(subscription: Stripe.Subscription): Promise<void> {
    const supabase = await createClient();
    const orgId = subscription.metadata?.organization_id;
    if (!orgId) return;

    const { getTierFromStripeSubscription } = await import("@/lib/stripe-tier-helper");
    const tier = await getTierFromStripeSubscription(subscription, stripe);

    await supabase
      .from("organizations")
      .update({
        stripe_subscription_id: subscription.id,
        subscription_tier: tier,
        subscription_status: subscription.status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", orgId);
  }

  /**
   * Process a subscription event (from webhook or reconcile)
   */
  async processSubscriptionEvent(event: Stripe.Event): Promise<void> {
    switch (event.type) {
      case "checkout.session.completed":
        // Subscriptions webhook uses metadata to link org
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode === "subscription") {
          const orgId = session.metadata?.organization_id;
          const tier = session.metadata?.tier;
          if (orgId && tier) {
            const supabase = await createClient();
            await supabase
              .from("organizations")
              .update({
                stripe_subscription_id: session.subscription as string,
                subscription_tier: tier,
                subscription_status: "active",
                updated_at: new Date().toISOString(),
              })
              .eq("id", orgId);
          }
        }
        break;
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await this.handleSubscriptionChange(event.data.object as Stripe.Subscription);
        break;
    }
  }
}

export const stripeService = new StripeService();
