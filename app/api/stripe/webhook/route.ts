import Stripe from "stripe";
import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe-client";
import { stripeService } from "@/lib/services/StripeService";
import { env } from "@/lib/env";
import { trackPaymentError } from "@/lib/monitoring/error-tracking";

export const runtime = "nodejs";

/**
 * Stripe Webhook for CUSTOMER ORDER PAYMENTS
 */
export async function POST(req: NextRequest) {
  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return new NextResponse("Missing stripe-signature", { status: 400 });
  }

  const body = await req.text();
  const webhookSecret = env("STRIPE_CUSTOMER_WEBHOOK_SECRET");

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret!);
  } catch (err) {
    return new NextResponse(`Webhook Error: ${err instanceof Error ? err.message : "Unknown"}`, {
      status: 400,
    });
  }

  // 1. Idempotency Check
  const { processed } = await stripeService.checkWebhookEvent(event.id);
  if (processed) {
    return NextResponse.json({ ok: true, already: true });
  }

  // 2. Record Processing
  await stripeService.recordWebhookProcessing(event);

  try {
    // 3. Handle Event
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      await stripeService.handleOrderPaymentSucceeded(session);
    }

    // 4. Finalize
    await stripeService.finalizeWebhookEvent(event.id, "succeeded");
    return NextResponse.json({ ok: true });
  } catch (err) {
    await stripeService.finalizeWebhookEvent(event.id, "failed", err as Error);
    trackPaymentError(err as Error, {
      stripeSessionId: event.id,
    });
    return new NextResponse("Webhook processing failed", { status: 500 });
  }
}
