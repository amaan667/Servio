import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { ENV as _ENV } from "@/lib/env";
import { stripe } from "@/lib/stripe-client";
import { logger } from "@/lib/logger";
import { requireVenueAccessForAPI } from '@/lib/auth/api';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';

interface CreateIntentRequest {
  cartId: string;
  venueId: string;
  tableNumber: number;
  items: Array<{
    id: string;
    name: string;
    price: number;
    quantity: number;
    specialInstructions?: string;
  }>;
  totalAmount: number;
  customerName: string;
  customerPhone: string;
  receiptEmail?: string; // Optional receipt email
}

export async function POST(req: NextRequest) {
  try {

    // CRITICAL: Authentication and venue access verification
    const { searchParams } = new URL(req.url);
    let venueId = searchParams.get('venueId') || searchParams.get('venue_id');
    
    if (!venueId) {
      try {
        const body = await req.clone().json();
        venueId = body?.venueId || body?.venue_id;
      } catch {
        // Body parsing failed
      }
    }
    
    if (venueId) {
      const venueAccessResult = await requireVenueAccessForAPI(venueId, req);
      if (!venueAccessResult.success) {
        return venueAccessResult.response;
      }
    } else {
      // Fallback to basic auth if no venueId
      const { requireAuthForAPI } = await import('@/lib/auth/api');
      const authResult = await requireAuthForAPI(req);
      if (authResult.error || !authResult.user) {
        return NextResponse.json(
          { error: 'Unauthorized', message: authResult.error || 'Authentication required' },
          { status: 401 }
        );
      }
    }

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

    const body: CreateIntentRequest = await req.json();

    // Use venueId from auth check or body
    const finalVenueId = venueId || body.venueId;

    if (!finalVenueId) {
      return NextResponse.json({ error: "venueId is required" }, { status: 400 });
    }

    const {
      cartId,
      tableNumber,
      items,
      totalAmount,
      customerName,
      customerPhone,
      receiptEmail,
    } = body;

    // Validate required fields
    if (!cartId || !finalVenueId || !items || items.length === 0 || !totalAmount) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Validate total amount (should be in pence/cents)
    if (totalAmount < 50) {
      // Minimum £0.50
      return NextResponse.json({ error: "Amount too small" }, { status: 400 });
    }

    // Cart data stored in metadata

    // Store cart data in localStorage equivalent (client-side) or database
    // For now, we'll pass it in metadata (limited size)
    const itemsSummary = items.map((item) => `${item.name} x${item.quantity}`).join(", ");

    // Create payment intent with idempotency key
    const paymentIntentParams: Stripe.PaymentIntentCreateParams = {
      amount: totalAmount,
      currency: "gbp",
      automatic_payment_methods: { enabled: true },
      metadata: {
        cart_id: cartId,
        venue_id: finalVenueId,
        table_number: tableNumber.toString(),
        customer_name: customerName,
        customer_phone: customerPhone,
        item_count: items.length.toString(),
        items_summary: itemsSummary.substring(0, 500), // Limit metadata size
        total_amount: totalAmount.toString(),
      },
      description: `Order for ${customerName} at table ${tableNumber}`,
    };

    // Add receipt email if provided - Stripe will automatically send digital receipts
    if (receiptEmail && receiptEmail.trim() !== "") {
      paymentIntentParams.receipt_email = receiptEmail.trim();
    }

    const paymentIntent = await stripe.paymentIntents.create(paymentIntentParams, {
      idempotencyKey: `pi_${cartId}`,
    });

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
    });
  } catch (_error) {
    logger.error("[PAYMENT INTENT] Error:", {
      error: _error instanceof Error ? _error.message : "Unknown _error",
    });

    if (_error instanceof Stripe.errors.StripeError) {
      return NextResponse.json({ error: _error.message }, { status: 400 });
    }

    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
