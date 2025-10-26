import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import Stripe from "stripe";

export const runtime = "nodejs";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-12-18.acacia",
});

/**
 * Create Stripe checkout session for customer order payment
 * This is different from subscription checkout - no tier validation needed
 */
export async function POST(req: Request) {
  try {
    const { amount, customerEmail, customerName, venueName, orderId } = await req.json();

    logger.info("💳 Creating Stripe customer checkout session", {
      amount,
      customerName,
      venueName,
      orderId,
    });

    if (!amount || amount <= 0) {
      return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
    }

    if (!orderId) {
      return NextResponse.json({ error: "Order ID is required" }, { status: 400 });
    }

    // Create Stripe checkout session for order payment
    // Store ONLY order ID in metadata (avoids 500 char limit)
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "gbp",
            product_data: {
              name: `Order at ${venueName || "Restaurant"}`,
              description: customerName,
            },
            unit_amount: Math.round(amount * 100), // Convert to pence
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${process.env.NEXT_PUBLIC_SITE_URL}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL}/payment/cancel`,
      customer_email: customerEmail,
      metadata: {
        orderId: orderId, // Just the order ID - webhook will update it
      },
    });

    logger.info("✅ Stripe checkout session created", {
      sessionId: session.id,
      amount,
      venueName,
    });

    return NextResponse.json({
      url: session.url,
      sessionId: session.id,
    });
  } catch (_error) {
    logger.error("[STRIPE CUSTOMER CHECKOUT] Error creating session", {
      error: error instanceof Error ? error.message : "Unknown error",
    });

    return NextResponse.json({ error: "Failed to create checkout session" }, { status: 500 });
  }
}
