import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAuthenticatedUser } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { 
      order_id, 
      payment_method, 
      payment_status, 
      stripe_session_id,
      stripe_payment_intent_id,
      amount 
    } = body;

    if (!order_id || !payment_method || !payment_status) {
      return NextResponse.json({ error: 'order_id, payment_method, and payment_status are required' }, { status: 400 });
    }

    const { user } = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const supabase = await createClient();

    // Get the order to check venue ownership
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('venue_id, payment_mode, total_amount')
      .eq('id', order_id)
      .single();

    if (orderError) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // Check venue ownership
    const { data: venue } = await supabase
      .from('venues')
      .select('venue_id')
      .eq('venue_id', order.venue_id)
      .eq('owner_user_id', user.id)
      .maybeSingle();

    if (!venue) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Validate payment based on payment mode
    if (order.payment_mode === 'online' && payment_status === 'PAID' && !stripe_session_id) {
      return NextResponse.json({ error: 'Online payments require stripe_session_id' }, { status: 400 });
    }

    // Update order payment status
    const updateData: any = { 
      payment_status,
      payment_method 
    };

    if (stripe_session_id) {
      updateData.stripe_session_id = stripe_session_id;
    }

    if (stripe_payment_intent_id) {
      updateData.stripe_payment_intent_id = stripe_payment_intent_id;
    }

    const { data: updatedOrder, error: updateError } = await supabase
      .from('orders')
      .update(updateData)
      .eq('id', order_id)
      .select()
      .single();

    if (updateError) {
      logger.error('[POS PAYMENTS] Error:', updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ order: updatedOrder });
  } catch (error) {
    logger.error('[POS PAYMENTS] Unexpected error:', { error: error instanceof Error ? error.message : 'Unknown error' });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const venueId = searchParams.get('venue_id');
    const paymentStatus = searchParams.get('payment_status');
    const paymentMode = searchParams.get('payment_mode');

    if (!venueId) {
      return NextResponse.json({ error: 'venue_id is required' }, { status: 400 });
    }

    const { user } = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const supabase = await createClient();

    // Check venue ownership
    const { data: venue } = await supabase
      .from('venues')
      .select('venue_id')
      .eq('venue_id', venueId)
      .eq('owner_user_id', user.id)
      .maybeSingle();

    if (!venue) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    let query = supabase
      .from('orders')
      .select(`
        id,
        table_number,
        table_id,
        source,
        customer_name,
        payment_status,
        payment_mode,
        total_amount,
        created_at,
        tables!left (
          label
        )
      `)
      .eq('venue_id', venueId)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (paymentStatus) {
      query = query.eq('payment_status', paymentStatus);
    }

    if (paymentMode) {
      query = query.eq('payment_mode', paymentMode);
    }

    const { data: orders, error } = await query;

    if (error) {
      logger.error('[POS PAYMENTS] Error:', { error: error instanceof Error ? error.message : 'Unknown error' });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ orders });
  } catch (error) {
    logger.error('[POS PAYMENTS] Unexpected error:', { error: error instanceof Error ? error.message : 'Unknown error' });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
