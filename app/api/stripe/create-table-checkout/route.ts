import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import Stripe from "stripe";
import { getStripeClient } from "@/lib/stripe-client";
import { withStripeRetry } from "@/lib/stripe-retry";

export const runtime = "nodejs";

const stripe = getStripeClient();

/**
 * Create Stripe checkout session for multiple orders (table-level payment)
 * Used when customer wants to pay all unpaid orders for a table at once
 */
export async function POST(req: Request) {
  try {
    const { orderIds, amount, customerEmail, customerName, venueName, tableNumber } =
      await req.json();

    logger.info("💳 Creating Stripe table checkout session", {
      orderCount: orderIds?.length || 0,
      amount,
      customerName,
      venueName,
      tableNumber,
    });

    if (!amount || amount <= 0) {
      return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
    }

    if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
      return NextResponse.json({ error: "orderIds array is required" }, { status: 400 });
    }

    // Create Stripe checkout session for table payment
    // Store order IDs in metadata (comma-separated)
    const session = await withStripeRetry(
      () => stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "gbp",
            product_data: {
              name: `Table ${tableNumber || ""} - ${orderIds.length} order(s)`,
              description: `${venueName || "Restaurant"} - Pay all unpaid orders`,
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
        orderIds: orderIds.join(","), // Comma-separated list of order IDs
        tableNumber: tableNumber?.toString() || "",
        paymentType: "table_payment",
      },
      }),
      { maxRetries: 3 }
    );

    logger.info("✅ Stripe table checkout session created", {
      sessionId: session.id,
      amount,
      orderCount: orderIds.length,
      venueName,
    });

    return NextResponse.json({
      url: session.url,
      sessionId: session.id,
    });
  } catch (_error) {
    logger.error("[STRIPE TABLE CHECKOUT] Error creating session", {
      error: _error instanceof Error ? _error.message : "Unknown _error",
    });

    return NextResponse.json({ error: "Failed to create checkout session" }, { status: 500 });
  }
}

