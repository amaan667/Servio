import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { ENV } from '@/lib/env';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const sig = req.headers.get('stripe-signature');
  if (!sig) return NextResponse.json({ ok:false, error:'Missing signature' }, { status:400 });

  const raw = await req.text();
  const stripe = new Stripe(ENV.STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' });
  let evt: Stripe.Event;
  try {
    evt = stripe.webhooks.constructEvent(raw, sig, ENV.STRIPE_WEBHOOK_SECRET);
  } catch (e:any) {
    return NextResponse.json({ ok:false, error:`Signature verification failed: ${e.message}` }, { status:400 });
  }

  const admin = createClient(ENV.SUPABASE_URL, ENV.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession:false }});

  if (evt.type === 'checkout.session.completed') {
    const session = evt.data.object as Stripe.Checkout.Session;
    const sessionId = session.id;
    // Find order by stripe_session_id
    const { data: order, error } = await admin
      .from('orders')
      .select('id')
      .eq('stripe_session_id', sessionId)
      .maybeSingle();
    if (!error && order) {
      await admin.from('orders').update({ payment_status: 'paid', paid_at: new Date().toISOString() }).eq('id', order.id);
    }
  }

  return NextResponse.json({ received: true });
}


