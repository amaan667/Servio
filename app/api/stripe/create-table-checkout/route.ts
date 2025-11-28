import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import Stripe from "stripe";
import { getStripeClient } from "@/lib/stripe-client";
import { withStripeRetry } from "@/lib/stripe-retry";
import { env, isDevelopment, isProduction, getNodeEnv } from '@/lib/env';
import { success, apiErrors, isZodError, handleZodError } from '@/lib/api/standard-response';

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
      return apiErrors.badRequest('Invalid amount');
    }

    if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
      return apiErrors.badRequest('orderIds array is required');
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
      success_url: `${env('NEXT_PUBLIC_SITE_URL')}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${env('NEXT_PUBLIC_SITE_URL')}/payment/cancel`,
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

    return apiErrors.internal('Failed to create checkout session');
  }
}

