import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { ENV } from '@/lib/env';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const { orderId } = await req.json();
    if (!orderId) return NextResponse.json({ ok:false, error:'orderId required' }, { status:400 });

    const stripe = new Stripe(ENV.STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' });
    const admin = createClient(ENV.SUPABASE_URL, ENV.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession:false }});

    const { data: order, error } = await admin
      .from('orders')
      .select('id, venue_id, total_amount, items')
      .eq('id', orderId)
      .maybeSingle();
    if (error || !order) return NextResponse.json({ ok:false, error: error?.message || 'Order not found' }, { status:404 });

    const amount = Math.round(Number(order.total_amount) * 100) || 0;
    if (amount <= 0) return NextResponse.json({ ok:false, error:'Order total must be > 0' }, { status:400 });

    const shortId = String(order.id).slice(0,6);
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{
        price_data: {
          currency: 'gbp',
          product_data: { name: `Order #${shortId}` },
          unit_amount: amount,
        },
        quantity: 1,
      }],
      success_url: `${ENV.APP_URL}/payment/success?orderId=${order.id}`,
      cancel_url: `${ENV.APP_URL}/payment/cancel?orderId=${order.id}`,
      metadata: { orderId: order.id },
    });

    await admin.from('orders').update({ stripe_session_id: session.id }).eq('id', order.id);

    return NextResponse.json({ ok:true, sessionId: session.id, url: session.url });
  } catch (e:any) {
    return NextResponse.json({ ok:false, error:e.message }, { status:500 });
  }
}


