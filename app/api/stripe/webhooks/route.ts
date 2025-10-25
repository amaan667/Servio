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

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get("stripe-signature");

    if (!signature) {
      return NextResponse.json({ error: "No signature" }, { status: 400 });
    }

    // Verify webhook signature
    const event = stripe.webhooks.constructEvent(body, signature, webhookSecret);

    apiLogger.debug("[STRIPE WEBHOOK] Event:", event.type, "ID:", event.id);

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
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    apiLogger.error("[STRIPE WEBHOOK] Error:", { error: errorMessage });
    return NextResponse.json({ error: errorMessage }, { status: 400 });
  }
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  console.info("\n" + "=".repeat(80));
  console.info("💳 [STRIPE WEBHOOK] CHECKOUT COMPLETED");
  console.info("=".repeat(80));
  console.info("🎯 Session ID:", session.id);
  console.info("💰 Amount:", session.amount_total, session.currency);
  console.info("📦 Metadata:", session.metadata);
  console.info("=".repeat(80) + "\n");

  apiLogger.debug("[STRIPE WEBHOOK] ===== CHECKOUT COMPLETED =====");
  apiLogger.debug("[STRIPE WEBHOOK] handleCheckoutCompleted called with session:", {
    id: session.id,
    customer: session.customer,
    subscription: session.subscription,
    metadata: session.metadata,
    mode: session.mode,
  });

  // CHECK 1: Is this a CUSTOMER ORDER payment?
  const orderType = session.metadata?.orderType;
  if (orderType === "customer_order") {
    console.info("🛒 [STRIPE WEBHOOK] Detected CUSTOMER ORDER payment");
    await handleCustomerOrderPayment(session);
    return;
  }

  // CHECK 2: Is this a SUBSCRIPTION payment?
  const supabase = await createClient();
  const organizationId = session.metadata?.organization_id;
  const tier = session.metadata?.tier;
  const userId = session.metadata?.user_id;

  apiLogger.debug("[STRIPE WEBHOOK] Extracted data:", { organizationId, tier, userId });

  if (!organizationId || !tier) {
    console.warn("⚠️  [STRIPE WEBHOOK] Not a subscription payment (no org/tier metadata)");
    apiLogger.error(
      "[STRIPE WEBHOOK] ❌ Missing required metadata in checkout session:",
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
    const userCreatedAt = new Date(existingOrg.created_at || Date.now());
    trialEndsAt = new Date(userCreatedAt.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString();
  }

  const updateData = {
    stripe_subscription_id: session.subscription as string,
    stripe_customer_id: session.customer as string,
    subscription_tier: tier,
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
      new_tier: tier,
      stripe_event_id: session.id,
      metadata: { session_id: session.id },
    });
    apiLogger.debug("[STRIPE WEBHOOK] ✅ Logged subscription history");
  } catch (historyError) {
    apiLogger.warn(
      "[STRIPE WEBHOOK] ⚠️ Failed to log subscription history (non-critical):",
      historyError
    );
  }

  apiLogger.debug(
    `[STRIPE WEBHOOK] ===== CHECKOUT COMPLETED SUCCESSFULLY for org: ${organizationId} =====`
  );
}

async function handleSubscriptionCreated(subscription: Stripe.Subscription) {
  const supabase = await createClient();

  const organizationId = subscription.metadata?.organization_id;
  const tier = subscription.metadata?.tier;

  apiLogger.debug("[STRIPE WEBHOOK] handleSubscriptionCreated called with:", {
    subscriptionId: subscription.id,
    organizationId,
    tier,
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
    apiLogger.error("[STRIPE WEBHOOK] Organization not found:", organizationId, orgCheckError);
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

  const organizationId = subscription.metadata?.organization_id;
  const tier = subscription.metadata?.tier;
  const userId = subscription.metadata?.user_id;

  apiLogger.debug("[STRIPE WEBHOOK] Extracted subscription data:", {
    organizationId,
    tier,
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
  let { data: org } = await supabase
    .from("organizations")
    .select("id, subscription_tier, owner_user_id")
    .eq("id", organizationId)
    .maybeSingle();

  if (orgCheckError || !org) {
    apiLogger.error(
      "[STRIPE WEBHOOK] Organization not found by ID:",
      organizationId,
      orgCheckError
    );
    // Try fallback by user_id
    if (userId) {
      apiLogger.debug("[STRIPE WEBHOOK] 🔄 Attempting fallback lookup by user_id:", userId);
      const { data: orgByOwner, error: ownerError } = await supabase
        .from("organizations")
        .select("id, subscription_tier, owner_user_id")
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

  const updateData = {
    subscription_tier: tier || org.subscription_tier || "basic",
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

/**
 * Handle customer order payment (QR code orders)
 */
async function handleCustomerOrderPayment(session: Stripe.Checkout.Session) {
  console.info("💳 [CUSTOMER ORDER WEBHOOK] Processing customer order payment...");

  try {
    const { createAdminClient } = await import("@/lib/supabase");
    const supabaseAdmin = createAdminClient();

    // Check if already processed (idempotency)
    const { data: existing } = await supabaseAdmin
      .from("orders")
      .select("id, stripe_session_id, payment_status")
      .eq("stripe_session_id", session.id)
      .maybeSingle();

    if (existing) {
      console.info("✅ [CUSTOMER ORDER WEBHOOK] Session already processed:", existing.id);
      return;
    }

    // Get checkout data from metadata
    const checkoutDataJson = session.metadata?.checkoutDataJson;
    console.info("📦 [CUSTOMER ORDER WEBHOOK] Has checkoutDataJson:", !!checkoutDataJson);

    if (!checkoutDataJson) {
      console.error("❌ [CUSTOMER ORDER WEBHOOK] No checkout data in metadata!");
      console.error("❌ Metadata:", session.metadata);
      return;
    }

    const checkoutData = JSON.parse(checkoutDataJson);
    console.info("✅ [CUSTOMER ORDER WEBHOOK] Parsed checkout data:");
    console.info("  📋 Venue:", checkoutData.venueId);
    console.info("  👤 Customer:", checkoutData.customerName);
    console.info("  📞 Phone:", checkoutData.customerPhone);
    console.info("  🪑 Table:", checkoutData.tableNumber);
    console.info("  🛒 Items:", checkoutData.cart?.length);
    console.info("  💰 Total:", checkoutData.total);

    if (checkoutData.cart && checkoutData.cart.length > 0) {
      console.info("🛒 [CUSTOMER ORDER WEBHOOK] Cart items:");
      checkoutData.cart.forEach(
        (item: { name: string; quantity: number; price: number; id?: string }, idx: number) => {
          console.info(`    ${idx + 1}. ${item.name} x${item.quantity} @ £${item.price}`);
        }
      );
    }

    // Create order in database
    const orderPayload = {
      venue_id: checkoutData.venueId,
      table_number: checkoutData.tableNumber,
      table_id: null,
      counter_number: checkoutData.counterNumber || null,
      order_type: checkoutData.orderType || "table",
      order_location: checkoutData.orderLocation || checkoutData.tableNumber?.toString() || "1",
      customer_name: checkoutData.customerName,
      customer_phone: checkoutData.customerPhone,
      items: checkoutData.cart.map(
        (item: {
          id?: string;
          quantity: number;
          price: number;
          name: string;
          specialInstructions?: string;
        }) => ({
          menu_item_id: item.id || "unknown",
          quantity: item.quantity,
          price: item.price,
          item_name: item.name,
          specialInstructions: item.specialInstructions || null,
        })
      ),
      total_amount: checkoutData.total,
      notes: checkoutData.notes || "",
      order_status: "IN_PREP",
      payment_status: "PAID",
      payment_mode: "online",
      payment_method: "stripe",
      session_id: checkoutData.sessionId,
      source: checkoutData.source || "qr",
      stripe_session_id: session.id,
      stripe_payment_intent_id: String(session.payment_intent ?? ""),
    };

    console.info("💾 [CUSTOMER ORDER WEBHOOK] Creating order...");
    const { data: createdOrder, error: createError } = await supabaseAdmin
      .from("orders")
      .insert(orderPayload)
      .select("*")
      .single();

    if (createError) {
      console.error("\n" + "=".repeat(80));
      console.error("❌ [CUSTOMER ORDER WEBHOOK] ORDER CREATION FAILED!");
      console.error("=".repeat(80));
      console.error("❌ Error code:", createError.code);
      console.error("❌ Error message:", createError.message);
      console.error("❌ Error details:", createError);
      console.error("=".repeat(80) + "\n");
      return;
    }

    console.info("\n" + "=".repeat(80));
    console.info("✅ [CUSTOMER ORDER WEBHOOK] ORDER CREATED SUCCESSFULLY!");
    console.info("=".repeat(80));
    console.info("🆔 Order ID:", createdOrder.id);
    console.info("📊 Order Status:", createdOrder.order_status);
    console.info("💳 Payment Status:", createdOrder.payment_status);
    console.info("👤 Customer:", createdOrder.customer_name);
    console.info("🏪 Venue ID:", createdOrder.venue_id);
    console.info("🪑 Table:", createdOrder.table_number);
    console.info("🛒 Items:", createdOrder.items?.length);
    console.info("💰 Total:", createdOrder.total_amount);
    console.info("=".repeat(80) + "\n");
  } catch (error) {
    console.error("\n" + "=".repeat(80));
    console.error("❌ [CUSTOMER ORDER WEBHOOK] UNEXPECTED ERROR!");
    console.error("=".repeat(80));
    console.error("❌ Error:", error);
    console.error("❌ Message:", error instanceof Error ? error.message : String(error));
    console.error("=".repeat(80) + "\n");
  }
}
