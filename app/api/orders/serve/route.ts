import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(req: Request) {
  try {
    const startedAt = new Date().toISOString();
    console.log('[ORDERS SERVE][START]', { startedAt });

    const { orderId } = await req.json();
    console.log('[ORDERS SERVE] Incoming request body', { orderId });
    
    if (!orderId) {
      return NextResponse.json({ error: 'Order ID is required' }, { status: 400 });
    }

    const supabase = await createClient();
    console.log('[ORDERS SERVE] Supabase client created');

    // Require authenticated user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      console.error('[ORDERS SERVE] Auth error or missing user', { userError });
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    console.log('[ORDERS SERVE] Authenticated user', { userId: user.id });
    
    // First get the order details before updating
    const { data: orderData, error: fetchError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single();

    if (fetchError) {
      console.error('[ORDERS SERVE] Failed to fetch order', { orderId, fetchError });
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }
    if (!orderData) {
      console.error('[ORDERS SERVE] Order not found', { orderId });
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }
    console.log('[ORDERS SERVE] Loaded order', { orderId: orderData.id, venueId: orderData.venue_id, order_status: orderData.order_status });

    // Only allow serving orders that are READY (case-insensitive)
    const currentStatus = (orderData.order_status || '').toString().toUpperCase();
    if (currentStatus !== 'READY') {
      console.warn('[ORDERS SERVE] Refusing serve due to status', { orderId, currentStatus });
      return NextResponse.json({ 
        error: 'Order must be READY to mark as SERVED' 
      }, { status: 400 });
    }

    // Ensure the caller owns the venue for this order (RLS-friendly)
    const venueId = orderData.venue_id as string;
    if (!venueId) {
      return NextResponse.json({ error: 'Order missing venue_id' }, { status: 400 });
    }

    const { data: venue, error: venueError } = await supabase
      .from('venues')
      .select('venue_id')
      .eq('venue_id', venueId)
      .eq('owner_user_id', user.id)
      .maybeSingle();

    if (venueError) {
      console.error('[ORDERS SERVE] Venue check error', { venueId, userId: user.id, venueError });
      return NextResponse.json({ error: 'Failed to verify venue ownership' }, { status: 500 });
    }
    if (!venue) {
      console.warn('[ORDERS SERVE] Forbidden: user does not own venue', { venueId, userId: user.id });
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.log('[ORDERS SERVE] Venue ownership verified', { venueId, userId: user.id });

    // Update the order status to SERVED (guard by venue_id for RLS)
    const { error } = await supabase
      .from('orders')
      .update({ 
        order_status: 'SERVED',
        served_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', orderId)
      .eq('venue_id', venueId);

    if (error) {
      console.error('[ORDERS SERVE] Failed to update order status', { orderId, venueId, error });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    console.log('[ORDERS SERVE] Order updated to SERVED', { orderId, venueId });

    // Also update table_sessions if present (best-effort)
    try {
      await supabase
        .from('table_sessions')
        .update({ 
          status: 'SERVED',
          updated_at: new Date().toISOString(),
        })
        .eq('order_id', orderId)
        .eq('venue_id', venueId);
      console.log('[ORDERS SERVE] table_sessions updated to SERVED', { orderId, venueId });
    } catch (e) {
      // best-effort; don't fail the request if this errors (RLS or not found)
      console.warn('[ORDERS SERVE] table_sessions update warning', { orderId, venueId, error: e });
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Order marked as served'
    });

  } catch (error: any) {
    console.error('[ORDERS SERVE][UNCAUGHT]', { error: error?.message || error, stack: error?.stack });
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error.message 
    }, { status: 500 });
  }
}
