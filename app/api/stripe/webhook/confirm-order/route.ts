import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { ENV } from '@/lib/env';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const { sessionId } = await req.json();
    if (!sessionId) {
      return NextResponse.json({ ok: false, error: 'sessionId required' }, { status: 400 });
    }

    const stripe = new Stripe(ENV.STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' });
    const admin = createClient(ENV.SUPABASE_URL, ENV.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false }});

    // Get the session to verify payment was successful
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    
    if (session.payment_status !== 'paid') {
      return NextResponse.json({ ok: false, error: 'Payment not completed' }, { status: 400 });
    }

    // Extract order data from session metadata
    const orderData = JSON.parse(session.metadata?.orderData || '{}');
    
    if (!orderData.venue_id) {
      return NextResponse.json({ ok: false, error: 'Invalid order data' }, { status: 400 });
    }

    // Create the order in the database
    const orderPayload = {
      venue_id: orderData.venue_id,
      table_number: orderData.table_number,
      customer_name: orderData.customer_name,
      customer_phone: orderData.customer_phone,
      items: orderData.items,
      total_amount: orderData.total_amount,
      notes: orderData.notes,
      payment_status: 'paid',
      stripe_session_id: sessionId,
      stripe_payment_intent: session.payment_intent as string,
    };

    const { data: order, error } = await admin
      .from('orders')
      .insert(orderPayload)
      .select()
      .single();

    if (error) {
      console.error('Error creating order:', error);
      return NextResponse.json({ ok: false, error: 'Failed to create order' }, { status: 500 });
    }

    console.log('Order created after payment:', order);

    return NextResponse.json({ 
      ok: true, 
      orderId: order.id,
      message: 'Order confirmed successfully' 
    });

  } catch (error: any) {
    console.error('Error confirming order:', error);
    return NextResponse.json({ 
      ok: false, 
      error: error.message || 'Failed to confirm order' 
    }, { status: 500 });
  }
}
