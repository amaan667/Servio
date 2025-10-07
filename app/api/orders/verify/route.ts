import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { 
  apiVersion: "2025-08-27.basil"
});

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get('sessionId');
    
    console.log('[VERIFY] Starting verification for session:', sessionId);

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID is required' }, { status: 400 });
    }

    // Retrieve the Stripe session
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    console.log('[VERIFY] Stripe session retrieved:', {
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
    
    console.log('[VERIFY] Order ID from metadata:', orderId);

    if (!orderId) {
      return NextResponse.json({ 
        error: 'No order ID in session metadata' 
      }, { status: 400 });
    }

    // Fetch the existing order (should have been created in order page)
    console.log('[VERIFY] Fetching existing order:', orderId);
    
    const supabase = await createClient();
    
    const { data: order, error: fetchError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single();

    if (fetchError || !order) {
      console.error('[VERIFY] Failed to fetch order:', fetchError);
      return NextResponse.json({ 
        error: 'Order not found. The order may not have been created properly.',
        details: fetchError?.message 
      }, { status: 404 });
    }

    // Update payment status to PAID
    console.log('[VERIFY] Updating order payment status to PAID for order:', orderId);
    
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
      console.error('[VERIFY] Failed to update payment status:', updateError);
      return NextResponse.json({ 
        error: 'Failed to update order payment status',
        details: updateError.message 
      }, { status: 500 });
    }

    console.log('[VERIFY] Payment status updated successfully for order:', orderId);

    return NextResponse.json({ 
      order: updatedOrder,
      updated: true 
    });

  } catch (error) {
    console.error('[VERIFY] Error:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
