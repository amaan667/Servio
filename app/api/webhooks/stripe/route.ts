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

    console.log('[STRIPE WEBHOOK] Received event:', event.type, 'at', new Date().toISOString());

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

    // Find the order by session ID (it should already exist from the payment flow)
    const { data: existingOrder, error: findError } = await supabase
      .from('orders')
      .select('id, venue_id, table_number, customer_name, customer_phone, items, total_amount, source')
      .eq('stripe_session_id', session.id)
      .single();

    if (findError) {
      console.error('[STRIPE WEBHOOK] Order not found for session:', session.id, findError);
      
      // If order doesn't exist, try to find it by the temporary order ID in metadata
      const tempOrderId = session.metadata?.orderId;
      if (tempOrderId) {
        console.log('[STRIPE WEBHOOK] Trying to find order by temp ID:', tempOrderId);
        
        // Look for an order with UNPAID status that matches the session data
        const { data: tempOrder, error: tempError } = await supabase
          .from('orders')
          .select('id, venue_id, table_number, customer_name, customer_phone, items, total_amount, source')
          .eq('payment_status', 'UNPAID')
          .eq('payment_method', 'stripe')
          .eq('venue_id', session.metadata?.venueId || 'default-venue')
          .eq('table_number', parseInt(session.metadata?.tableNumber || '1'))
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (tempOrder && !tempError) {
          console.log('[STRIPE WEBHOOK] Found order by temp ID:', tempOrder.id);
          
          // Update the existing order with payment details
          const { error: updateError } = await supabase
            .from('orders')
            .update({
              payment_status: 'PAID',
              payment_method: 'stripe',
              stripe_session_id: session.id,
              stripe_payment_intent_id: session.payment_intent as string,
              updated_at: new Date().toISOString()
            })
            .eq('id', tempOrder.id);

          if (updateError) {
            console.error('[STRIPE WEBHOOK] Error updating order:', updateError);
            return;
          }

          console.log('[STRIPE WEBHOOK] Order updated successfully:', tempOrder.id);
          return;
        }
      }
      
      console.error('[STRIPE WEBHOOK] Could not find order for session:', session.id);
      return;
    }

    console.log('[STRIPE WEBHOOK] Found existing order:', existingOrder.id);

    // Update the existing order with payment details
    const { error: updateError } = await supabase
      .from('orders')
      .update({
        payment_status: 'PAID',
        payment_method: 'stripe',
        stripe_payment_intent_id: session.payment_intent as string,
        updated_at: new Date().toISOString()
      })
      .eq('id', existingOrder.id);

    if (updateError) {
      console.error('[STRIPE WEBHOOK] Error updating order:', updateError);
      return;
    }

    console.log('[STRIPE WEBHOOK] Order updated successfully:', existingOrder.id);
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