import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import Stripe from 'stripe';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2025-08-27.basil' });

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get('sessionId');
  if (!sessionId) return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 });

  // Poll briefly for the webhook-created order
  const started = Date.now();
  while (Date.now() - started < 6000) {
    const { data: order } = await supabaseAdmin
      .from('orders')
      .select('*')
      .eq('stripe_session_id', sessionId)
      .maybeSingle();

    if (order) return NextResponse.json({ order });

    await new Promise(r => setTimeout(r, 500));
  }

  // Rescue path: if webhook is late but session is paid, create/upsert now
  const session = await stripe.checkout.sessions.retrieve(sessionId);
  if (session.payment_status === 'paid') {
    const items = (() => {
      try { return JSON.parse(session.metadata?.items ?? '[]'); } catch { return []; }
    })();

    const payload = {
      venue_id: session.metadata?.venueId ?? 'venue-1e02af4d',
      table_number: Number(session.metadata?.tableNumber ?? session.metadata?.table ?? 0) || null,
      customer_name: session.customer_details?.name ?? session.metadata?.customerName ?? null,
      customer_phone: session.customer_details?.phone ?? session.metadata?.customerPhone ?? null,
      items,
      total_amount: (session.amount_total ?? 0) / 100,
      order_status: 'PLACED',
      payment_status: 'PAID',
      payment_method: 'stripe',
      payment_mode: 'online',
      source: session.metadata?.source ?? 'qr',
      stripe_session_id: session.id,
      stripe_payment_intent_id: String(session.payment_intent ?? ''),
    };

    const { data, error } = await supabaseAdmin
      .from('orders')
      .upsert(payload, { onConflict: 'stripe_session_id' }) // requires unique index
      .select('*')
      .maybeSingle();

    if (data) return NextResponse.json({ order: data, recovered: true });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ error: 'Order not ready' }, { status: 404 });
}
