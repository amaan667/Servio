import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { ENV } from '@/lib/env';

const stripe = new Stripe(ENV.STRIPE_SECRET_KEY || '', {
  apiVersion: '2025-08-27.basil',
});

const webhookSecret = ENV.STRIPE_WEBHOOK_SECRET;

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get('stripe-signature')!;

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret || '');
  } catch (err) {
    console.error('[STRIPE WEBHOOK] Signature verification failed:', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  console.log('[STRIPE WEBHOOK] Received event:', event.type, event.id);

  try {
    switch (event.type) {
      case 'payment_intent.succeeded':
        await handlePaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent);
        break;
      
      case 'payment_intent.payment_failed':
        await handlePaymentIntentFailed(event.data.object as Stripe.PaymentIntent);
        break;
      
      case 'payment_intent.canceled':
        await handlePaymentIntentCanceled(event.data.object as Stripe.PaymentIntent);
        break;
      
      case 'payment_method.attached':
        await handlePaymentMethodAttached(event.data.object as Stripe.PaymentMethod);
        break;
      
      case 'customer.created':
        await handleCustomerCreated(event.data.object as Stripe.Customer);
        break;
      
      case 'customer.updated':
        await handleCustomerUpdated(event.data.object as Stripe.Customer);
        break;
      
      default:
        console.log(`[STRIPE WEBHOOK] Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('[STRIPE WEBHOOK] Handler error:', error);
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 });
  }
}

async function handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent) {
  console.log('[STRIPE WEBHOOK] Payment succeeded:', {
    id: paymentIntent.id,
    amount: paymentIntent.amount,
    currency: paymentIntent.currency,
    metadata: paymentIntent.metadata
  });

  try {
    // Extract order information from metadata
    const { cart_id, venue_id, table_number, customer_name, customer_phone, items_summary, total_amount } = paymentIntent.metadata;
    
    if (!cart_id || !venue_id) {
      console.error('[STRIPE WEBHOOK] Missing required metadata for order creation');
      return;
    }

    // Step 1: Create the order first (unpaid)
    const { createClient } = await import('@/lib/supabase/server');
    const supabase = await createClient();

    // Parse items from metadata (simplified for now)
    const items = items_summary ? items_summary.split(',').map((item: string, index: number) => ({
      menu_item_id: `item_${index}`,
      quantity: 1,
      price: Math.round(parseFloat(total_amount) / items_summary.split(',').length),
      item_name: item.trim()
    })) : [];

    const orderData = {
      venue_id: venue_id,
      table_number: parseInt(table_number) || 1,
      customer_name: customer_name || 'Customer',
      customer_phone: customer_phone || '',
      items: items,
      total_amount: parseFloat(total_amount) / 100, // Convert from pence to pounds
      order_status: 'open',
      payment_status: 'unpaid', // Start as unpaid
      payment_method: 'online',
      payment_intent_id: paymentIntent.id
    };

    console.log('[STRIPE WEBHOOK] Creating order:', orderData);

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert(orderData)
      .select()
      .single();

    if (orderError) {
      console.error('[STRIPE WEBHOOK] Failed to create order:', orderError);
      return;
    }

    console.log('[STRIPE WEBHOOK] Order created successfully:', order);

    // Step 2: Update payment status to paid
    const { error: updateError } = await supabase
      .from('orders')
      .update({ 
        payment_status: 'paid',
        payment_method: 'online',
        updated_at: new Date().toISOString()
      })
      .eq('id', order.id);

    if (updateError) {
      console.error('[STRIPE WEBHOOK] Failed to update payment status:', updateError);
      // Order exists but payment status update failed - this is recoverable
    } else {
      console.log('[STRIPE WEBHOOK] Payment status updated to paid successfully');
    }
    
  } catch (error) {
    console.error('[STRIPE WEBHOOK] Error processing successful payment:', error);
  }
}

async function handlePaymentIntentFailed(paymentIntent: Stripe.PaymentIntent) {
  console.log('[STRIPE WEBHOOK] Payment failed:', {
    id: paymentIntent.id,
    amount: paymentIntent.amount,
    currency: paymentIntent.currency,
    last_payment_error: paymentIntent.last_payment_error
  });

  try {
    const { cart_id, venue_id, customer_name, customer_phone } = paymentIntent.metadata;
    
    if (!cart_id || !venue_id) {
      console.error('[STRIPE WEBHOOK] Missing required metadata for failed payment handling');
      return;
    }

    // Update order status to failed
    console.log('[STRIPE WEBHOOK] Order should be marked as payment failed:', {
      cartId: cart_id,
      venueId: venue_id,
      customerName: customer_name,
      customerPhone: customer_phone,
      paymentIntentId: paymentIntent.id,
      error: paymentIntent.last_payment_error?.message
    });

    // TODO: Implement database update
    // await updateOrderStatus(cart_id, 'payment_failed', paymentIntent.id);
    
    // TODO: Send failure notification
    // await sendPaymentFailureNotification(customer_phone, orderDetails);
    
  } catch (error) {
    console.error('[STRIPE WEBHOOK] Error processing failed payment:', error);
  }
}

async function handlePaymentIntentCanceled(paymentIntent: Stripe.PaymentIntent) {
  console.log('[STRIPE WEBHOOK] Payment canceled:', {
    id: paymentIntent.id,
    amount: paymentIntent.amount,
    currency: paymentIntent.currency,
    cancellation_reason: paymentIntent.cancellation_reason
  });

  try {
    const { cart_id, venue_id } = paymentIntent.metadata;
    
    if (!cart_id || !venue_id) {
      console.error('[STRIPE WEBHOOK] Missing required metadata for canceled payment handling');
      return;
    }

    // Update order status to canceled
    console.log('[STRIPE WEBHOOK] Order should be marked as canceled:', {
      cartId: cart_id,
      venueId: venue_id,
      paymentIntentId: paymentIntent.id,
      reason: paymentIntent.cancellation_reason
    });

    // TODO: Implement database update
    // await updateOrderStatus(cart_id, 'canceled', paymentIntent.id);
    
  } catch (error) {
    console.error('[STRIPE WEBHOOK] Error processing canceled payment:', error);
  }
}

async function handlePaymentMethodAttached(paymentMethod: Stripe.PaymentMethod) {
  console.log('[STRIPE WEBHOOK] Payment method attached:', {
    id: paymentMethod.id,
    type: paymentMethod.type,
    customer: paymentMethod.customer
  });

  // This is useful for storing customer payment methods for future use
  // TODO: Store payment method in customer profile
}

async function handleCustomerCreated(customer: Stripe.Customer) {
  console.log('[STRIPE WEBHOOK] Customer created:', {
    id: customer.id,
    email: customer.email,
    name: customer.name
  });

  // TODO: Sync customer data with your database
}

async function handleCustomerUpdated(customer: Stripe.Customer) {
  console.log('[STRIPE WEBHOOK] Customer updated:', {
    id: customer.id,
    email: customer.email,
    name: customer.name
  });

  // TODO: Update customer data in your database
}
