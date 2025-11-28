import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import Stripe from "stripe";
import { env } from '@/lib/env';
import { success, apiErrors, isZodError, handleZodError } from '@/lib/api/standard-response';
import { z } from 'zod';
import { validateBody } from '@/lib/api/validation-schemas';

export const runtime = "nodejs";

const stripe = new Stripe(env('STRIPE_SECRET_KEY')!, {
  apiVersion: "2025-08-27.basil" as Stripe.LatestApiVersion,
});

const createCustomerCheckoutSchema = z.object({
  amount: z.number().positive("Amount must be positive"),
  customerEmail: z.string().email("Invalid email address").optional(),
  customerName: z.string().min(1).max(100).optional(),
  venueName: z.string().min(1).max(100).optional(),
  orderId: z.string().uuid("Invalid order ID"),
});

/**
 * Create Stripe checkout session for customer order payment
 * This is different from subscription checkout - no tier validation needed
 */
export async function POST(req: Request) {
  try {
    const body = await validateBody(createCustomerCheckoutSchema, await req.json());

    logger.info("💳 Creating Stripe customer checkout session", {
      amount: body.amount,
      customerName: body.customerName,
      venueName: body.venueName,
      orderId: body.orderId,
    });

    // Create Stripe checkout session for order payment
    // Store ONLY order ID in metadata (avoids 500 char limit)
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "gbp",
            product_data: {
              name: `Order at ${body.venueName || "Restaurant"}`,
              description: body.customerName || "Customer order",
            },
            unit_amount: Math.round(body.amount * 100), // Convert to pence
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${env("NEXT_PUBLIC_SITE_URL") || env("NEXT_PUBLIC_APP_URL") || "http://localhost:3000"}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${env("NEXT_PUBLIC_SITE_URL") || env("NEXT_PUBLIC_APP_URL") || "http://localhost:3000"}/payment/cancel`,
      metadata: {
        orderId: body.orderId,
        paymentType: "order_payment",
      },
      customer_email: body.customerEmail,
    });

    logger.info("✅ Stripe checkout session created", {
      sessionId: session.id,
      orderId: body.orderId,
    });

    return success({
      sessionId: session.id,
      url: session.url,
    });
  } catch (error) {
    logger.error("❌ Error creating Stripe checkout session:", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    if (isZodError(error)) {
      return handleZodError(error);
    }

    return apiErrors.internal(
      "Failed to create checkout session",
      error
    );
  }
}
