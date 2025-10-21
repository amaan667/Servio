import { NextResponse } from 'next/server';
export const runtime = 'nodejs';
import { createClient } from '@/lib/supabase';
import { createAdminClient } from '@/lib/supabase';
import { apiLogger as logger } from '@/lib/logger';

export async function POST(req: Request) {
  try {
    const startedAt = new Date().toISOString();
    logger.debug('[ORDERS SERVE][START]', { startedAt });

    const { orderId } = await req.json();
    logger.debug('[ORDERS SERVE] Incoming request body', { orderId });
    
    if (!orderId) {
      return NextResponse.json({ error: 'Order ID is required' }, { status: 400 });
    }

    const supabase = await createClient();
    const supabaseAdmin = createAdminClient();
    logger.debug('[ORDERS SERVE] Supabase client created');

    // Require authenticated user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      logger.error('[ORDERS SERVE] Auth error or missing user', { userError });
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    logger.debug('[ORDERS SERVE] Authenticated user', { userId: user.id });
    
    // First get the order details before updating
    const { data: orderData, error: fetchError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single();

    if (fetchError) {
      logger.error('[ORDERS SERVE] Failed to fetch order', { error: { orderId, context: fetchError } });
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }
    if (!orderData) {
      logger.error('[ORDERS SERVE] Order not found', { orderId });
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }
    logger.debug('[ORDERS SERVE] Loaded order', { data: { orderId: orderData.id, extra: venueId: orderData.venue_id, order_status: orderData.order_status } });

    // Only allow serving orders that are READY (case-insensitive)
    const currentStatus = (orderData.order_status || '').toString().toUpperCase();
    if (currentStatus !== 'READY') {
      logger.warn('[ORDERS SERVE] Refusing serve due to status', { orderId, currentStatus });
      return NextResponse.json({ 
        error: 'Order must be READY to mark as SERVED' 
      }, { status: 400 });
    }

    // Ensure the caller owns the venue for this order (RLS-friendly)
    const venueId = orderData.venue_id as string;
    if (!venueId) {
      return NextResponse.json({ error: 'Order missing venue_id' }, { status: 400 });
    }

    // Check access via ownership OR user_venue_roles membership
    const [{ data: venue, error: venueError }, { data: role, error: roleError }] = await Promise.all([
      supabase
        .from('venues')
        .select('venue_id')
        .eq('venue_id', venueId)
        .eq('owner_user_id', user.id)
        .maybeSingle(),
      supabase
        .from('user_venue_roles')
        .select('role')
        .eq('venue_id', venueId)
        .eq('user_id', user.id)
        .maybeSingle()
    ]);

    if (venueError) {
      logger.error('[ORDERS SERVE] Venue check error', { error: { venueId, context: userId: user.id, venueError } });
    }
    if (roleError) {
      logger.error('[ORDERS SERVE] Role check error', { error: { venueId, context: userId: user.id, roleError } });
    }

    const hasAccess = Boolean(venue) || Boolean(role);
    if (!hasAccess) {
      logger.warn('[ORDERS SERVE] Forbidden: user lacks venue access (not owner or staff)', { venueId, userId: user.id });
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    logger.debug('[ORDERS SERVE] Access granted via', { data: { owner: Boolean(venue), extra: role: role?.role || null } });

    // Update the order status to SERVING (guard by venue_id for RLS)
    // Use admin client to bypass RLS for the atomic order update; we already authorized above
    const admin = createAdminClient();
    const { error } = await admin
      .from('orders')
      .update({ 
        order_status: 'SERVING',
        served_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', orderId)
      .eq('venue_id', venueId);

    if (error) {
      logger.error('[ORDERS SERVE] Failed to update order status', { error: { orderId, context: venueId, error } });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    logger.debug('[ORDERS SERVE] Order updated to SERVING', { data: { orderId, extra: venueId } });

    // Also update table_sessions if present (best-effort)
    try {
      await admin
        .from('table_sessions')
        .update({ 
          status: 'SERVED',
          updated_at: new Date().toISOString(),
        })
        .eq('order_id', orderId)
        .eq('venue_id', venueId);
      logger.debug('[ORDERS SERVE] table_sessions updated to SERVED', { data: { orderId, extra: venueId } });
    } catch (e) {
      // best-effort; don't fail the request if this errors (RLS or not found)
      logger.warn('[ORDERS SERVE] table_sessions update warning', { orderId, venueId, error: e });
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Order marked as served'
    });

  } catch (error: any) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('[ORDERS SERVE][UNCAUGHT]', { error: { error: err.message, context: stack: err.stack } });
    return NextResponse.json({ 
      error: 'Internal server error',
      details: err.message 
    }, { status: 500 });
  }
}
