import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-08-27.basil',
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(req: NextRequest) {
  console.log('[STRIPE WEBHOOK] ===== WEBHOOK CALLED =====');
  console.log('[STRIPE WEBHOOK] Request received at:', new Date().toISOString());
  console.log('[STRIPE WEBHOOK] Request URL:', req.url);
  console.log('[STRIPE WEBHOOK] Request method:', req.method);
  console.log('[STRIPE WEBHOOK] Webhook secret configured:', !!webhookSecret);
  console.log('[STRIPE WEBHOOK] Webhook secret starts with:', webhookSecret?.substring(0, 10));
  
  try {
    const body = await req.text();
    console.log('[STRIPE WEBHOOK] Request body length:', body.length);
    
    const signature = req.headers.get('stripe-signature');
    console.log('[STRIPE WEBHOOK] Signature present:', !!signature);
    console.log('[STRIPE WEBHOOK] Signature value:', signature?.substring(0, 50) + '...');

    if (!signature) {
      console.error('[STRIPE WEBHOOK] No signature provided');
      return NextResponse.json({ error: 'No signature' }, { status: 400 });
    }

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err) {
      console.error('[STRIPE WEBHOOK] Webhook signature verification failed:', err);
      console.error('[STRIPE WEBHOOK] Error details:', {
        message: err instanceof Error ? err.message : 'Unknown error',
        type: (err as any)?.type || 'unknown',
        code: (err as any)?.code || 'unknown'
      });
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    console.log('[STRIPE WEBHOOK] Received event:', event.type, 'at', new Date().toISOString());

    // Use service role key for admin operations
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

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
    console.log('[STRIPE WEBHOOK] ===== PROCESSING CHECKOUT SESSION COMPLETED =====');
    console.log('[STRIPE WEBHOOK] Session ID:', session.id);
    console.log('[STRIPE WEBHOOK] Session metadata:', JSON.stringify(session.metadata, null, 2));
    console.log('[STRIPE WEBHOOK] Session amount total:', session.amount_total);
    console.log('[STRIPE WEBHOOK] Session payment status:', session.payment_status);

    // Find the order by session ID (it should already exist from the payment flow)
    console.log('[STRIPE WEBHOOK] Looking for existing order with session ID:', session.id);
    const { data: existingOrder, error: findError } = await supabase
      .from('orders')
      .select('id, venue_id, table_number, customer_name, customer_phone, items, total_amount, source')
      .eq('stripe_session_id', session.id)
      .maybeSingle();

    if (findError) {
      console.error('[STRIPE WEBHOOK] Error finding order for session:', session.id, findError);
      return;
    }

    if (!existingOrder) {
      console.log('[STRIPE WEBHOOK] Order not found for session:', session.id);
      
      // For Stripe payments, create the order now with PAID status (order only created after payment succeeds)
      console.log('[STRIPE WEBHOOK] Creating new order with PAID status from session metadata');
      
      try {
        // Parse items from metadata
        const items = session.metadata?.items ? JSON.parse(session.metadata.items) : [];
        console.log('[STRIPE WEBHOOK] Parsed items from metadata:', items);
        
        // Ensure items have required fields for database schema
        const formattedItems = items.map((item: any, index: number) => ({
          menu_item_id: item.id || `temp-item-${index}`,
          quantity: item.quantity || 1,
          price: item.price || 0,
          item_name: item.name || `Item ${index + 1}`,
          specialInstructions: null
        }));
        
        const newOrder = {
          venue_id: session.metadata?.venueId || 'default-venue',
          table_number: parseInt(session.metadata?.tableNumber || '1'),
          customer_name: session.metadata?.customerName || 'Customer',
          customer_phone: session.metadata?.customerPhone || '+1234567890',
          items: formattedItems,
          total_amount: session.amount_total ? session.amount_total / 100 : 0, // Convert from cents
          order_status: 'PLACED',
          payment_status: 'PAID', // Mark as PAID immediately
          payment_method: 'stripe',
          payment_mode: 'online',
          source: session.metadata?.source || 'qr',
          stripe_session_id: session.id,
          stripe_payment_intent_id: session.payment_intent as string,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        console.log('[STRIPE WEBHOOK] Creating new order with data:', JSON.stringify(newOrder, null, 2));

        // Try to insert the order
        const { data: insertedOrder, error: insertError } = await supabase
          .from('orders')
          .insert(newOrder)
          .select('id');

        if (insertError) {
          console.error('[STRIPE WEBHOOK] Error creating order:', insertError);
          console.error('[STRIPE WEBHOOK] Error details:', {
            message: insertError.message,
            details: insertError.details,
            hint: insertError.hint,
            code: insertError.code
          });
          return;
        }

        console.log('[STRIPE WEBHOOK] Order created successfully:', insertedOrder?.[0]?.id);
        return;
      } catch (error) {
        console.error('[STRIPE WEBHOOK] Error creating order from session:', error);
        return;
      }
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
      .maybeSingle();

    if (orderError) {
      console.error('[STRIPE WEBHOOK] Error finding order for payment intent:', paymentIntent.id, orderError);
      return;
    }

    if (!order) {
      console.log('[STRIPE WEBHOOK] Order not found for payment intent:', paymentIntent.id);
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
      .maybeSingle();

    if (orderError) {
      console.error('[STRIPE WEBHOOK] Error finding order for payment intent:', paymentIntent.id, orderError);
      return;
    }

    if (!order) {
      console.log('[STRIPE WEBHOOK] Order not found for payment intent:', paymentIntent.id);
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
