// Stripe Webhooks - Handle subscription events
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase";
import { stripe } from "@/lib/stripe-client";
import { env } from "@/lib/env";
import { apiErrors } from "@/lib/api/standard-response";
import { trackError } from "@/lib/monitoring/error-tracking";

// Extend Invoice type to include subscription property
interface InvoiceWithSubscription extends Stripe.Invoice {
  subscription?: string | Stripe.Subscription | null;
}

function getWebhookSecret(): string {
  const secret = env("STRIPE_WEBHOOK_SECRET");
  if (!secret) {
    throw new Error("STRIPE_WEBHOOK_SECRET environment variable is required");
  }
  return secret;
}

export async function POST(_request: NextRequest) {
  let eventId = "";
  try {
    const body = await _request.text();
    const signature = _request.headers.get("stripe-signature");

    if (!signature) {
      return apiErrors.badRequest("No signature");
    }

    // Verify webhook signature
    const webhookSecret = getWebhookSecret();
    const event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    eventId = event.id;

    

    const supabase = createAdminClient();
    const nowIso = new Date().toISOString();
    const { data: existingEvent } = await supabase
      .from("stripe_webhook_events")
      .select("status, attempts")
      .eq("event_id", event.id)
      .maybeSingle();

    if (existingEvent?.status === "succeeded") {
      
      return NextResponse.json({ received: true, alreadyProcessed: true });
    }

    const attempts = (existingEvent?.attempts ?? 0) + 1;
    const { error: reserveError } = await supabase
      .from("stripe_webhook_events")
      .upsert(
        {

          attempts,
          payload: event as unknown as Record<string, unknown>,

        },
        { onConflict: "event_id" }
      )
      .select("event_id")
      .maybeSingle();

    if (reserveError) {
      
      return NextResponse.json(
        { received: false, error: "Failed to reserve event" },
        { status: 500 }
      );
    }

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

    }

    await finalizeStripeEvent(supabase, event.id, "succeeded");
    return NextResponse.json({ received: true }, { status: 200 });
  } catch (_error) {
    const errorMessage = _error instanceof Error ? _error.message : "Unknown _error";
    
    trackError(_error, { action: "stripe_subscription_webhook", eventId }, "high");
    try {
      const supabase = createAdminClient();
      await finalizeStripeEvent(supabase, eventId, "failed", {

    } catch {
      /* swallow finalize errors */
    }
    return apiErrors.badRequest(errorMessage);
  }
}

export async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  
  

  // This webhook ONLY handles SUBSCRIPTION payments
  const supabase = createAdminClient();
  const organizationId = session.metadata?.organization_id;
  const tier = session.metadata?.tier;
  const userId = session.metadata?.user_id;

  

  if (!organizationId || !tier) {
    
    return;
  }

  // Verify the organization exists
  const { data: existingOrg, error: orgCheckError } = await supabase
    .from("organizations")
    .select("id, subscription_tier, subscription_status, owner_user_id")
    .eq("id", organizationId)
    .maybeSingle();

  if (orgCheckError) {
    
    // If we have a user_id, try to find org by owner_user_id as fallback
    if (userId) {
      
      const { data: orgByOwner, error: ownerError } = await supabase
        .from("organizations")
        .select("id, subscription_tier, subscription_status, owner_user_id")
        .eq("owner_user_id", userId)
        .maybeSingle();

      if (ownerError || !orgByOwner) {
        
        return;
      }

      
      // Update the organizationId to use the correct one
      const actualOrgId = orgByOwner.id;
      await handleCheckoutWithOrg(session, actualOrgId, tier, orgByOwner, supabase);
      return;
    }
    return;
  }

  if (!existingOrg) {
    
    // If we have a user_id, try to find org by owner_user_id as fallback
    if (userId) {
      
      const { data: orgByOwner, error: ownerError } = await supabase
        .from("organizations")
        .select("id, subscription_tier, subscription_status, owner_user_id")
        .eq("owner_user_id", userId)
        .maybeSingle();

      if (ownerError || !orgByOwner) {
        
        return;
      }

      
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

  existingOrg: Record<string, unknown>,

  // If trial has already ended or subscription is already active, don't restart trial
  const shouldBeTrialing = !trialHasEnded && currentStatus !== "active";

  // Use existing trial_ends_at if available and trial hasn't ended
  // Otherwise, if this is a new subscription and trial hasn't ended, calculate from user creation
  let trialEndsAt = existingTrialEndsAt?.toISOString() || null;

  if (!trialEndsAt && shouldBeTrialing) {
    // If no existing trial end date and we should be trialing, use the user's creation date + 14 days
    const createdAt = existingOrg.created_at;
    const userCreatedAt = new Date(
      typeof createdAt === "string" || typeof createdAt === "number" ? createdAt : Date.now()
    );
    trialEndsAt = new Date(userCreatedAt.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString();
  }

  // Determine subscription status
  // If trial has ended or subscription is already active, use active status
  // Otherwise, use trialing if we should be trialing
  const subscriptionStatus =
    trialHasEnded || currentStatus === "active"
      ? "active"

  };

  

  const { error: updateError, data: updatedOrg } = await supabase
    .from("organizations")
    .update(updateData)
    .eq("id", organizationId)
    .select()
    .single();

  if (updateError) {
    
    return;
  }

  

  // CRITICAL: Ensure all venues for this organization have organization_id set
  // This ensures RPC can read tier correctly via organization_id
  const { error: venueLinkError } = await supabase
    .from("venues")
    .update({ organization_id: organizationId })
    .eq("owner_user_id", updatedOrg.owner_user_id)
    .or(`organization_id.is.null,organization_id.neq.${organizationId}`);

  if (venueLinkError) {
    :", {

      organizationId,

  } else {
    
  }

  // Log subscription history
  try {
    await supabase.from("subscription_history").insert({

      metadata: { session_id: session.id },

  } catch (historyError) {

      historyError instanceof Error ? historyError : { error: String(historyError) }
    );
  }

  
}

export async function handleSubscriptionCreated(subscription: Stripe.Subscription) {
  const supabase = createAdminClient();
  const { getTierFromStripeSubscription } = await import("@/lib/stripe-tier-helper");

  const organizationId = subscription.metadata?.organization_id;

  

  if (!organizationId) {
    
    return;
  }

  // Verify the organization exists
  const { data: existingOrg, error: orgCheckError } = await supabase
    .from("organizations")
    .select("id")
    .eq("id", organizationId)
    .single();

  if (orgCheckError || !existingOrg) {
    
    return;
  }

  // CRITICAL: Pull tier directly from Stripe subscription (price/product metadata)
  // This ensures tier matches what's actually in Stripe - no normalization
  const stripe = await import("@/lib/stripe-client").then((m) => m.stripe);
  const tier = await getTierFromStripeSubscription(subscription, stripe);

  

  const { error: updateError, data: updatedOrg } = await supabase
    .from("organizations")
    .update({

    .eq("id", organizationId)
    .select("owner_user_id")
    .single();

  if (updateError) {
    
    return;
  }

  // CRITICAL: Ensure all venues for this organization have organization_id set
  if (updatedOrg?.owner_user_id) {
    const { error: venueLinkError } = await supabase
      .from("venues")
      .update({ organization_id: organizationId })
      .eq("owner_user_id", updatedOrg.owner_user_id)
      .or(`organization_id.is.null,organization_id.neq.${organizationId}`);

    if (venueLinkError) {
      :", venueLinkError);
    } else {
      
    }
  }

  await supabase.from("subscription_history").insert({

    metadata: { subscription_id: subscription.id },

}

export async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  

  const supabase = createAdminClient();
  const { getTierFromStripeSubscription } = await import("@/lib/stripe-tier-helper");

  const organizationId = subscription.metadata?.organization_id;
  const userId = subscription.metadata?.user_id;

  

  if (!organizationId) {
    
    return;
  }

  // Verify the organization exists
  let { data: org, error: orgCheckError } = await supabase
    .from("organizations")
    .select("id, subscription_tier, owner_user_id, stripe_customer_id")
    .eq("id", organizationId)
    .maybeSingle();

  if (orgCheckError || !org) {
    
    // Try fallback by user_id
    if (userId) {
      
      const { data: orgByOwner, error: ownerError } = await supabase
        .from("organizations")
        .select("id, subscription_tier, owner_user_id, stripe_customer_id")
        .eq("owner_user_id", userId)
        .maybeSingle();

      if (ownerError || !orgByOwner) {
        
        return;
      }

      org = orgByOwner;
      
    } else {
      return;
    }
  }

  // CRITICAL: Pull tier directly from Stripe subscription (price/product metadata)
  // This ensures tier matches what's actually in Stripe - no normalization
  const stripe = await import("@/lib/stripe-client").then((m) => m.stripe);
  const tier = await getTierFromStripeSubscription(subscription, stripe);

  

  // Get existing organization data to preserve trial_ends_at if trial has already ended
  const { data: existingOrg } = await supabase
    .from("organizations")
    .select("trial_ends_at, subscription_status")
    .eq("id", organizationId)
    .single();

  // Preserve trial_ends_at if it exists and trial has ended
  // Don't restart trial for existing customers who already used it
  const updateData: {

  } = {

  };

  // If subscription is active and trial_ends_at exists, preserve it
  // If subscription is trialing, update trial_ends_at from Stripe
  if (subscription.status === "active" && existingOrg?.trial_ends_at) {
    // Preserve existing trial_ends_at - don't overwrite it
    const trialEndsAt = new Date(existingOrg.trial_ends_at);
    if (trialEndsAt < new Date()) {
      // Trial has ended, preserve the date
      updateData.trial_ends_at = existingOrg.trial_ends_at;
    }
  } else if (subscription.trial_end) {
    // Update trial_ends_at from Stripe if subscription is trialing
    updateData.trial_ends_at = new Date(subscription.trial_end * 1000).toISOString();
  }

  

  const { error: updateError, data: updatedOrg } = await supabase
    .from("organizations")
    .update(updateData)
    .eq("id", organizationId)
    .select("owner_user_id")
    .single();

  if (updateError) {
    
    return;
  }

  // CRITICAL: Ensure all venues for this organization have organization_id set
  if (updatedOrg?.owner_user_id) {
    const { error: venueLinkError } = await supabase
      .from("venues")
      .update({ organization_id: organizationId })
      .eq("owner_user_id", updatedOrg.owner_user_id)
      .or(`organization_id.is.null,organization_id.neq.${organizationId}`);

    if (venueLinkError) {
      :", venueLinkError);
    }
  }

  

  await supabase.from("subscription_history").insert({

    metadata: { subscription_id: subscription.id, status: subscription.status },

}

export async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const supabase = createAdminClient();

  const organizationId = subscription.metadata?.organization_id;

  if (!organizationId) {
    
    return;
  }

  const { data: org } = await supabase
    .from("organizations")
    .select("subscription_tier")
    .eq("id", organizationId)
    .single();

  // Downgrade to starter (free tier)
  await supabase
    .from("organizations")
    .update({

    .eq("id", organizationId);

  await supabase.from("subscription_history").insert({

    metadata: { subscription_id: subscription.id },

}

export async function handlePaymentSucceeded(invoice: Stripe.Invoice) {
  const supabase = createAdminClient();

  // Access subscription - can be string (ID) or expanded Subscription object
  const invoiceWithSub = invoice as InvoiceWithSubscription;
  const subscriptionId =
    typeof invoiceWithSub.subscription === "string"
      ? invoiceWithSub.subscription

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

    .eq("id", organizationId);

  
}

export async function handlePaymentFailed(invoice: Stripe.Invoice) {
  const supabase = createAdminClient();

  // Access subscription - can be string (ID) or expanded Subscription object
  const invoiceWithSub = invoice as InvoiceWithSubscription;
  const subscriptionId =
    typeof invoiceWithSub.subscription === "string"
      ? invoiceWithSub.subscription

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

    .eq("id", organizationId);

  
}

export async function finalizeStripeEvent(

  error?: { message: string; stack?: string }
) {
  if (!eventId) return;
  const nowIso = new Date().toISOString();
  await supabase
    .from("stripe_webhook_events")
    .update({
      status,

    .eq("event_id", eventId);
}

export async function processSubscriptionEvent(event: Stripe.Event) {
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

  }
}
