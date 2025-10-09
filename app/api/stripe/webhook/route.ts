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

  // Get the original order ID from metadata
  const originalOrderId = session.metadata?.orderId;
  
  console.log('[WEBHOOK] Processing checkout session:', session.id);
  console.log('[WEBHOOK] Session metadata:', session.metadata);
  console.log('[WEBHOOK] Original order ID:', originalOrderId);
  
  if (!originalOrderId) {
    console.error('[WEBHOOK] No orderId in session metadata');
    return NextResponse.json({ ok: false, error: 'No orderId in session metadata' }, { status: 400 });
  }

  // Check if we already processed this session
  const { data: existing } = await supabaseAdmin
    .from('orders')
    .select('id, stripe_session_id, payment_status')
    .eq('stripe_session_id', session.id)
    .maybeSingle();
  if (existing) {
    console.log('[WEBHOOK] Session already processed for order:', existing.id);
    return NextResponse.json({ ok: true, already: true });
  }

  // Verify the original order exists
  const { data: originalOrder, error: fetchError } = await supabaseAdmin
    .from('orders')
    .select('id, payment_status, customer_name, table_number')
    .eq('id', originalOrderId)
    .single();

  if (fetchError || !originalOrder) {
    console.error('[WEBHOOK] Original order not found:', originalOrderId, fetchError);
    return NextResponse.json({ ok: false, error: 'Original order not found' }, { status: 404 });
  }

  console.log('[WEBHOOK] Found original order:', {
    id: originalOrder.id,
    customer: originalOrder.customer_name,
    table: originalOrder.table_number,
    current_payment_status: originalOrder.payment_status
  });

  // Update the existing order with payment information
  const { error: updateErr } = await supabaseAdmin
    .from('orders')
    .update({
      payment_status: 'PAID',
      payment_method: 'stripe',
      stripe_session_id: session.id,
      stripe_payment_intent_id: String(session.payment_intent ?? ''),
      notes: `Stripe payment completed - Session: ${session.id}`
    })
    .eq('id', originalOrderId);

  if (updateErr) {
    console.error('[WEBHOOK] order update failed', updateErr);
    return NextResponse.json({ ok: false, error: updateErr.message }, { status: 500 });
  }

  console.log('[WEBHOOK] Successfully updated order', originalOrderId, 'with payment status PAID');

  return NextResponse.json({ ok: true, orderId: originalOrderId });
}