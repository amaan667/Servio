import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { ENV } from '@/lib/env';

const stripe = new Stripe(ENV.STRIPE_SECRET_KEY, {
  apiVersion: '2024-12-18.acacia',
});

const webhookSecret = ENV.STRIPE_WEBHOOK_SECRET;

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get('stripe-signature')!;

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
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
    const { cart_id, venue_id, table_number, customer_name, customer_phone } = paymentIntent.metadata;
    
    if (!cart_id || !venue_id) {
      console.error('[STRIPE WEBHOOK] Missing required metadata for order creation');
      return;
    }

    // Update order status in database
    // This would typically involve updating your orders table
    console.log('[STRIPE WEBHOOK] Order should be marked as paid:', {
      cartId: cart_id,
      venueId: venue_id,
      tableNumber: table_number,
      customerName: customer_name,
      customerPhone: customer_phone,
      paymentIntentId: paymentIntent.id,
      amount: paymentIntent.amount
    });

    // TODO: Implement database update
    // await updateOrderStatus(cart_id, 'paid', paymentIntent.id);
    
    // TODO: Send confirmation email
    // await sendOrderConfirmationEmail(customer_phone, orderDetails);
    
    // TODO: Update inventory
    // await updateInventory(venue_id, items);
    
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
