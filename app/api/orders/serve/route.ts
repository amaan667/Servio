import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(req: Request) {
  try {
    const { orderId } = await req.json();
    
    if (!orderId) {
      return NextResponse.json({ error: 'Order ID is required' }, { status: 400 });
    }

    const supabase = await createClient();

    // Require authenticated user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    
    // First get the order details before updating
    const { data: orderData, error: fetchError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single();

    if (fetchError) {
      console.error('Failed to fetch order:', fetchError);
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    // Only allow serving orders that are READY (case-insensitive)
    const currentStatus = (orderData.order_status || '').toString().toUpperCase();
    if (currentStatus !== 'READY') {
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
      console.error('[SERVE] Venue check error:', venueError);
      return NextResponse.json({ error: 'Failed to verify venue ownership' }, { status: 500 });
    }
    if (!venue) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

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
      console.error('Failed to update order status:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

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
    } catch (e) {
      // best-effort; don't fail the request if this errors (RLS or not found)
      console.warn('[SERVE] table_sessions update warning:', e);
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Order marked as served' 
    });

  } catch (error: any) {
    console.error('Error in serve endpoint:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error.message 
    }, { status: 500 });
  }
}
