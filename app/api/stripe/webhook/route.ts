import Stripe from "stripe";
import { NextRequest, NextResponse } from "next/server";
// apiErrors intentionally unused in this module
import { createAdminClient } from "@/lib/supabase";
import { stripe } from "@/lib/stripe-client";
import { apiLogger } from "@/lib/logger";
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

  apiLogger.debug("[CUSTOMER ORDER WEBHOOK] ===== WEBHOOK RECEIVED =====", {
    correlationId,
    timestamp: new Date().toISOString(),
  });

  const signature = _request.headers.get("stripe-signature");
  if (!signature) {
    apiLogger.error("[CUSTOMER ORDER WEBHOOK] Missing stripe-signature header");
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

    apiLogger.error("[CUSTOMER ORDER WEBHOOK] Webhook construction error:", errorMessage);
    return new NextResponse(`Webhook Error: ${errorMessage}`, { status: 400 });
  }

  // Extract session metadata for error tracking (if checkout session)
  const sessionMetadata =
    event.type === "checkout.session.completed"
      ? (event.data.object as Stripe.Checkout.Session).metadata
      : undefined;

  // Idempotency + DLQ guard using stripe_webhook_events table
  const nowIso = new Date().toISOString();
  const { data: existingEvent, error: existingEventError } = await supabaseAdmin
    .from("stripe_webhook_events")
    .select("id, status, attempts")
    .eq("event_id", event.id)
    .maybeSingle();

  if (existingEventError) {
    apiLogger.error("[CUSTOMER ORDER WEBHOOK] Failed to read webhook event record", {
      error: existingEventError.message,
      eventId: event.id,
      correlationId,
    });
  }

  if (existingEvent?.status === "succeeded") {
    apiLogger.debug("[CUSTOMER ORDER WEBHOOK] Event already processed", {
      eventId: event.id,
      correlationId,
    });
    return NextResponse.json({ ok: true, already: true }, { status: 200 });
  }

  // Mark as processing (upsert to allow first insert or retry)
  const attempts = (existingEvent?.attempts ?? 0) + 1;
  const { error: upsertError } = await supabaseAdmin
    .from("stripe_webhook_events")
    .upsert(
      {
        event_id: event.id,
        type: event.type,
        status: "processing",
        attempts,
        payload: event as unknown as Record<string, unknown>,
        updated_at: nowIso,
      },
      { onConflict: "event_id" }
    )
    .select("id")
    .maybeSingle();

  if (upsertError) {
    apiLogger.error("[CUSTOMER ORDER WEBHOOK] Failed to mark event processing", {
      error: upsertError.message,
      eventId: event.id,
      correlationId,
    });
    trackPaymentError(upsertError, {
      orderId: sessionMetadata?.orderId,
      venueId: sessionMetadata?.venue_id ?? sessionMetadata?.venueId,
      paymentMethod: sessionMetadata?.paymentType,
      stripeSessionId:
        event.type === "checkout.session.completed"
          ? (event.data.object as Stripe.Checkout.Session).id
          : undefined,
    });
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

    apiLogger.debug("[CUSTOMER ORDER WEBHOOK] Processing checkout session", {
      sessionId: session.id,
      correlationId: eventCorrelationId,
      eventId: event.id,
    });

    const { updatedOrders, paymentType } = await processCustomerCheckoutSession(
      session,
      supabaseAdmin,
      eventCorrelationId
    );

    await finalizeEventStatus(supabaseAdmin, event.id, "succeeded");

    return NextResponse.json({
      ok: true,
      orderId:
        paymentType === "table_payment" ? updatedOrders.map((o) => o.id) : updatedOrders[0]?.id,
      orderCount: updatedOrders.length,
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    const errorStack = err instanceof Error ? err.stack : undefined;
    apiLogger.error("[CUSTOMER ORDER WEBHOOK] Unexpected failure", {
      error: errorMessage,
      correlationId,
    });
    await finalizeEventStatus(supabaseAdmin, event.id, "failed", {
      message: errorMessage,
      stack: errorStack,
    });
    trackPaymentError(err, {
      orderId: (eventMetadata?.orderId as string | undefined) ?? undefined,
      venueId:
        (eventMetadata?.venue_id as string | undefined) ??
        (eventMetadata?.venueId as string | undefined),
      paymentMethod: (eventMetadata?.paymentType as string | undefined) ?? undefined,
      stripeSessionId,
    });
    return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 });
  }
}

// Ensure final status update even on unexpected errors
export async function finalizeEventStatus(
  supabaseAdmin: ReturnType<typeof createAdminClient>,
  eventId: string,
  status: "succeeded" | "failed",
  error?: { message: string; stack?: string }
) {
  const nowIso = new Date().toISOString();
  await supabaseAdmin
    .from("stripe_webhook_events")
    .update({
      status,
      processed_at: status === "succeeded" ? nowIso : null,
      last_error: error ?? null,
      updated_at: nowIso,
    })
    .eq("event_id", eventId);
}

export async function processCustomerCheckoutSession(
  session: Stripe.Checkout.Session,
  supabaseAdmin: ReturnType<typeof createAdminClient>,
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
    apiLogger.debug("[CUSTOMER ORDER WEBHOOK] Order already processed for session", {
      sessionId: session.id,
      orderId: existing.id,
      correlationId,
    });
    return { updatedOrders: [existing], paymentType };
  }

  let updatedOrders: Array<{ id: string; venue_id: string; customer_email?: string | null }> = [];

  if (paymentType === "table_payment" && orderIdsStr) {
    const orderIds = orderIdsStr.split(",").filter(Boolean);

    if (orderIds.length === 0) {
      throw new Error("No orderIds in table payment metadata");
    }

    const updateData: Record<string, unknown> = {
      payment_status: "PAID",
      stripe_session_id: session.id,
      stripe_payment_intent_id: String(session.payment_intent ?? ""),
      updated_at: new Date().toISOString(),
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
    apiLogger.info("[CUSTOMER ORDER WEBHOOK] Updated table payment", {
      orderCount: updatedOrders.length,
      orderIds,
      correlationId,
      sessionId: session.id,
    });
  } else if (orderId) {
    const updateData: Record<string, unknown> = {
      payment_status: "PAID",
      stripe_session_id: session.id,
      stripe_payment_intent_id: String(session.payment_intent ?? ""),
      updated_at: new Date().toISOString(),
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
    apiLogger.info("[CUSTOMER ORDER WEBHOOK] Updated single order payment", {
      orderId: updatedOrder?.id,
      correlationId,
      sessionId: session.id,
    });
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
        id: fullOrder.id,
        venue_id: fullOrder.venue_id,
        items: fullOrder.items,
        customer_name: fullOrder.customer_name,
        table_number: fullOrder.table_number,
        table_id: fullOrder.table_id,
      });

      // Update order status to IN_PREP to show "preparing in kitchen" label in live orders
      // Also set unified lifecycle fields for proper status tracking
      await supabaseAdmin
        .from("orders")
        .update({
          order_status: "IN_PREP", // Set to IN_PREP to show "preparing in kitchen" label
          kitchen_status: "PREPARING",
          service_status: "NOT_SERVED",
          completion_status: "OPEN",
          updated_at: new Date().toISOString(),
        })
        .eq("id", fullOrder.id)
        .eq("venue_id", fullOrder.venue_id);

      apiLogger.info("[CUSTOMER ORDER WEBHOOK] Created KDS tickets for paid PAY_NOW order", {
        orderId: fullOrder.id,
        venueId: fullOrder.venue_id,
        correlationId,
      });
    }
  } catch (_e) {
    // Best-effort; don't fail successful payment processing if KDS ticket creation fails.
    apiLogger.warn("[CUSTOMER ORDER WEBHOOK] Post-payment KDS ticket ensure failed", {
      correlationId,
      error: _e instanceof Error ? _e.message : String(_e),
    });
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
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            orderId: receiptOrderId,
            email: customerEmail,
            venueId: firstOrder.venue_id,
          }),
        }).catch((err) => {
          apiLogger.error("[CUSTOMER ORDER WEBHOOK] Failed to auto-send receipt", {
            error: err instanceof Error ? err.message : "Unknown error",
            orderId: receiptOrderId,
          });
        });
      }
    }
  } catch (error) {
    apiLogger.error("[CUSTOMER ORDER WEBHOOK] Error checking auto-send receipt", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }

  return { updatedOrders, paymentType };
}
