import { NextResponse } from "next/server";
import Stripe from "stripe";
import { logger } from "@/lib/logger";
import { withStripeRetry } from "@/lib/stripe-retry";
import { getStripeClient } from "@/lib/stripe-client";

const stripe = getStripeClient();

export async function POST(req: Request) {
  try {
    const {
      amount,
      venueId,
      tableNumber,
      customerName,
      customerPhone,
      orderId,
      items,
      source,
      venueName,
      customerEmail,
    } = await req.json();

    if (!amount || amount < 0.5) {
      return NextResponse.json({ error: "Amount must be at least £0.50" }, { status: 400 });
    }

    // Convert to pence (Stripe uses smallest currency unit)
    const amountInPence = Math.round(amount * 100);

    // Build base URL
    const host = req.headers.get("host") || "localhost:3000";
    const protocol = host.includes("localhost") ? "http" : "https";
    const base = `${protocol}://${host}`;

    // Create Stripe checkout session with automatic tax disabled
    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "gbp",
            product_data: {
              name: `Order at ${venueName || "Restaurant"}`,
              description: `Table: ${tableNumber || "N/A"}`,
            },
            unit_amount: amountInPence,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      metadata: {
        orderId: orderId || "unknown",
        venueId: venueId || "default-venue",
        tableNumber: tableNumber?.toString() || "1",
        customerName: customerName || "Customer",
        customerPhone: customerPhone || "+1234567890",
        source: source || "qr",
        items: JSON.stringify(items || []).substring(0, 200),
      },
      success_url: `${base}/payment/success?session_id={CHECKOUT_SESSION_ID}&orderId=${orderId}`,
      cancel_url: `${base}/payment/cancel?orderId=${orderId}&venueId=${venueId || "default-venue"}&tableNumber=${tableNumber || "1"}`,
    };

    // Add customer email if provided - Stripe will automatically send digital receipts
    if (customerEmail && customerEmail.trim() !== "") {
      sessionParams.customer_email = customerEmail.trim();
    }

    const session = await withStripeRetry(
      () => stripe.checkout.sessions.create(sessionParams),
      { maxRetries: 3 }
    );

    logger.info("[CHECKOUT] Created Stripe session:", {
      sessionId: session.id,
      orderId,
      amount: amountInPence,
      venue: venueId,
    });

    return NextResponse.json({ id: session.id, url: session.url });
  } catch (_error) {
    logger.error("[CHECKOUT] Error creating checkout session:", {
      error: _error instanceof Error ? _error.message : "Unknown _error",
    });

    return NextResponse.json(
      { error: _error instanceof Error ? _error.message : "An _error occurred" },
      { status: 500 }
    );
  }
}
