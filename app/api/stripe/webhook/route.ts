import Stripe from "stripe";
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { stripe } from "@/lib/stripe-client";
import { apiLogger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

// Customer orders webhook uses its OWN signing secret from Stripe Dashboard
// Get this from: Stripe Dashboard → Webhooks → "Servio" endpoint → Signing secret
const webhookSecret = process.env.STRIPE_CUSTOMER_WEBHOOK_SECRET!;

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

  apiLogger.debug("[CUSTOMER ORDER WEBHOOK] ===== WEBHOOK RECEIVED =====");
  apiLogger.debug("[CUSTOMER ORDER WEBHOOK] Timestamp:", new Date().toISOString());

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
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (_err) {
    const errorMessage = _err instanceof Error ? _err.message : "Unknown error";

    apiLogger.error("[CUSTOMER ORDER WEBHOOK] Webhook construction error:", errorMessage);
    return new NextResponse(`Webhook Error: ${errorMessage}`, { status: 400 });
  }

  if (event.type !== "checkout.session.completed") {
    return NextResponse.json({ ok: true, ignored: true });
  }

  const session = event.data.object as Stripe.Checkout.Session;

  // Check if already processed (idempotency)
  const { data: existing } = await supabaseAdmin
    .from("orders")
    .select("id, stripe_session_id, payment_status")
    .eq("stripe_session_id", session.id)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ ok: true, already: true, orderId: existing.id });
  }

  // Check if this is a table-level payment (multiple orders) or single order
  const paymentType = session.metadata?.paymentType;
  const orderIdsStr = session.metadata?.orderIds; // Comma-separated for table payments
  const orderId = session.metadata?.orderId; // Single order ID

  let updatedOrders: Array<{ id: string; venue_id: string; customer_email?: string | null }> = [];

  if (paymentType === "table_payment" && orderIdsStr) {
    // Table-level payment: update multiple orders
    const orderIds = orderIdsStr.split(",").filter(Boolean);

    if (orderIds.length === 0) {
      return NextResponse.json(
        { ok: false, error: "No orderIds in table payment metadata" },
        { status: 400 }
      );
    }

    // Update all orders in the table payment
    const { data: updated, error: updateError } = await supabaseAdmin
      .from("orders")
      .update({
        payment_status: "PAID",
        payment_method: "stripe",
        stripe_session_id: session.id,
        stripe_payment_intent_id: String(session.payment_intent ?? ""),
        updated_at: new Date().toISOString(),
      })
      .in("id", orderIds)
      .select("id, venue_id, customer_email");

    if (updateError) {
      apiLogger.error("[CUSTOMER ORDER WEBHOOK] Failed to update table orders", {
        error: updateError.message,
        orderIds,
      });
      return NextResponse.json({ ok: false, error: updateError.message }, { status: 500 });
    }

    updatedOrders = updated || [];
    apiLogger.info("[CUSTOMER ORDER WEBHOOK] Updated table payment", {
      orderCount: updatedOrders.length,
      orderIds,
    });
  } else if (orderId) {
    // Single order payment: update one order
    const { data: updatedOrder, error: updateError } = await supabaseAdmin
      .from("orders")
      .update({
        payment_status: "PAID",
        payment_method: "stripe",
        stripe_session_id: session.id,
        stripe_payment_intent_id: String(session.payment_intent ?? ""),
        updated_at: new Date().toISOString(),
      })
      .eq("id", orderId)
      .select("id, venue_id, customer_email")
      .single();

    if (updateError) {
      return NextResponse.json({ ok: false, error: updateError.message }, { status: 500 });
    }

    updatedOrders = updatedOrder ? [updatedOrder] : [];
  } else {
    return NextResponse.json(
      { ok: false, error: "No orderId or orderIds in session metadata" },
      { status: 400 }
    );
  }

  if (updatedOrders.length === 0) {
    return NextResponse.json({ ok: false, error: "No orders updated" }, { status: 500 });
  }

  // Use first order for venue lookup (all should be same venue)
  const firstOrder = updatedOrders[0];

  // Auto-send receipt if enabled and customer email is available
  // For table payments, send receipt for first order (or could send combined receipt)
  try {
    const { data: venue } = await supabaseAdmin
      .from("venues")
      .select("auto_email_receipts, venue_name, venue_email, venue_address")
      .eq("venue_id", firstOrder.venue_id)
      .single();

    const customerEmail = session.customer_email || firstOrder.customer_email;

    if (venue?.auto_email_receipts && customerEmail) {
      // For table payments, send receipt for the first order
      // TODO: Could implement combined receipt in future
      const receiptOrderId =
        paymentType === "table_payment" ? updatedOrders[0]?.id : updatedOrders[0]?.id;

      if (receiptOrderId) {
        // Send receipt email asynchronously (don't wait for it)
        fetch(
          `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/api/receipts/send-email`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              orderId: receiptOrderId,
              email: customerEmail,
              venueId: firstOrder.venue_id,
            }),
          }
        ).catch((err) => {
          apiLogger.error("[CUSTOMER ORDER WEBHOOK] Failed to auto-send receipt", {
            error: err instanceof Error ? err.message : "Unknown error",
            orderId: receiptOrderId,
          });
        });
      }
    }
  } catch (error) {
    // Don't fail webhook if receipt sending fails
    apiLogger.error("[CUSTOMER ORDER WEBHOOK] Error checking auto-send receipt", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }

  return NextResponse.json({
    ok: true,
    orderId: paymentType === "table_payment" ? updatedOrders.map((o) => o.id) : updatedOrders[0]?.id,
    orderCount: updatedOrders.length,
  });
}
