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

  // Get order ID from metadata (order was created BEFORE Stripe checkout)
  const orderId = session.metadata?.orderId;

  if (!orderId) {
    return NextResponse.json(
      { ok: false, error: "No orderId in session metadata" },
      { status: 400 }
    );
  }

  // Update existing order with payment info

  const { data: updatedOrder, error: updateError } = await supabaseAdmin
    .from("orders")
    .update({
      payment_status: "PAID",
      payment_method: "stripe",
      stripe_session_id: session.id,
      stripe_payment_intent_id: String(session.payment_intent ?? ""),
    })
    .eq("id", orderId)
    .select("*")
    .single();

  if (updateError) {
    return NextResponse.json({ ok: false, error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, orderId: updatedOrder.id });
}
