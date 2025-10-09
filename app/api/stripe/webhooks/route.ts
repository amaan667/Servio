// Stripe Webhooks - Handle subscription events
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@/lib/supabase/server";

// Extend Invoice type to include subscription property
interface InvoiceWithSubscription extends Stripe.Invoice {
  subscription?: string | Stripe.Subscription | null;
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-08-27.basil",
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get("stripe-signature");

    if (!signature) {
      return NextResponse.json(
        { error: "No signature" },
        { status: 400 }
      );
    }

    // Verify webhook signature
    const event = stripe.webhooks.constructEvent(
      body,
      signature,
      webhookSecret
    );

    console.log("[STRIPE WEBHOOK] Event:", event.type);

    // Handle the event
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;

      case "customer.subscription.created":
        await handleSubscriptionCreated(event.data.object as Stripe.Subscription);
        break;

      case "customer.subscription.updated":
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;

      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      case "invoice.payment_succeeded":
        await handlePaymentSucceeded(event.data.object as Stripe.Invoice);
        break;

      case "invoice.payment_failed":
        await handlePaymentFailed(event.data.object as Stripe.Invoice);
        break;

      default:
        console.log(`[STRIPE WEBHOOK] Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error("[STRIPE WEBHOOK] Error:", error);
    return NextResponse.json(
      { error: error.message },
      { status: 400 }
    );
  }
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const supabase = await createClient();

  const organizationId = session.metadata?.organization_id;
  const tier = session.metadata?.tier;

  if (!organizationId) {
    console.error("[STRIPE] No organization_id in checkout session");
    return;
  }

  // Update organization with subscription details
  const { error } = await supabase
    .from("organizations")
    .update({
      stripe_subscription_id: session.subscription as string,
      subscription_tier: tier || "basic",
      subscription_status: "trialing",
      trial_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", organizationId);

  if (error) {
    console.error("[STRIPE] Error updating organization:", error);
    return;
  }

  // Log subscription history
  await supabase.from("subscription_history").insert({
    organization_id: organizationId,
    event_type: "checkout_completed",
    new_tier: tier,
    stripe_event_id: session.id,
    metadata: { session_id: session.id },
  });

  console.log(`[STRIPE] Checkout completed for org: ${organizationId}`);
}

async function handleSubscriptionCreated(subscription: Stripe.Subscription) {
  const supabase = await createClient();

  const organizationId = subscription.metadata?.organization_id;
  const tier = subscription.metadata?.tier;

  if (!organizationId) {
    console.error("[STRIPE] No organization_id in subscription");
    return;
  }

  await supabase
    .from("organizations")
    .update({
      stripe_subscription_id: subscription.id,
      subscription_tier: tier || "basic",
      subscription_status: subscription.status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", organizationId);

  await supabase.from("subscription_history").insert({
    organization_id: organizationId,
    event_type: "subscription_created",
    new_tier: tier,
    stripe_event_id: subscription.id,
    metadata: { subscription_id: subscription.id },
  });

  console.log(`[STRIPE] Subscription created for org: ${organizationId}`);
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const supabase = await createClient();

  const organizationId = subscription.metadata?.organization_id;
  const tier = subscription.metadata?.tier;

  if (!organizationId) {
    console.error("[STRIPE] No organization_id in subscription");
    return;
  }

  // Get current tier to log change
  const { data: org } = await supabase
    .from("organizations")
    .select("subscription_tier")
    .eq("id", organizationId)
    .single();

  await supabase
    .from("organizations")
    .update({
      subscription_tier: tier || org?.subscription_tier || "basic",
      subscription_status: subscription.status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", organizationId);

  await supabase.from("subscription_history").insert({
    organization_id: organizationId,
    event_type: "subscription_updated",
    old_tier: org?.subscription_tier,
    new_tier: tier,
    stripe_event_id: subscription.id,
    metadata: { subscription_id: subscription.id, status: subscription.status },
  });

  console.log(`[STRIPE] Subscription updated for org: ${organizationId}`);
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const supabase = await createClient();

  const organizationId = subscription.metadata?.organization_id;

  if (!organizationId) {
    console.error("[STRIPE] No organization_id in subscription");
    return;
  }

  const { data: org } = await supabase
    .from("organizations")
    .select("subscription_tier")
    .eq("id", organizationId)
    .single();

  // Downgrade to basic (free tier)
  await supabase
    .from("organizations")
    .update({
      subscription_tier: "basic",
      subscription_status: "canceled",
      stripe_subscription_id: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", organizationId);

  await supabase.from("subscription_history").insert({
    organization_id: organizationId,
    event_type: "subscription_canceled",
    old_tier: org?.subscription_tier,
    new_tier: "basic",
    stripe_event_id: subscription.id,
    metadata: { subscription_id: subscription.id },
  });

  console.log(`[STRIPE] Subscription deleted for org: ${organizationId}`);
}

async function handlePaymentSucceeded(invoice: Stripe.Invoice) {
  const supabase = await createClient();

  // Access subscription - can be string (ID) or expanded Subscription object
  const invoiceWithSub = invoice as InvoiceWithSubscription;
  const subscriptionId = typeof invoiceWithSub.subscription === 'string' 
    ? invoiceWithSub.subscription 
    : invoiceWithSub.subscription?.id;

  if (!subscriptionId) {
    return;
  }

  // Get subscription details
  const stripeSubscription = await stripe.subscriptions.retrieve(subscriptionId);
  const organizationId = stripeSubscription.metadata?.organization_id;

  if (!organizationId) {
    return;
  }

  await supabase
    .from("organizations")
    .update({
      subscription_status: "active",
      updated_at: new Date().toISOString(),
    })
    .eq("id", organizationId);

  console.log(`[STRIPE] Payment succeeded for org: ${organizationId}`);
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  const supabase = await createClient();

  // Access subscription - can be string (ID) or expanded Subscription object
  const invoiceWithSub = invoice as InvoiceWithSubscription;
  const subscriptionId = typeof invoiceWithSub.subscription === 'string' 
    ? invoiceWithSub.subscription 
    : invoiceWithSub.subscription?.id;

  if (!subscriptionId) {
    return;
  }

  // Get subscription details
  const stripeSubscription = await stripe.subscriptions.retrieve(subscriptionId);
  const organizationId = stripeSubscription.metadata?.organization_id;

  if (!organizationId) {
    return;
  }

  await supabase
    .from("organizations")
    .update({
      subscription_status: "past_due",
      updated_at: new Date().toISOString(),
    })
    .eq("id", organizationId);

  console.log(`[STRIPE] Payment failed for org: ${organizationId}`);
}

