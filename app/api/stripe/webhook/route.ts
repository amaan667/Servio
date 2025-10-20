import { errorToContext } from '@/lib/utils/error-to-context';
import Stripe from 'stripe';
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';
import { stripe } from '@/lib/stripe-client';
import { apiLogger } from '@/lib/logger';

export const runtime = 'nodejs';            // ensure Node runtime (not Edge)
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(req: Request) {
  const supabaseAdmin = createAdminClient();
  
  logger.debug('[STRIPE WEBHOOK DEBUG] ===== WEBHOOK RECEIVED =====');
  logger.debug('[STRIPE WEBHOOK DEBUG] Timestamp:', new Date().toISOString());
  logger.debug('[STRIPE WEBHOOK DEBUG] Request headers:', Object.fromEntries(req.headers.entries()));
  
  const sig = req.headers.get('stripe-signature');
  if (!sig) {
    logger.error('[STRIPE WEBHOOK DEBUG] Missing stripe-signature header');
    return new NextResponse('Missing stripe-signature', { status: 400 });
  }

  logger.debug('[STRIPE WEBHOOK DEBUG] Stripe signature found:', sig.substring(0, 20) + '...');

  // IMPORTANT: read raw text for Stripe verification
  const raw = await req.text();
  logger.debug('[STRIPE WEBHOOK DEBUG] Raw payload length:', raw.length);
  logger.debug('[STRIPE WEBHOOK DEBUG] Raw payload preview:', raw.substring(0, 200));

  let event: Stripe.Event;
  try {
    logger.debug('[STRIPE WEBHOOK DEBUG] Constructing Stripe event...');
    event = stripe.webhooks.constructEvent(raw, sig, process.env.STRIPE_WEBHOOK_SECRET!);
    logger.debug('[STRIPE WEBHOOK DEBUG] Event constructed successfully');
    logger.debug('[STRIPE WEBHOOK DEBUG] Event type:', event.type);
    logger.debug('[STRIPE WEBHOOK DEBUG] Event ID:', event.id);
  } catch (err: unknown) {
    logger.error('[STRIPE WEBHOOK DEBUG] Webhook construction error:', err.message);
    return new NextResponse(`Webhook Error: ${err.message}`, { status: 400 });
  }

  if (event.type !== 'checkout.session.completed') {
    logger.debug('[STRIPE WEBHOOK DEBUG] Ignoring event type:', event.type);
    return NextResponse.json({ ok: true, ignored: true });
  }

  const session = event.data.object as Stripe.Checkout.Session;

  // Get the original order ID from metadata
  const originalOrderId = session.metadata?.orderId;
  
  logger.debug('[STRIPE WEBHOOK DEBUG] ===== SESSION PROCESSING =====');
  logger.debug('[STRIPE WEBHOOK DEBUG] Processing checkout session:', session.id);
  logger.debug('[STRIPE WEBHOOK DEBUG] Session metadata:', JSON.stringify(session.metadata, null, 2));
  logger.debug('[STRIPE WEBHOOK DEBUG] Original order ID from metadata:', { value: originalOrderId });
  logger.debug('[STRIPE WEBHOOK DEBUG] Session payment status:', session.payment_status);
  logger.debug('[STRIPE WEBHOOK DEBUG] Session customer details:', session.customer_details);
  logger.debug('[STRIPE WEBHOOK DEBUG] Session amount total:', session.amount_total);
  logger.debug('[STRIPE WEBHOOK DEBUG] Session currency:', session.currency);
  
  if (!originalOrderId) {
    logger.error('[WEBHOOK] No orderId in session metadata');
    return NextResponse.json({ ok: false, error: 'No orderId in session metadata' }, { status: 400 });
  }

  // Check if we already processed this session
  const { data: existing } = await supabaseAdmin
    .from('orders')
    .select('id, stripe_session_id, payment_status')
    .eq('stripe_session_id', session.id)
    .maybeSingle();
  if (existing) {
    logger.debug('[WEBHOOK] Session already processed for order:', existing.id);
    return NextResponse.json({ ok: true, already: true });
  }

  // Verify the original order exists
  logger.debug('[STRIPE WEBHOOK DEBUG] ===== ORDER LOOKUP =====');
  logger.debug('[STRIPE WEBHOOK DEBUG] Looking for order with ID:', { value: originalOrderId });
  
  const { data: originalOrder, error: fetchError } = await supabaseAdmin
    .from('orders')
    .select('id, payment_status, customer_name, table_number, created_at, venue_id, order_status')
    .eq('id', originalOrderId)
    .single();

  logger.debug('[STRIPE WEBHOOK DEBUG] Order lookup result:');
  logger.debug('[STRIPE WEBHOOK DEBUG] - Found order:', !!originalOrder);
  logger.debug('[STRIPE WEBHOOK DEBUG] - Fetch error:', { value: fetchError });
  logger.debug('[STRIPE WEBHOOK DEBUG] - Order data:', { value: originalOrder });

  if (fetchError || !originalOrder) {
    logger.error('[STRIPE WEBHOOK DEBUG] ===== ORDER NOT FOUND =====');
    logger.error('[STRIPE WEBHOOK DEBUG] Original order not found:', { value: originalOrderId });
    logger.error('[STRIPE WEBHOOK DEBUG] Fetch error details:', { value: fetchError });
    
    // Fallback: Look for recent orders that might match this session
    logger.debug('[WEBHOOK] Trying to find order by recent timestamp...');
    const recentTime = new Date(Date.now() - 10 * 60 * 1000).toISOString(); // Last 10 minutes
    const { data: recentOrders, error: recentError } = await supabaseAdmin
      .from('orders')
      .select('id, payment_status, customer_name, table_number, created_at')
      .eq('payment_status', 'UNPAID')
      .gte('created_at', recentTime)
      .order('created_at', { ascending: false })
      .limit(5);
    
    if (recentOrders && recentOrders.length > 0) {
      logger.debug('[WEBHOOK] Found recent unpaid orders:', recentOrders.map(o => o.id));
      // Use the most recent unpaid order
      const fallbackOrder = recentOrders[0];
      logger.debug('[WEBHOOK] Using fallback order:', fallbackOrder.id);
      
      // Update the fallback order
      const { error: updateErr } = await supabaseAdmin
        .from('orders')
        .update({
          payment_status: 'PAID',
          payment_method: 'stripe',
          stripe_session_id: session.id,
          stripe_payment_intent_id: String(session.payment_intent ?? ''),
          notes: `Stripe payment completed - Session: ${session.id} (fallback)`
        })
        .eq('id', fallbackOrder.id);

      if (updateErr) {
        logger.error('[WEBHOOK] Fallback order update failed:', { value: updateErr });
        return NextResponse.json({ ok: false, error: updateErr.message }, { status: 500 });
      }

      logger.debug('[WEBHOOK] Successfully updated fallback order', fallbackOrder.id);
      return NextResponse.json({ ok: true, orderId: fallbackOrder.id, fallback: true });
    }
    
    return NextResponse.json({ ok: false, error: 'Original order not found and no fallback available' }, { status: 404 });
  }

  logger.debug('[STRIPE WEBHOOK DEBUG] ===== ORDER FOUND - PROCEEDING WITH UPDATE =====');
  logger.debug('[STRIPE WEBHOOK DEBUG] Found original order:', {
    id: originalOrder.id,
    customer: originalOrder.customer_name,
    table: originalOrder.table_number,
    venue_id: originalOrder.venue_id,
    order_status: originalOrder.order_status,
    current_payment_status: originalOrder.payment_status,
    created_at: originalOrder.created_at
  });

  // Update the existing order with payment information
  logger.debug('[STRIPE WEBHOOK DEBUG] ===== UPDATING ORDER =====');
  logger.debug('[STRIPE WEBHOOK DEBUG] Update payload:', {
    payment_status: 'PAID',
    payment_method: 'stripe',
    stripe_session_id: session.id,
    stripe_payment_intent_id: String(session.payment_intent ?? ''),
    notes: `Stripe payment completed - Session: ${session.id}`
  });
  
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

  logger.debug('[STRIPE WEBHOOK DEBUG] Update result:');
  logger.debug('[STRIPE WEBHOOK DEBUG] - Update error:', { value: updateErr });
  logger.debug('[STRIPE WEBHOOK DEBUG] - Update successful:', !updateErr);

  if (updateErr) {
    logger.error('[STRIPE WEBHOOK DEBUG] ===== UPDATE FAILED =====');
    logger.error('[STRIPE WEBHOOK DEBUG] Order update failed:', { value: updateErr });
    logger.error('[STRIPE WEBHOOK DEBUG] Error details:', JSON.stringify(updateErr, null, 2));
    return NextResponse.json({ ok: false, error: updateErr.message }, { status: 500 });
  }

  logger.debug('[STRIPE WEBHOOK DEBUG] ===== UPDATE SUCCESSFUL =====');
  logger.debug('[STRIPE WEBHOOK DEBUG] Successfully updated order', originalOrderId, 'with payment status PAID');
  logger.debug('[STRIPE WEBHOOK DEBUG] Final response: { ok: true, orderId:', originalOrderId, '}');

  return NextResponse.json({ ok: true, orderId: originalOrderId });
}