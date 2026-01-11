import Stripe from "stripe";
import { NextRequest, NextResponse } from "next/server";
// apiErrors intentionally unused in this module
import { createAdminClient } from "@/lib/supabase";
import { stripe } from "@/lib/stripe-client";
import { getCorrelationIdFromRequest } from "@/lib/middleware/correlation-id";
import { trackPaymentError } from "@/lib/monitoring/error-tracking";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

// Customer orders webhook uses its OWN signing secret from Stripe Dashboard
// Get this from: Stripe Dashboard → Webhooks → "Servio" endpoint → Signing secret
import { env } from "@/lib/env";

function getWebhookSecret(): string {
  const secret = env("STRIPE_CUSTOMER_WEBHOOK_SECRET");
  if (!secret) {
    throw new Error("STRIPE_CUSTOMER_WEBHOOK_SECRET environment variable is required");
  }
  return secret;
}

/**
 * Stripe Webhook for CUSTOMER ORDER PAYMENTS
 * This is separate from /api/stripe/webhooks which handles SUBSCRIPTIONS
 *
 * NOTE: Uses createAdminClient() - This is CORRECT for webhooks:
 * - External service (Stripe) makes the request
 * - Authenticates via webhook signature verification
 * - Needs system-level access to update orders
 */
export async function POST(_request: NextRequest) {
  const supabaseAdmin = createAdminClient();

  // CRITICAL: Extract correlation ID from request or Stripe event metadata
  const correlationId = getCorrelationIdFromRequest(_request);
  let eventMetadata: Record<string, unknown> | undefined;
  let stripeSessionId: string | undefined;

  .toISOString(),

  const signature = _request.headers.get("stripe-signature");
  if (!signature) {
    
    return new NextResponse("Missing stripe-signature", { status: 400 });
  }

  // IMPORTANT: Read raw body - exact same as subscriptions webhook
  const body = await _request.text();

  let event: Stripe.Event;
  try {
    // Use EXACT same method as subscriptions webhook (no trimming!)
    const webhookSecret = getWebhookSecret();
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    const eventObject = event.data?.object as { metadata?: Record<string, unknown>; id?: string };
    if (eventObject && typeof eventObject.metadata === "object") {
      eventMetadata = eventObject.metadata;
    }
    if (eventObject && typeof eventObject.id === "string") {
      stripeSessionId = eventObject.id;
    }
  } catch (_err) {
    const errorMessage = _err instanceof Error ? _err.message : "Unknown error";

    
    return new NextResponse(`Webhook Error: ${errorMessage}`, { status: 400 });
  }

  // Extract session metadata for error tracking (if checkout session)
  const sessionMetadata =
    event.type === "checkout.session.completed"
      ? (event.data.object as Stripe.Checkout.Session).metadata

  const { data: existingEvent, error: existingEventError } = await supabaseAdmin
    .from("stripe_webhook_events")
    .select("id, status, attempts")
    .eq("event_id", event.id)
    .maybeSingle();

  if (existingEventError) {
    
  }

  if (existingEvent?.status === "succeeded") {
    
    return NextResponse.json({ ok: true, already: true }, { status: 200 });
  }

  // Mark as processing (upsert to allow first insert or retry)
  const attempts = (existingEvent?.attempts ?? 0) + 1;
  const { error: upsertError } = await supabaseAdmin
    .from("stripe_webhook_events")
    .upsert(
      {

        attempts,
        payload: event as unknown as Record<string, unknown>,

      },
      { onConflict: "event_id" }
    )
    .select("id")
    .maybeSingle();

  if (upsertError) {
    
    trackPaymentError(upsertError, {

    return NextResponse.json({ ok: false, error: "Failed to reserve event" }, { status: 500 });
  }

  try {
    if (event.type !== "checkout.session.completed") {
      await finalizeEventStatus(supabaseAdmin, event.id, "succeeded");
      return NextResponse.json({ ok: true, ignored: true }, { status: 200 });
    }

    const session = event.data.object as Stripe.Checkout.Session;
    stripeSessionId = session.id;
    eventMetadata =
      typeof session.metadata === "object" && session.metadata ? session.metadata : undefined;
    const eventCorrelationId = session.metadata?.correlation_id || correlationId;

    

    const { updatedOrders, paymentType } = await processCustomerCheckoutSession(
      session,
      supabaseAdmin,
      eventCorrelationId
    );

    await finalizeEventStatus(supabaseAdmin, event.id, "succeeded");

    return NextResponse.json({

  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    const errorStack = err instanceof Error ? err.stack : undefined;
    
    await finalizeEventStatus(supabaseAdmin, event.id, "failed", {

    trackPaymentError(err, {

      stripeSessionId,

    return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 });
  }
}

// Ensure final status update even on unexpected errors
export async function finalizeEventStatus(

  error?: { message: string; stack?: string }
) {
  const nowIso = new Date().toISOString();
  await supabaseAdmin
    .from("stripe_webhook_events")
    .update({
      status,

    .eq("event_id", eventId);
}

export async function processCustomerCheckoutSession(

  correlationId?: string
): Promise<{
  updatedOrders: Array<{ id: string; venue_id: string; customer_email?: string | null }>;
  paymentType?: string;
}> {
  const paymentType = session.metadata?.paymentType;
  const orderIdsStr = session.metadata?.orderIds;
  const orderId = session.metadata?.orderId;

  const { data: existing } = await supabaseAdmin
    .from("orders")
    .select("id, venue_id, customer_email, stripe_session_id, payment_status")
    .eq("stripe_session_id", session.id)
    .maybeSingle();

  if (existing) {
    
    return { updatedOrders: [existing], paymentType };
  }

  let updatedOrders: Array<{ id: string; venue_id: string; customer_email?: string | null }> = [];

  if (paymentType === "table_payment" && orderIdsStr) {
    const orderIds = orderIdsStr.split(",").filter(Boolean);

    if (orderIds.length === 0) {
      throw new Error("No orderIds in table payment metadata");
    }

    const updateData: Record<string, unknown> = {

    };

    if (session.customer_email) {
      updateData.customer_email = session.customer_email;
    }

    const { data: updated, error: updateError } = await supabaseAdmin
      .from("orders")
      .update(updateData)
      .in("id", orderIds)
      .select("id, venue_id, customer_email");

    if (updateError) {
      throw new Error(updateError.message);
    }

    updatedOrders = updated || [];
    
  } else if (orderId) {
    const updateData: Record<string, unknown> = {

    };

    if (session.customer_email) {
      updateData.customer_email = session.customer_email;
    }

    const { data: updatedOrder, error: updateError } = await supabaseAdmin
      .from("orders")
      .update(updateData)
      .eq("id", orderId)
      .select("id, venue_id, customer_email")
      .single();

    if (updateError) {
      throw new Error(updateError.message);
    }

    updatedOrders = updatedOrder ? [updatedOrder] : [];
    
  } else {
    throw new Error("No orderId or orderIds in session metadata");
  }

  if (updatedOrders.length === 0) {
    throw new Error("No orders updated");
  }

  const firstOrder = updatedOrders[0];

  // Ensure PAY_NOW orders that were created without tickets get KDS tickets once paid.
  // This keeps kitchen flow consistent and prevents unpaid pay-now orders from showing up in KDS.
  try {
    const { createKDSTicketsWithAI } = await import("@/lib/orders/kds-tickets-unified");

    for (const ord of updatedOrders) {
      const { count: ticketCount } = await supabaseAdmin
        .from("kds_tickets")
        .select("*", { count: "exact", head: true })
        .eq("venue_id", ord.venue_id)
        .eq("order_id", ord.id);

      if ((ticketCount || 0) > 0) {
        continue;
      }

      const { data: fullOrder } = await supabaseAdmin
        .from("orders")
        .select(
          "id, venue_id, items, customer_name, table_number, table_id, payment_method, completion_status"
        )
        .eq("id", ord.id)
        .single();

      if (
        !fullOrder ||
        (fullOrder.completion_status || "").toString().toUpperCase() !== "OPEN" ||
        (fullOrder.payment_method || "").toString().toUpperCase() !== "PAY_NOW"
      ) {
        continue;
      }

      if (!Array.isArray(fullOrder.items) || fullOrder.items.length === 0) {
        continue;
      }

      await createKDSTicketsWithAI(supabaseAdmin, {

      // Update order status to IN_PREP to show "preparing in kitchen" label in live orders
      // Also set unified lifecycle fields for proper status tracking
      await supabaseAdmin
        .from("orders")
        .update({
          order_status: "IN_PREP", // Set to IN_PREP to show "preparing in kitchen" label

        .eq("id", fullOrder.id)
        .eq("venue_id", fullOrder.venue_id);

      
    }
  } catch (_e) {
    // Best-effort; don't fail successful payment processing if KDS ticket creation fails.

  }

  try {
    const { data: venue } = await supabaseAdmin
      .from("venues")
      .select("auto_email_receipts, venue_name, email, address")
      .eq("venue_id", firstOrder.venue_id)
      .single();

    const customerEmail = session.customer_email || firstOrder.customer_email;

    if (venue?.auto_email_receipts && customerEmail) {
      const receiptOrderId =
        paymentType === "table_payment" ? updatedOrders[0]?.id : updatedOrders[0]?.id;

      if (receiptOrderId) {
        fetch(`${env("NEXT_PUBLIC_SITE_URL") || "http://localhost:3000"}/api/receipts/send-email`, {

          headers: { "Content-Type": "application/json" },

          }),
        }).catch((err) => {

      }
    }
  } catch (error) {
    
  }

  return { updatedOrders, paymentType };
}
