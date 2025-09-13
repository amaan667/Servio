import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-12-18.acacia',
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

    // Find order by stripe_session_id
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, venue_id, payment_mode')
      .eq('stripe_session_id', session.id)
      .single();

    if (orderError) {
      console.error('[STRIPE WEBHOOK] Order not found for session:', session.id);
      return;
    }

    // Update order payment status
    const { error: updateError } = await supabase
      .from('orders')
      .update({
        payment_status: 'PAID',
        payment_method: 'stripe',
        stripe_payment_intent_id: session.payment_intent as string
      })
      .eq('id', order.id);

    if (updateError) {
      console.error('[STRIPE WEBHOOK] Error updating order:', updateError);
      return;
    }

    console.log('[STRIPE WEBHOOK] Order payment updated successfully:', order.id);
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