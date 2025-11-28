import { NextResponse } from "next/server";
import Stripe from "stripe";
import { logger } from "@/lib/logger";
import { withStripeRetry } from "@/lib/stripe-retry";
import { getStripeClient } from "@/lib/stripe-client";
import { withUnifiedAuth } from '@/lib/auth/unified-auth';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { NextRequest } from 'next/server';
import { success, apiErrors, isZodError, handleZodError } from '@/lib/api/standard-response';

export const runtime = "nodejs";

const stripe = getStripeClient();

export const POST = withUnifiedAuth(
  async (req: NextRequest, context) => {
    try {
      // CRITICAL: Rate limiting
      const rateLimitResult = await rateLimit(req, RATE_LIMITS.GENERAL);
      if (!rateLimitResult.success) {
        return NextResponse.json(
          {
            error: 'Too many requests',
            message: `Rate limit exceeded. Try again in ${Math.ceil((rateLimitResult.reset - Date.now()) / 1000)} seconds.`,
          },
          { status: 429 }
        );
      }

      const body = await req.json();
      const {
        amount,
        tableNumber,
        customerName,
        customerPhone,
        orderId,
        items,
        source,
        venueName,
        customerEmail,
      } = body;

      // Use venueId from context
      const finalVenueId = context.venueId || body.venueId;

    if (!finalVenueId) {
      return apiErrors.badRequest('venueId is required');
    }

    if (!amount || amount < 0.5) {
      return apiErrors.badRequest('Amount must be at least £0.50');
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
        venueId: finalVenueId,
        tableNumber: tableNumber?.toString() || "1",
        customerName: customerName || "Customer",
        customerPhone: customerPhone || "+1234567890",
        source: source || "qr",
        items: JSON.stringify(items || []).substring(0, 200),
      },
      success_url: `${base}/payment/success?session_id={CHECKOUT_SESSION_ID}&orderId=${orderId}`,
      cancel_url: `${base}/payment/cancel?orderId=${orderId}&venueId=${finalVenueId}&tableNumber=${tableNumber || "1"}`,
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
      venue: finalVenueId,
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
);
