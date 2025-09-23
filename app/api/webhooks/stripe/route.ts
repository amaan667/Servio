import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-08-27.basil',
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    const signature = req.headers.get('stripe-signature');

    if (!signature) {
      console.error('[STRIPE WEBHOOK] No signature provided');
      return NextResponse.json({ error: 'No signature' }, { status: 400 });
    }

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err) {
      console.error('[STRIPE WEBHOOK] Webhook signature verification failed:', err);
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    console.log('[STRIPE WEBHOOK] Received event:', event.type);

    const supabase = await createClient();

    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session, supabase);
        break;

      case 'payment_intent.succeeded':
        await handlePaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent, supabase);
        break;

      case 'payment_intent.payment_failed':
        await handlePaymentIntentFailed(event.data.object as Stripe.PaymentIntent, supabase);
        break;

      default:
        console.log(`[STRIPE WEBHOOK] Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('[STRIPE WEBHOOK] Unexpected error:', error);
    return NextResponse.json({ error: 'Webhook error' }, { status: 500 });
  }
}

async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session, supabase: any) {
  try {
    console.log('[STRIPE WEBHOOK] Processing checkout.session.completed:', session.id);

    // Create the order after successful payment
    const orderId = session.metadata?.orderId;
    if (!orderId) {
      console.error('[STRIPE WEBHOOK] No orderId in session metadata:', session.id);
      return;
    }

    // For now, we'll create a basic order structure
    // In a real implementation, you'd want to store the full order data in the session metadata
    // or retrieve it from a temporary storage
    const orderData = {
      venue_id: session.metadata?.venueId || 'default-venue',
      table_number: parseInt(session.metadata?.tableNumber || '1'),
      customer_name: session.metadata?.customerName || 'Customer',
      customer_phone: session.metadata?.customerPhone || '+1234567890',
      items: JSON.parse(session.metadata?.items || '[]'),
      total_amount: session.amount_total || 0,
      order_status: 'PLACED',
      payment_status: 'PAID',
      payment_method: 'stripe',
      stripe_session_id: session.id,
      stripe_payment_intent_id: session.payment_intent as string,
      source: session.metadata?.source || 'qr',
      notes: 'Stripe payment order'
    };

    console.log('[STRIPE WEBHOOK] Creating order with data:', orderData);

    // Create the order
    const { data: newOrder, error: createError } = await supabase
      .from('orders')
      .insert(orderData)
      .select('id')
      .single();

    if (createError) {
      console.error('[STRIPE WEBHOOK] Error creating order:', createError);
      return;
    }

    console.log('[STRIPE WEBHOOK] Order created successfully:', newOrder.id);
  } catch (error) {
    console.error('[STRIPE WEBHOOK] Error handling checkout session completed:', error);
  }
}

async function handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent, supabase: any) {
  try {
    console.log('[STRIPE WEBHOOK] Processing payment_intent.succeeded:', paymentIntent.id);

    // Find order by stripe_payment_intent_id
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, venue_id')
      .eq('stripe_payment_intent_id', paymentIntent.id)
      .single();

    if (orderError) {
      console.error('[STRIPE WEBHOOK] Order not found for payment intent:', paymentIntent.id);
      return;
    }

    // Update order payment status
    const { error: updateError } = await supabase
      .from('orders')
      .update({
        payment_status: 'PAID',
        payment_method: 'stripe'
      })
      .eq('id', order.id);

    if (updateError) {
      console.error('[STRIPE WEBHOOK] Error updating order:', updateError);
      return;
    }

    console.log('[STRIPE WEBHOOK] Order payment updated successfully:', order.id);
  } catch (error) {
    console.error('[STRIPE WEBHOOK] Error handling payment intent succeeded:', error);
  }
}

async function handlePaymentIntentFailed(paymentIntent: Stripe.PaymentIntent, supabase: any) {
  try {
    console.log('[STRIPE WEBHOOK] Processing payment_intent.payment_failed:', paymentIntent.id);

    // Find order by stripe_payment_intent_id
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, venue_id')
      .eq('stripe_payment_intent_id', paymentIntent.id)
      .single();

    if (orderError) {
      console.error('[STRIPE WEBHOOK] Order not found for payment intent:', paymentIntent.id);
      return;
    }

    // Update order payment status to failed
    const { error: updateError } = await supabase
      .from('orders')
      .update({
        payment_status: 'FAILED',
        payment_method: 'stripe'
      })
      .eq('id', order.id);

    if (updateError) {
      console.error('[STRIPE WEBHOOK] Error updating order:', updateError);
      return;
    }

    console.log('[STRIPE WEBHOOK] Order payment marked as failed:', order.id);
  } catch (error) {
    console.error('[STRIPE WEBHOOK] Error handling payment intent failed:', error);
  }
}