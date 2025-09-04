import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { ENV } from '@/lib/env';

const stripe = new Stripe(ENV.STRIPE_SECRET_KEY, {
  apiVersion: '2024-12-18.acacia',
});

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
}

export async function POST(req: NextRequest) {
  try {
    const body: CreateIntentRequest = await req.json();
    
    const {
      cartId,
      venueId,
      tableNumber,
      items,
      totalAmount,
      customerName,
      customerPhone,
    } = body;

    // Validate required fields
    if (!cartId || !venueId || !items || items.length === 0 || !totalAmount) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate total amount (should be in pence/cents)
    if (totalAmount < 50) { // Minimum £0.50
      return NextResponse.json(
        { error: 'Amount too small' },
        { status: 400 }
      );
    }

    console.log('[PAYMENT INTENT] Creating payment intent:', {
      cartId,
      venueId,
      tableNumber,
      itemCount: items.length,
      totalAmount,
      customerName,
    });

    // Store cart data for later retrieval
    const cartData = {
      cartId,
      venueId,
      tableNumber,
      customerName,
      customerPhone,
      items,
      totalAmount,
    };

    // Store cart data in localStorage equivalent (client-side) or database
    // For now, we'll pass it in metadata (limited size)
    const itemsSummary = items.map(item => `${item.name} x${item.quantity}`).join(', ');

    // Create payment intent with idempotency key
    const paymentIntent = await stripe.paymentIntents.create({
      amount: totalAmount,
      currency: 'gbp',
      automatic_payment_methods: { enabled: true },
      metadata: {
        cart_id: cartId,
        venue_id: venueId,
        table_number: tableNumber.toString(),
        customer_name: customerName,
        customer_phone: customerPhone,
        item_count: items.length.toString(),
        items_summary: itemsSummary.substring(0, 500), // Limit metadata size
        total_amount: totalAmount.toString(),
      },
      description: `Order for ${customerName} at table ${tableNumber}`,
    }, {
      idempotencyKey: `pi_${cartId}`,
    });

    console.log('[PAYMENT INTENT] Created successfully:', {
      id: paymentIntent.id,
      amount: paymentIntent.amount,
      status: paymentIntent.status,
    });

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
    });

  } catch (error) {
    console.error('[PAYMENT INTENT] Error:', error);
    
    if (error instanceof Stripe.errors.StripeError) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
