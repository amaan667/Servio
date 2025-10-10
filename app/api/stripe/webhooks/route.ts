// Stripe Webhooks - Handle subscription events
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe-client";

// Extend Invoice type to include subscription property
interface InvoiceWithSubscription extends Stripe.Invoice {
  subscription?: string | Stripe.Subscription | null;
}

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

    console.log("[STRIPE WEBHOOK] Event:", event.type, "ID:", event.id);

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
  console.log("[STRIPE WEBHOOK] ===== CHECKOUT COMPLETED =====");
  console.log("[STRIPE WEBHOOK] handleCheckoutCompleted called with session:", {
    id: session.id,
    customer: session.customer,
    subscription: session.subscription,
    metadata: session.metadata,
    mode: session.mode
  });

  const supabase = await createClient();

  const organizationId = session.metadata?.organization_id;
  const tier = session.metadata?.tier;
  const userId = session.metadata?.user_id;

  console.log("[STRIPE WEBHOOK] Extracted data:", { organizationId, tier, userId });

  if (!organizationId || !tier) {
    console.error("[STRIPE WEBHOOK] ❌ Missing required metadata in checkout session:", session.metadata);
    return;
  }

  // Verify the organization exists
  const { data: existingOrg, error: orgCheckError } = await supabase
    .from("organizations")
    .select("id, subscription_tier, subscription_status, owner_id")
    .eq("id", organizationId)
    .maybeSingle();

  if (orgCheckError) {
    console.error("[STRIPE WEBHOOK] ❌ Error checking organization:", orgCheckError);
    // If we have a user_id, try to find org by owner_id as fallback
    if (userId) {
      console.log("[STRIPE WEBHOOK] 🔄 Attempting fallback lookup by user_id:", userId);
      const { data: orgByOwner, error: ownerError } = await supabase
        .from("organizations")
        .select("id, subscription_tier, subscription_status, owner_id")
        .eq("owner_id", userId)
        .maybeSingle();
      
      if (ownerError || !orgByOwner) {
        console.error("[STRIPE WEBHOOK] ❌ Fallback lookup also failed:", ownerError);
        return;
      }
      
      console.log("[STRIPE WEBHOOK] ✅ Found organization via fallback:", orgByOwner.id);
      // Update the organizationId to use the correct one
      const actualOrgId = orgByOwner.id;
      await handleCheckoutWithOrg(session, actualOrgId, tier, orgByOwner, supabase);
      return;
    }
    return;
  }

  if (!existingOrg) {
    console.error("[STRIPE WEBHOOK] ❌ Organization not found:", organizationId);
    // If we have a user_id, try to find org by owner_id as fallback
    if (userId) {
      console.log("[STRIPE WEBHOOK] 🔄 Attempting fallback lookup by user_id:", userId);
      const { data: orgByOwner, error: ownerError } = await supabase
        .from("organizations")
        .select("id, subscription_tier, subscription_status, owner_id")
        .eq("owner_id", userId)
        .maybeSingle();
      
      if (ownerError || !orgByOwner) {
        console.error("[STRIPE WEBHOOK] ❌ Fallback lookup also failed:", ownerError);
        return;
      }
      
      console.log("[STRIPE WEBHOOK] ✅ Found organization via fallback:", orgByOwner.id);
      // Update the organizationId to use the correct one
      const actualOrgId = orgByOwner.id;
      await handleCheckoutWithOrg(session, actualOrgId, tier, orgByOwner, supabase);
      return;
    }
    return;
  }
  
  await handleCheckoutWithOrg(session, organizationId, tier, existingOrg, supabase);
}

async function handleCheckoutWithOrg(
  session: Stripe.Checkout.Session,
  organizationId: string,
  tier: string,
  existingOrg: any,
  supabase: any
) {

  console.log("[STRIPE WEBHOOK] ✅ Processing update for organization:", {
    id: existingOrg.id,
    current_tier: existingOrg.subscription_tier,
    current_status: existingOrg.subscription_status
  });

  // Update organization with subscription details
  const updateData = {
    stripe_subscription_id: session.subscription as string,
    stripe_customer_id: session.customer as string,
    subscription_tier: tier,
    subscription_status: "trialing",
    trial_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  };

  console.log("[STRIPE WEBHOOK] 📝 Updating organization with data:", updateData);

  const { error: updateError, data: updatedOrg } = await supabase
    .from("organizations")
    .update(updateData)
    .eq("id", organizationId)
    .select()
    .single();

  if (updateError) {
    console.error("[STRIPE WEBHOOK] ❌ Error updating organization:", updateError);
    return;
  }

  console.log("[STRIPE WEBHOOK] ✅ Successfully updated organization:", {
    id: organizationId,
    new_tier: updatedOrg.subscription_tier,
    new_status: updatedOrg.subscription_status
  });

  // Log subscription history
  try {
    await supabase.from("subscription_history").insert({
      organization_id: organizationId,
      event_type: "checkout_completed",
      old_tier: existingOrg.subscription_tier,
      new_tier: tier,
      stripe_event_id: session.id,
      metadata: { session_id: session.id },
    });
    console.log("[STRIPE WEBHOOK] ✅ Logged subscription history");
  } catch (historyError) {
    console.warn("[STRIPE WEBHOOK] ⚠️ Failed to log subscription history (non-critical):", historyError);
  }

  console.log(`[STRIPE WEBHOOK] ===== CHECKOUT COMPLETED SUCCESSFULLY for org: ${organizationId} =====`);
}

async function handleSubscriptionCreated(subscription: Stripe.Subscription) {
  const supabase = await createClient();

  const organizationId = subscription.metadata?.organization_id;
  const tier = subscription.metadata?.tier;

  console.log("[STRIPE WEBHOOK] handleSubscriptionCreated called with:", {
    subscriptionId: subscription.id,
    organizationId,
    tier,
    status: subscription.status
  });

  if (!organizationId) {
    console.error("[STRIPE WEBHOOK] No organization_id in subscription metadata:", subscription.metadata);
    return;
  }

  // Verify the organization exists
  const { data: existingOrg, error: orgCheckError } = await supabase
    .from("organizations")
    .select("id")
    .eq("id", organizationId)
    .single();

  if (orgCheckError || !existingOrg) {
    console.error("[STRIPE WEBHOOK] Organization not found:", organizationId, orgCheckError);
    return;
  }

  const { error: updateError } = await supabase
    .from("organizations")
    .update({
      stripe_subscription_id: subscription.id,
      subscription_tier: tier || "basic",
      subscription_status: subscription.status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", organizationId);

  if (updateError) {
    console.error("[STRIPE WEBHOOK] Error updating organization:", updateError);
    return;
  }

  await supabase.from("subscription_history").insert({
    organization_id: organizationId,
    event_type: "subscription_created",
    new_tier: tier,
    stripe_event_id: subscription.id,
    metadata: { subscription_id: subscription.id },
  });

  console.log(`[STRIPE WEBHOOK] Subscription created for org: ${organizationId}`);
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  console.log("[STRIPE WEBHOOK] handleSubscriptionUpdated called with subscription:", {
    id: subscription.id,
    status: subscription.status,
    metadata: subscription.metadata
  });

  const supabase = await createClient();

  const organizationId = subscription.metadata?.organization_id;
  const tier = subscription.metadata?.tier;
  const userId = subscription.metadata?.user_id;

  console.log("[STRIPE WEBHOOK] Extracted subscription data:", { organizationId, tier, userId });

  if (!organizationId) {
    console.error("[STRIPE WEBHOOK] No organization_id in subscription metadata:", subscription.metadata);
    return;
  }

  // Verify the organization exists
  let { data: org, error: orgCheckError } = await supabase
    .from("organizations")
    .select("id, subscription_tier, owner_id")
    .eq("id", organizationId)
    .maybeSingle();

  if (orgCheckError || !org) {
    console.error("[STRIPE WEBHOOK] Organization not found by ID:", organizationId, orgCheckError);
    // Try fallback by user_id
    if (userId) {
      console.log("[STRIPE WEBHOOK] 🔄 Attempting fallback lookup by user_id:", userId);
      const { data: orgByOwner, error: ownerError } = await supabase
        .from("organizations")
        .select("id, subscription_tier, owner_id")
        .eq("owner_id", userId)
        .maybeSingle();
      
      if (ownerError || !orgByOwner) {
        console.error("[STRIPE WEBHOOK] ❌ Fallback lookup also failed:", ownerError);
        return;
      }
      
      org = orgByOwner;
      console.log("[STRIPE WEBHOOK] ✅ Found organization via fallback:", org.id);
    } else {
      return;
    }
  }

  const updateData = {
    subscription_tier: tier || org.subscription_tier || "basic",
    subscription_status: subscription.status,
    updated_at: new Date().toISOString(),
  };

  console.log("[STRIPE WEBHOOK] Updating organization subscription with data:", updateData);

  const { error: updateError } = await supabase
    .from("organizations")
    .update(updateData)
    .eq("id", organizationId);

  if (updateError) {
    console.error("[STRIPE WEBHOOK] Error updating organization subscription:", updateError);
    return;
  }

  console.log("[STRIPE WEBHOOK] Successfully updated organization subscription:", organizationId);

  await supabase.from("subscription_history").insert({
    organization_id: organizationId,
    event_type: "subscription_updated",
    old_tier: org.subscription_tier,
    new_tier: tier,
    stripe_event_id: subscription.id,
    metadata: { subscription_id: subscription.id, status: subscription.status },
  });

  console.log(`[STRIPE WEBHOOK] Subscription updated for org: ${organizationId}`);
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

