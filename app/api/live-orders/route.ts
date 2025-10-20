import { NextResponse } from 'next/server';
import { createClient, getAuthenticatedUser } from '@/lib/supabase';
import { cache } from '@/lib/cache';
import { apiLogger, logger } from '@/lib/logger';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const venueId = searchParams.get('venueId');

  if (!venueId) {
    return NextResponse.json({ ok: false, error: 'venueId required' }, { status: 400 });
  }

  const { user } = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
  }
  
  // Try to get from cache first (30 second TTL for live orders)
  const cacheKey = `live_orders:${venueId}`;
  const cachedOrders = await cache.get(cacheKey);
  
  if (cachedOrders) {
    logger.debug('[LIVE ORDERS] Cache hit for:', venueId);
    return NextResponse.json(cachedOrders);
  }
  
  logger.debug('[LIVE ORDERS] Cache miss for:', venueId);
  
  const supabase = await createClient();

  // Check venue ownership
  const { data: venue } = await supabase
    .from('venues')
    .select('venue_id')
    .eq('venue_id', venueId)
    .eq('owner_user_id', user.id)
    .maybeSingle();

  if (!venue) {
    return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
  }

  // Get live orders - show both paid and unpaid orders
  const { data: orders, error } = await supabase
    .from('orders')
    .select(`
      id, venue_id, table_number, table_id, customer_name, customer_phone, 
      total_amount, order_status, payment_status, notes, created_at, items, source,
      tables!left (
        id,
        label,
        area
      )
    `)
    .eq('venue_id', venueId)
    .in('payment_status', ['PAID', 'UNPAID']) // Show both paid and unpaid orders
    .in('order_status', ['PLACED', 'IN_PREP', 'READY'])
    .order('created_at', { ascending: false });

  if (error) {
    logger.error('[LIVE ORDERS] Error:', { error: error instanceof Error ? error.message : 'Unknown error' });
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  // Transform orders to include table_label
  const transformedOrders = orders?.map(order => ({
    ...order,
    table_label: (order.tables as any)?.label || (order.source === 'counter' ? `Counter ${order.table_number}` : `Table ${order.table_number}`)
  })) || [];

  const response = {
    ok: true,
    orders: transformedOrders
  };

  // Cache the response for 30 seconds (live orders change frequently)
  await cache.set(cacheKey, response, 30);

  return NextResponse.json(response);
}