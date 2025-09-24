import Stripe from 'stripe';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';            // ensure Node runtime (not Edge)
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2025-08-27.basil' });

export async function POST(req: Request) {
  const sig = req.headers.get('stripe-signature');
  if (!sig) return new NextResponse('Missing stripe-signature', { status: 400 });

  // IMPORTANT: read raw text for Stripe verification
  const raw = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(raw, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err: any) {
    return new NextResponse(`Webhook Error: ${err.message}`, { status: 400 });
  }

  if (event.type !== 'checkout.session.completed') {
    return NextResponse.json({ ok: true, ignored: true });
  }

  const session = event.data.object as Stripe.Checkout.Session;

  // Idempotency: if already have this session, exit cleanly
  const { data: existing } = await supabaseAdmin
    .from('orders')
    .select('id')
    .eq('stripe_session_id', session.id)
    .maybeSingle();
  if (existing) return NextResponse.json({ ok: true, already: true });

  // Build payload from session (adapt fields to your schema)
  const items = (() => {
    try { return JSON.parse(session.metadata?.items ?? '[]'); } catch { return []; }
  })();

  const payload = {
    venue_id: session.metadata?.venueId ?? 'venue-1e02af4d',
    table_number: Number(session.metadata?.tableNumber ?? session.metadata?.table ?? 0) || null,
    customer_name: session.customer_details?.name ?? session.metadata?.customerName ?? null,
    customer_phone: session.customer_details?.phone ?? session.metadata?.customerPhone ?? null,
    items,                                // ensure column accepts jsonb[]
    total_amount: (session.amount_total ?? 0) / 100,
    order_status: 'PLACED',
    payment_status: 'PAID',
    payment_method: 'stripe',
    payment_mode: 'online',
    source: session.metadata?.source ?? 'qr',
    stripe_session_id: session.id,
    stripe_payment_intent_id: String(session.payment_intent ?? ''),
  };

  // Insert without .single() to avoid PGRST116 on 0 rows
  const { error: insertErr } = await supabaseAdmin.from('orders').insert(payload);
  if (insertErr) {
    console.error('[WEBHOOK] order insert failed', insertErr);
    return NextResponse.json({ ok: false, error: insertErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}