import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@/lib/supabase';
import { stripe } from '@/lib/stripe-client';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get('sessionId');
    
    logger.debug('[VERIFY] Starting verification for session:', { value: sessionId });

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID is required' }, { status: 400 });
    }

    // Retrieve the Stripe session
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    logger.debug('[VERIFY] Stripe session retrieved:', {
      id: session.id,
      paymentStatus: session.payment_status,
      metadata: session.metadata
    });

    if (session.payment_status !== 'paid') {
      return NextResponse.json({ 
        error: 'Payment not completed' 
      }, { status: 400 });
    }

    // Get metadata from session
    const metadata = session.metadata || {};
    const orderId = metadata.orderId;
    
    logger.debug('[VERIFY] Order ID from metadata:', { value: orderId });

    if (!orderId) {
      return NextResponse.json({ 
        error: 'No order ID in session metadata' 
      }, { status: 400 });
    }

    // Fetch the existing order (should have been created in order page)
    logger.debug('[VERIFY] Fetching existing order:', { value: orderId });
    
    const supabase = await createClient();
    
    const { data: order, error: fetchError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single();

    if (fetchError || !order) {
      logger.error('[VERIFY] Failed to fetch order:', { value: fetchError });
      return NextResponse.json({ 
        error: 'Order not found. The order may not have been created properly.',
        details: fetchError?.message 
      }, { status: 404 });
    }

    // Update payment status to PAID
    logger.debug('[VERIFY] Updating order payment status to PAID for order:', { value: orderId });
    
    const { data: updatedOrder, error: updateError } = await supabase
      .from('orders')
      .update({ 
        payment_status: 'PAID',
        payment_method: 'stripe',
        stripe_payment_intent_id: session.payment_intent as string
      })
      .eq('id', orderId)
      .select()
      .single();

    if (updateError) {
      logger.error('[VERIFY] Failed to update payment status:', { value: updateError });
      return NextResponse.json({ 
        error: 'Failed to update order payment status',
        details: updateError.message 
      }, { status: 500 });
    }

    logger.debug('[VERIFY] Payment status updated successfully for order:', { value: orderId });

    return NextResponse.json({ 
      order: updatedOrder,
      updated: true 
    });

  } catch (_error) {
    logger.error('[VERIFY] Error:', { error: error instanceof Error ? error.message : 'Unknown error' });
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
