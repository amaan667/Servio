import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { getAuthenticatedUser } from '@/lib/supabase';
import { logger } from '@/lib/logger';

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { order_id, order_status, payment_status } = body;

    if (!order_id || !order_status) {
      return NextResponse.json({ error: 'order_id and order_status are required' }, { status: 400 });
    }

    const { user } = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const supabase = await createClient();

    // Get the order to check venue ownership
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('venue_id')
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

    // Update order status
    const updateData: unknown = { order_status };
    if (payment_status) {
      updateData.payment_status = payment_status;
    }

    const { data: updatedOrder, error: updateError } = await supabase
      .from('orders')
      .update(updateData)
      .eq('id', order_id)
      .select()
      .single();

    if (updateError) {
      logger.error('[POS ORDERS STATUS] Error:', updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ order: updatedOrder });
  } catch (error) {
    logger.error('[POS ORDERS STATUS] Unexpected error:', { error: error instanceof Error ? error.message : 'Unknown error' });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
