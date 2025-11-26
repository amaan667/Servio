// Stripe Webhooks - Handle subscription events
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@/lib/supabase";
import { stripe } from "@/lib/stripe-client";
import { apiLogger } from "@/lib/logger";

// Extend Invoice type to include subscription property
interface InvoiceWithSubscription extends Stripe.Invoice {
  subscription?: string | Stripe.Subscription | null;
}

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(_request: NextRequest) {
  try {
    const body = await _request.text();
    const signature = _request.headers.get("stripe-signature");

    if (!signature) {
      return NextResponse.json({ error: "No signature" }, { status: 400 });
    }

    // Verify webhook signature
    const event = stripe.webhooks.constructEvent(body, signature, webhookSecret);

    apiLogger.debug("[STRIPE WEBHOOK] Event:", { type: event.type, id: event.id });

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
        apiLogger.debug(`[STRIPE WEBHOOK] Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (_error) {
    const errorMessage = _error instanceof Error ? _error.message : "Unknown _error";
    apiLogger.error("[STRIPE WEBHOOK] Error:", { error: errorMessage });
    return NextResponse.json({ error: errorMessage }, { status: 400 });
  }
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  apiLogger.debug("[SUBSCRIPTION WEBHOOK] ===== CHECKOUT COMPLETED =====");
  apiLogger.debug("[SUBSCRIPTION WEBHOOK] handleCheckoutCompleted called with session:", {
    id: session.id,
    customer: session.customer,
    subscription: session.subscription,
    metadata: session.metadata,
    mode: session.mode,
  });

  // This webhook ONLY handles SUBSCRIPTION payments
  const supabase = await createClient();
  const organizationId = session.metadata?.organization_id;
  const tier = session.metadata?.tier;
  const userId = session.metadata?.user_id;

  apiLogger.debug("[SUBSCRIPTION WEBHOOK] Extracted data:", { organizationId, tier, userId });

  if (!organizationId || !tier) {
    apiLogger.error(
      "[SUBSCRIPTION WEBHOOK] ❌ Missing required metadata in checkout session:",
      session.metadata
    );
    return;
  }

  // Verify the organization exists
  const { data: existingOrg, error: orgCheckError } = await supabase
    .from("organizations")
    .select("id, subscription_tier, subscription_status, owner_user_id")
    .eq("id", organizationId)
    .maybeSingle();

  if (orgCheckError) {
    apiLogger.error("[STRIPE WEBHOOK] ❌ Error checking organization:", orgCheckError);
    // If we have a user_id, try to find org by owner_user_id as fallback
    if (userId) {
      apiLogger.debug("[STRIPE WEBHOOK] 🔄 Attempting fallback lookup by user_id:", userId);
      const { data: orgByOwner, error: ownerError } = await supabase
        .from("organizations")
        .select("id, subscription_tier, subscription_status, owner_user_id")
        .eq("owner_user_id", userId)
        .maybeSingle();

      if (ownerError || !orgByOwner) {
        apiLogger.error("[STRIPE WEBHOOK] ❌ Fallback lookup also failed:", ownerError);
        return;
      }

      apiLogger.debug("[STRIPE WEBHOOK] ✅ Found organization via fallback:", orgByOwner.id);
      // Update the organizationId to use the correct one
      const actualOrgId = orgByOwner.id;
      await handleCheckoutWithOrg(session, actualOrgId, tier, orgByOwner, supabase);
      return;
    }
    return;
  }

  if (!existingOrg) {
    apiLogger.error("[STRIPE WEBHOOK] ❌ Organization not found:", organizationId);
    // If we have a user_id, try to find org by owner_user_id as fallback
    if (userId) {
      apiLogger.debug("[STRIPE WEBHOOK] 🔄 Attempting fallback lookup by user_id:", userId);
      const { data: orgByOwner, error: ownerError } = await supabase
        .from("organizations")
        .select("id, subscription_tier, subscription_status, owner_user_id")
        .eq("owner_user_id", userId)
        .maybeSingle();

      if (ownerError || !orgByOwner) {
        apiLogger.error("[STRIPE WEBHOOK] ❌ Fallback lookup also failed:", ownerError);
        return;
      }

      apiLogger.debug("[STRIPE WEBHOOK] ✅ Found organization via fallback:", orgByOwner.id);
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
  existingOrg: Record<string, unknown>,
  supabase: Awaited<ReturnType<typeof createClient>>
) {
  apiLogger.debug("[STRIPE WEBHOOK] ✅ Processing update for organization:", {
    id: existingOrg.id,
    current_tier: existingOrg.subscription_tier,
    current_status: existingOrg.subscription_status,
  });

  // Update organization with subscription details
  // Use the existing trial_ends_at if available, otherwise calculate from user creation
  let trialEndsAt = existingOrg.trial_ends_at;

  if (!trialEndsAt) {
    // If no existing trial end date, use the user's creation date + 14 days
    const createdAt = existingOrg.created_at;
    const userCreatedAt = new Date(
      typeof createdAt === "string" || typeof createdAt === "number" ? createdAt : Date.now()
    );
    trialEndsAt = new Date(userCreatedAt.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString();
  }

  // Normalize tier to ensure only starter/pro/enterprise
  const { normalizeTier } = await import("@/lib/stripe-tier-helper");
  const normalizedTier = normalizeTier(tier);

  const updateData = {
    stripe_subscription_id: session.subscription as string,
    stripe_customer_id: session.customer as string,
    subscription_tier: normalizedTier,
    subscription_status: "trialing",
    trial_ends_at: trialEndsAt,
    updated_at: new Date().toISOString(),
  };

  apiLogger.debug("[STRIPE WEBHOOK] 📝 Updating organization with data:", updateData);

  const { error: updateError, data: updatedOrg } = await supabase
    .from("organizations")
    .update(updateData)
    .eq("id", organizationId)
    .select()
    .single();

  if (updateError) {
    apiLogger.error("[STRIPE WEBHOOK] ❌ Error updating organization:", updateError);
    return;
  }

  apiLogger.debug("[STRIPE WEBHOOK] ✅ Successfully updated organization:", {
    id: organizationId,
    new_tier: updatedOrg.subscription_tier,
    new_status: updatedOrg.subscription_status,
  });

  // Log subscription history
  try {
    await supabase.from("subscription_history").insert({
      organization_id: organizationId,
      event_type: "checkout_completed",
      old_tier: existingOrg.subscription_tier,
      new_tier: normalizedTier,
      stripe_event_id: session.id,
      metadata: { session_id: session.id },
    });
    apiLogger.debug("[STRIPE WEBHOOK] ✅ Logged subscription history");
  } catch (historyError) {
    apiLogger.warn(
      "[STRIPE WEBHOOK] ⚠️ Failed to log subscription history (non-critical):",
      historyError instanceof Error ? historyError : { error: String(historyError) }
    );
  }

  apiLogger.debug(
    `[STRIPE WEBHOOK] ===== CHECKOUT COMPLETED SUCCESSFULLY for org: ${organizationId} =====`
  );
}

async function handleSubscriptionCreated(subscription: Stripe.Subscription) {
  const supabase = await createClient();
  const { getTierFromStripeSubscription } = await import("@/lib/stripe-tier-helper");

  const organizationId = subscription.metadata?.organization_id;

  apiLogger.debug("[STRIPE WEBHOOK] handleSubscriptionCreated called with:", {
    subscriptionId: subscription.id,
    organizationId,
    status: subscription.status,
  });

  if (!organizationId) {
    apiLogger.error(
      "[STRIPE WEBHOOK] No organization_id in subscription metadata:",
      subscription.metadata
    );
    return;
  }

  // Verify the organization exists
  const { data: existingOrg, error: orgCheckError } = await supabase
    .from("organizations")
    .select("id")
    .eq("id", organizationId)
    .single();

  if (orgCheckError || !existingOrg) {
    apiLogger.error("[STRIPE WEBHOOK] Organization not found:", {
      organizationId,
      error: orgCheckError,
    });
    return;
  }

  // CRITICAL: Pull tier directly from Stripe subscription (price/product metadata)
  // This ensures tier matches what's actually in Stripe, not just metadata
  const stripe = await import("@/lib/stripe-client").then((m) => m.stripe);
  const tierRaw = await getTierFromStripeSubscription(subscription, stripe);
  
  // Normalize tier: basic→starter, standard→pro, premium→enterprise
  const { normalizeTier } = await import("@/lib/stripe-tier-helper");
  const tier = normalizeTier(tierRaw);
  
  apiLogger.info("[STRIPE WEBHOOK] Tier extracted and normalized:", {
    rawTier: tierRaw,
    normalizedTier: tier,
    subscriptionId: subscription.id,
    organizationId,
  });

  const { error: updateError } = await supabase
    .from("organizations")
    .update({
      stripe_subscription_id: subscription.id,
      subscription_tier: tier,
      subscription_status: subscription.status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", organizationId);

  if (updateError) {
    apiLogger.error("[STRIPE WEBHOOK] Error updating organization:", updateError);
    return;
  }

  await supabase.from("subscription_history").insert({
    organization_id: organizationId,
    event_type: "subscription_created",
    new_tier: tier,
    stripe_event_id: subscription.id,
    metadata: { subscription_id: subscription.id },
  });

  apiLogger.debug(`[STRIPE WEBHOOK] Subscription created for org: ${organizationId}`);
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  apiLogger.debug("[STRIPE WEBHOOK] handleSubscriptionUpdated called with subscription:", {
    id: subscription.id,
    status: subscription.status,
    metadata: subscription.metadata,
  });

  const supabase = await createClient();
  const { getTierFromStripeSubscription } = await import("@/lib/stripe-tier-helper");

  const organizationId = subscription.metadata?.organization_id;
  const userId = subscription.metadata?.user_id;

  apiLogger.debug("[STRIPE WEBHOOK] Extracted subscription data:", {
    organizationId,
    userId,
  });

  if (!organizationId) {
    apiLogger.error(
      "[STRIPE WEBHOOK] No organization_id in subscription metadata:",
      subscription.metadata
    );
    return;
  }

  // Verify the organization exists
  let { data: org, error: orgCheckError } = await supabase
    .from("organizations")
    .select("id, subscription_tier, owner_user_id, stripe_customer_id")
    .eq("id", organizationId)
    .maybeSingle();

  if (orgCheckError || !org) {
    apiLogger.error("[STRIPE WEBHOOK] Organization not found by ID:", {
      organizationId,
      error: orgCheckError,
    });
    // Try fallback by user_id
    if (userId) {
      apiLogger.debug("[STRIPE WEBHOOK] 🔄 Attempting fallback lookup by user_id:", userId);
      const { data: orgByOwner, error: ownerError } = await supabase
        .from("organizations")
        .select("id, subscription_tier, owner_user_id, stripe_customer_id")
        .eq("owner_user_id", userId)
        .maybeSingle();

      if (ownerError || !orgByOwner) {
        apiLogger.error("[STRIPE WEBHOOK] ❌ Fallback lookup also failed:", ownerError);
        return;
      }

      org = orgByOwner;
      apiLogger.debug("[STRIPE WEBHOOK] ✅ Found organization via fallback:", org.id);
    } else {
      return;
    }
  }

  // CRITICAL: Pull tier directly from Stripe subscription (price/product metadata)
  // This ensures tier matches what's actually in Stripe, not just metadata
  const stripe = await import("@/lib/stripe-client").then((m) => m.stripe);
  const tierRaw = await getTierFromStripeSubscription(subscription, stripe);
  
  // Normalize tier: basic→starter, standard→pro, premium→enterprise
  const { normalizeTier } = await import("@/lib/stripe-tier-helper");
  const tier = normalizeTier(tierRaw);
  
  apiLogger.info("[STRIPE WEBHOOK] Tier extracted and normalized:", {
    rawTier: tierRaw,
    normalizedTier: tier,
    subscriptionId: subscription.id,
    organizationId: org.id,
  });

  const updateData = {
    subscription_tier: tier,
    subscription_status: subscription.status,
    updated_at: new Date().toISOString(),
  };

  apiLogger.debug("[STRIPE WEBHOOK] Updating organization subscription with data:", updateData);

  const { error: updateError } = await supabase
    .from("organizations")
    .update(updateData)
    .eq("id", organizationId);

  if (updateError) {
    apiLogger.error("[STRIPE WEBHOOK] Error updating organization subscription:", updateError);
    return;
  }

  apiLogger.debug(
    "[STRIPE WEBHOOK] Successfully updated organization subscription:",
    organizationId
  );

  await supabase.from("subscription_history").insert({
    organization_id: organizationId,
    event_type: "subscription_updated",
    old_tier: org.subscription_tier,
    new_tier: tier,
    stripe_event_id: subscription.id,
    metadata: { subscription_id: subscription.id, status: subscription.status },
  });

  apiLogger.debug(`[STRIPE WEBHOOK] Subscription updated for org: ${organizationId}`);
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const supabase = await createClient();

  const organizationId = subscription.metadata?.organization_id;

  if (!organizationId) {
    apiLogger.error("[STRIPE] No organization_id in subscription");
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
      subscription_tier: "starter",
      subscription_status: "canceled",
      stripe_subscription_id: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", organizationId);

  await supabase.from("subscription_history").insert({
    organization_id: organizationId,
    event_type: "subscription_canceled",
    old_tier: org?.subscription_tier,
    new_tier: "starter",
    stripe_event_id: subscription.id,
    metadata: { subscription_id: subscription.id },
  });

  apiLogger.debug(`[STRIPE] Subscription deleted for org: ${organizationId}`);
}

async function handlePaymentSucceeded(invoice: Stripe.Invoice) {
  const supabase = await createClient();

  // Access subscription - can be string (ID) or expanded Subscription object
  const invoiceWithSub = invoice as InvoiceWithSubscription;
  const subscriptionId =
    typeof invoiceWithSub.subscription === "string"
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

  apiLogger.debug(`[STRIPE] Payment succeeded for org: ${organizationId}`);
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  const supabase = await createClient();

  // Access subscription - can be string (ID) or expanded Subscription object
  const invoiceWithSub = invoice as InvoiceWithSubscription;
  const subscriptionId =
    typeof invoiceWithSub.subscription === "string"
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

  apiLogger.debug(`[STRIPE] Payment failed for org: ${organizationId}`);
}
