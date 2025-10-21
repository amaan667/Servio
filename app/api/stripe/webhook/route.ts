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
  
  apiLogger.debug('[STRIPE WEBHOOK DEBUG] ===== WEBHOOK RECEIVED =====');
  apiLogger.debug('[STRIPE WEBHOOK DEBUG] Timestamp:', new Date().toISOString());
  apiLogger.debug('[STRIPE WEBHOOK DEBUG] Request headers:', Object.fromEntries(req.headers.entries()));
  
  const sig = req.headers.get('stripe-signature');
  if (!sig) {
    apiLogger.error('[STRIPE WEBHOOK DEBUG] Missing stripe-signature header');
    return new NextResponse('Missing stripe-signature', { status: 400 });
  }

  apiLogger.debug('[STRIPE WEBHOOK DEBUG] Stripe signature found:', sig.substring(0, 20) + '...');

  // IMPORTANT: read raw text for Stripe verification
  const raw = await req.text();
  apiLogger.debug('[STRIPE WEBHOOK DEBUG] Raw payload length:', { length: raw.length });
  apiLogger.debug('[STRIPE WEBHOOK DEBUG] Raw payload preview:', { preview: raw.substring(0, 200) });

  let event: Stripe.Event;
  try {
    apiLogger.debug('[STRIPE WEBHOOK DEBUG] Constructing Stripe event...');
    event = stripe.webhooks.constructEvent(raw, sig, process.env.STRIPE_WEBHOOK_SECRET!);
    apiLogger.debug('[STRIPE WEBHOOK DEBUG] Event constructed successfully');
    apiLogger.debug('[STRIPE WEBHOOK DEBUG] Event type:', event.type);
    apiLogger.debug('[STRIPE WEBHOOK DEBUG] Event ID:', event.id);
  } catch (err: any) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    apiLogger.error('[STRIPE WEBHOOK DEBUG] Webhook construction error:', errorMessage);
    return new NextResponse(`Webhook Error: ${errorMessage}`, { status: 400 });
  }

  if (event.type !== 'checkout.session.completed') {
    apiLogger.debug('[STRIPE WEBHOOK DEBUG] Ignoring event type:', event.type);
    return NextResponse.json({ ok: true, ignored: true });
  }

  const session = event.data.object as Stripe.Checkout.Session;

  // Get the original order ID from metadata
  const originalOrderId = session.metadata?.orderId;
  
  apiLogger.debug('[STRIPE WEBHOOK DEBUG] ===== SESSION PROCESSING =====');
  apiLogger.debug('[STRIPE WEBHOOK DEBUG] Processing checkout session:', { sessionId: session.id });
  apiLogger.debug('[STRIPE WEBHOOK DEBUG] Session metadata:', { metadata: JSON.stringify(session.metadata, null, 2) });
  apiLogger.debug('[STRIPE WEBHOOK DEBUG] Original order ID from metadata:', { value: originalOrderId });
  apiLogger.debug('[STRIPE WEBHOOK DEBUG] Session payment status:', { status: session.payment_status });
  apiLogger.debug('[STRIPE WEBHOOK DEBUG] Session customer details:', { customer: session.customer_details });
  apiLogger.debug('[STRIPE WEBHOOK DEBUG] Session amount total:', { amount: session.amount_total });
  apiLogger.debug('[STRIPE WEBHOOK DEBUG] Session currency:', { currency: session.currency });
  
  if (!originalOrderId) {
    apiLogger.error('[WEBHOOK] No orderId in session metadata');
    return NextResponse.json({ ok: false, error: 'No orderId in session metadata' }, { status: 400 });
  }

  // Check if we already processed this session
  const { data: existing } = await supabaseAdmin
    .from('orders')
    .select('id, stripe_session_id, payment_status')
    .eq('stripe_session_id', session.id)
    .maybeSingle();
  if (existing) {
    apiLogger.debug('[WEBHOOK] Session already processed for order:', existing.id);
    return NextResponse.json({ ok: true, already: true });
  }

  // Verify the original order exists
  apiLogger.debug('[STRIPE WEBHOOK DEBUG] ===== ORDER LOOKUP =====');
  apiLogger.debug('[STRIPE WEBHOOK DEBUG] Looking for order with ID:', { value: originalOrderId });
  
  const { data: originalOrder, error: fetchError } = await supabaseAdmin
    .from('orders')
    .select('id, payment_status, customer_name, table_number, created_at, venue_id, order_status')
    .eq('id', originalOrderId)
    .single();

  apiLogger.debug('[STRIPE WEBHOOK DEBUG] Order lookup result:', { found: !!originalOrder });
  apiLogger.debug('[STRIPE WEBHOOK DEBUG] - Fetch error:', { error: fetchError });
  apiLogger.debug('[STRIPE WEBHOOK DEBUG] - Order data:', { order: originalOrder });

  if (fetchError || !originalOrder) {
    apiLogger.error('[STRIPE WEBHOOK DEBUG] ===== ORDER NOT FOUND =====');
    apiLogger.error('[STRIPE WEBHOOK DEBUG] Original order not found:', { value: originalOrderId });
    apiLogger.error('[STRIPE WEBHOOK DEBUG] Fetch error details:', { value: fetchError });
    
    // Fallback: Look for recent orders that might match this session
    apiLogger.debug('[WEBHOOK] Trying to find order by recent timestamp...');
    const recentTime = new Date(Date.now() - 10 * 60 * 1000).toISOString(); // Last 10 minutes
    const { data: recentOrders } = await supabaseAdmin
      .from('orders')
      .select('id, payment_status, customer_name, table_number, created_at')
      .eq('payment_status', 'UNPAID')
      .gte('created_at', recentTime)
      .order('created_at', { ascending: false })
      .limit(5);
    
    if (recentOrders && recentOrders.length > 0) {
      apiLogger.debug('[WEBHOOK] Found recent unpaid orders:', recentOrders.map(o => o.id));
      // Use the most recent unpaid order
      const fallbackOrder = recentOrders[0];
      
      if (!fallbackOrder) {
        return NextResponse.json({ ok: false, error: 'No fallback order available' }, { status: 404 });
      }
      
      apiLogger.debug('[WEBHOOK] Using fallback order:', fallbackOrder.id);
      
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
        apiLogger.error('[WEBHOOK] Fallback order update failed:', { value: updateErr });
        return NextResponse.json({ ok: false, error: updateErr.message }, { status: 500 });
      }

      apiLogger.debug('[WEBHOOK] Successfully updated fallback order', fallbackOrder.id);
      return NextResponse.json({ ok: true, orderId: fallbackOrder.id, fallback: true });
    }
    
    return NextResponse.json({ ok: false, error: 'Original order not found and no fallback available' }, { status: 404 });
  }

  apiLogger.debug('[STRIPE WEBHOOK DEBUG] ===== ORDER FOUND - PROCEEDING WITH UPDATE =====');
  apiLogger.debug('[STRIPE WEBHOOK DEBUG] Found original order:', {
    id: originalOrder.id,
    customer: originalOrder.customer_name,
    table: originalOrder.table_number,
    venue_id: originalOrder.venue_id,
    order_status: originalOrder.order_status,
    current_payment_status: originalOrder.payment_status,
    created_at: originalOrder.created_at
  });

  // Update the existing order with payment information
  apiLogger.debug('[STRIPE WEBHOOK DEBUG] ===== UPDATING ORDER =====');
  apiLogger.debug('[STRIPE WEBHOOK DEBUG] Update payload:', {
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

  apiLogger.debug('[STRIPE WEBHOOK DEBUG] Update result:', { successful: !updateErr });
  apiLogger.debug('[STRIPE WEBHOOK DEBUG] - Update error:', { error: updateErr });

  if (updateErr) {
    apiLogger.error('[STRIPE WEBHOOK DEBUG] ===== UPDATE FAILED =====');
    apiLogger.error('[STRIPE WEBHOOK DEBUG] Order update failed:', { value: updateErr });
    apiLogger.error('[STRIPE WEBHOOK DEBUG] Error details:', JSON.stringify(updateErr, null, 2));
    return NextResponse.json({ ok: false, error: updateErr.message }, { status: 500 });
  }

  apiLogger.debug('[STRIPE WEBHOOK DEBUG] ===== UPDATE SUCCESSFUL =====');
  apiLogger.debug('[STRIPE WEBHOOK DEBUG] Successfully updated order with payment status PAID', { orderId: originalOrderId });
  apiLogger.debug('[STRIPE WEBHOOK DEBUG] Final response', { ok: true, orderId: originalOrderId });

  return NextResponse.json({ ok: true, orderId: originalOrderId });
}