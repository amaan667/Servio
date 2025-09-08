import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { ENV } from '@/lib/env';
import { v4 as uuidv4 } from 'uuid';

const stripe = new Stripe(ENV.STRIPE_SECRET_KEY || '', {
  apiVersion: '2025-08-27.basil',
});

const supabase = createClient(
  ENV.SUPABASE_URL,
  ENV.SUPABASE_SERVICE_ROLE_KEY || ''
);

interface CreateOrderRequest {
  paymentIntentId: string;
  cartId: string;
}

export async function POST(req: NextRequest) {
  try {
    const body: CreateOrderRequest = await req.json();
    const { paymentIntentId, cartId } = body;

    if (!paymentIntentId || !cartId) {
      return NextResponse.json(
        { ok: false, message: 'Missing payment intent ID or cart ID' },
        { status: 400 }
      );
    }

    console.log('[ORDER CREATION] Processing payment intent:', {
      paymentIntentId,
      cartId,
    });

    // Handle demo mode
    if (paymentIntentId.startsWith('demo-')) {
      return await createDemoOrder(cartId);
    }

    // Retrieve payment intent from Stripe
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    console.log('[ORDER CREATION] Payment intent status:', {
      id: paymentIntent.id,
      status: paymentIntent.status,
      amount: paymentIntent.amount,
    });

    // Verify payment succeeded
    if (paymentIntent.status !== 'succeeded') {
      return NextResponse.json(
        { 
          ok: false, 
          message: `Payment not completed. Status: ${paymentIntent.status}` 
        },
        { status: 400 }
      );
    }

    // Check for existing order (idempotency)
    const { data: existingOrder } = await supabase
      .from('orders')
      .select('*')
      .eq('payment_intent_id', paymentIntentId)
      .single();

    if (existingOrder) {
      console.log('[ORDER CREATION] Order already exists:', existingOrder.id);
      return NextResponse.json({
        ok: true,
        order: existingOrder,
        message: 'Order already exists',
      });
    }

    // Extract order data from payment intent metadata
    const {
      venue_id,
      table_number,
      customer_name,
      customer_phone,
      item_count,
      items_summary,
      total_amount,
    } = paymentIntent.metadata;

    if (!venue_id || !table_number || !customer_name) {
      return NextResponse.json(
        { 
          ok: false, 
          message: 'Missing order data in payment intent metadata' 
        },
        { status: 400 }
      );
    }

    // Create order structure with items from payment intent metadata
    const orderAmount = paymentIntent.amount_received || paymentIntent.amount;
    
    const orderData = {
      id: uuidv4(),
      venue_id,
      table_number: parseInt(table_number),
      customer_name,
      customer_phone: customer_phone || null,
      total_amount: orderAmount,
      order_status: 'PLACED',
      payment_status: 'PAID',
      payment_intent_id: paymentIntentId,
      payment_method: paymentIntent.payment_method_types?.[0] || 'card',
      items: [
        // Create a summary item from the metadata
        {
          menu_item_id: null,
          quantity: 1,
          price: orderAmount,
          item_name: items_summary || `Order for ${customer_name}`,
          specialInstructions: null,
        }
      ],
      notes: `Order created from payment intent ${paymentIntentId}. Items: ${items_summary || 'N/A'}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    console.log('[ORDER CREATION] Creating order:', {
      id: orderData.id,
      venue_id: orderData.venue_id,
      table_number: orderData.table_number,
      total_amount: orderData.total_amount,
    });

    // Create order in database
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert(orderData)
      .select()
      .single();

    if (orderError) {
      console.error('[ORDER CREATION] Database error:', orderError);
      return NextResponse.json(
        { 
          ok: false, 
          message: `Failed to create order: ${orderError.message}` 
        },
        { status: 500 }
      );
    }

    console.log('[ORDER CREATION] Order created successfully:', {
      id: order.id,
      order_number: order.id,
    });

    // Publish realtime event for live orders
    try {
      await supabase
        .channel('orders')
        .send({
          type: 'broadcast',
          event: 'order_created',
          payload: {
            order: {
              ...order,
              order_number: order.id,
            },
            venue_id: venue_id,
          },
        });
      console.log('[ORDER CREATION] Realtime event published');
    } catch (realtimeError) {
      console.error('[ORDER CREATION] Failed to publish realtime event:', realtimeError);
      // Don't fail the order creation if realtime fails
    }

    return NextResponse.json({
      ok: true,
      order: {
        ...order,
        order_number: order.id, // Use ID as order number for now
      },
    });

  } catch (error) {
    console.error('[ORDER CREATION] Error:', error);
    
    if (error instanceof Stripe.errors.StripeError) {
      return NextResponse.json(
        { 
          ok: false, 
          message: `Stripe error: ${error.message}` 
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { 
        ok: false, 
        message: 'Internal server error' 
      },
      { status: 500 }
    );
  }
}

async function createDemoOrder(cartId: string) {
  try {
    console.log('[DEMO ORDER] Creating demo order for cart:', cartId);

    // Create a demo order
    const demoOrderData = {
      id: uuidv4(),
      venue_id: 'demo-cafe',
      table_number: 1,
      customer_name: 'Demo Customer',
      customer_phone: '+1234567890',
      total_amount: 2800, // £28.00 in pence
      order_status: 'PLACED',
      payment_status: 'PAID',
      payment_intent_id: `demo-${cartId}`,
      payment_method: 'demo',
      items: [
        {
          menu_item_id: null,
          quantity: 1,
          price: 1200,
          item_name: 'Demo Item 1',
          specialInstructions: null,
        },
        {
          menu_item_id: null,
          quantity: 2,
          price: 800,
          item_name: 'Demo Item 2',
          specialInstructions: null,
        },
      ],
      notes: `Demo order created from cart ${cartId}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert(demoOrderData)
      .select()
      .single();

    if (orderError) {
      console.error('[DEMO ORDER] Database error:', orderError);
      return NextResponse.json(
        { 
          ok: false, 
          message: `Failed to create demo order: ${orderError.message}` 
        },
        { status: 500 }
      );
    }

    console.log('[DEMO ORDER] Demo order created successfully:', order.id);

    // Publish realtime event for live orders
    try {
      await supabase
        .channel('orders')
        .send({
          type: 'broadcast',
          event: 'order_created',
          payload: {
            order: {
              ...order,
              order_number: order.id,
            },
            venue_id: 'demo-cafe',
          },
        });
      console.log('[DEMO ORDER] Realtime event published');
    } catch (realtimeError) {
      console.error('[DEMO ORDER] Failed to publish realtime event:', realtimeError);
      // Don't fail the order creation if realtime fails
    }

    return NextResponse.json({
      ok: true,
      order: {
        ...order,
        order_number: order.id,
      },
    });

  } catch (error) {
    console.error('[DEMO ORDER] Error:', error);
    return NextResponse.json(
      { 
        ok: false, 
        message: 'Failed to create demo order' 
      },
      { status: 500 }
    );
  }
}
