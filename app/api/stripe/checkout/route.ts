import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { ENV } from '@/lib/env';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const { orderData, returnUrl } = await req.json();
    if (!orderData) return NextResponse.json({ ok:false, error:'orderData required' }, { status:400 });

    const stripe = new Stripe(ENV.STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' });
    const admin = createClient(ENV.SUPABASE_URL, ENV.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession:false }});

    const amount = Math.round(Number(orderData.total_amount) * 100) || 0;
    if (amount <= 0) return NextResponse.json({ ok:false, error:'Order total must be > 0' }, { status:400 });

    // Create a temporary session ID for this pending order
    const sessionId = `pending_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{
        price_data: {
          currency: 'gbp',
          product_data: { 
            name: `Order for ${orderData.customer_name}`,
            description: `${orderData.items.length} items - Table ${orderData.table_number}`
          },
          unit_amount: amount,
        },
        quantity: 1,
      }],
      success_url: `${ENV.APP_URL}/payment/success?sessionId=${sessionId}&returnUrl=${encodeURIComponent(returnUrl || ENV.APP_URL)}`,
      cancel_url: `${ENV.APP_URL}/payment/cancel?returnUrl=${encodeURIComponent(returnUrl || ENV.APP_URL)}`,
      metadata: { 
        sessionId,
        orderData: JSON.stringify(orderData),
        venueId: orderData.venue_id,
        tableNumber: orderData.table_number,
        customerName: orderData.customer_name
      },
    });

    return NextResponse.json({ ok:true, sessionId: session.id, url: session.url });
  } catch (e:any) {
    return NextResponse.json({ ok:false, error:e.message }, { status:500 });
  }
}


