import { NextResponse } from 'next/server';
import { createClient, getAuthenticatedUser } from '@/lib/supabase/server';
import { liveOrdersWindow, earlierTodayWindow, historyWindow } from '@/lib/dates';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const venueId = searchParams.get('venueId');
  const status = searchParams.get('status') || 'all';
  const limit = parseInt(searchParams.get('limit') || '50');
  const scope = searchParams.get('scope') || 'live';

  if (!venueId) {
    return NextResponse.json({ ok: false, error: 'venueId required' }, { status: 400 });
  }

  const { user } = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
  }
  
  const supabase = await createClient();

  // Check venue ownership
  const { data: venue } = await supabase
    .from('venues')
    .select('venue_id')
    .eq('venue_id', venueId)
    .eq('owner_id', user.id)
    .maybeSingle();

  if (!venue) {
    return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
  }

  let query = supabase
    .from('orders')
    .select(`
      id, venue_id, table_number, customer_name, customer_phone, 
      total_amount, status, payment_status, notes, created_at, items
    `)
    .eq('venue_id', venueId)
    .in('payment_status', ['PAID', 'UNPAID']) // Show both paid and unpaid orders
    .order('created_at', { ascending: false })
    .limit(limit);

  // Apply status filter
  if (status !== 'all') {
    query = query.eq('status', status);
  }

  // Apply date scope filter
  if (scope === 'live') {
    // Live orders: last 30 minutes only
    const timeWindow = liveOrdersWindow();
    query = query.gte('created_at', timeWindow.startUtcISO);
  } else if (scope === 'earlier') {
    // Earlier today: orders from today but more than 30 minutes ago
    const timeWindow = earlierTodayWindow();
    query = query.gte('created_at', timeWindow.startUtcISO).lt('created_at', timeWindow.endUtcISO);
  } else if (scope === 'history') {
    // History: orders from yesterday and earlier
    const timeWindow = historyWindow();
    query = query.lt('created_at', timeWindow.endUtcISO);
  }

  const { data: orders, error } = await query;

  if (error) {
    console.error('[DASHBOARD ORDERS] Error:', error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  // Detailed logging for Railway deployment monitoring
  console.log('[DASHBOARD_ORDERS] ===== DASHBOARD ORDERS DEBUG =====');
  console.log('[DASHBOARD_ORDERS] Scope:', scope.toUpperCase());
  console.log('[DASHBOARD_ORDERS] Venue ID:', venueId);
  console.log('[DASHBOARD_ORDERS] Status Filter:', status);
  console.log('[DASHBOARD_ORDERS] Limit:', limit);
  console.log('[DASHBOARD_ORDERS] Order Count:', orders?.length || 0);
  
  if (orders && orders.length > 0) {
    console.log('[DASHBOARD_ORDERS] Sample Orders (first 3):');
    orders.slice(0, 3).forEach((order, index) => {
      const orderDate = new Date(order.created_at);
      const ageMinutes = Math.round((Date.now() - orderDate.getTime()) / (1000 * 60));
      console.log(`[DASHBOARD_ORDERS]   Order ${index + 1}: ID=${order.id}, Created=${order.created_at}, Age=${ageMinutes}min, Status=${order.status}, Table=${order.table_number}`);
    });
    
    // Age distribution analysis
    const ageDistribution = orders.reduce((acc, order) => {
      const orderDate = new Date(order.created_at);
      const ageMinutes = Math.round((Date.now() - orderDate.getTime()) / (1000 * 60));
      if (ageMinutes < 30) acc['<30min'] = (acc['<30min'] || 0) + 1;
      else if (ageMinutes < 60) acc['30-60min'] = (acc['30-60min'] || 0) + 1;
      else if (ageMinutes < 1440) acc['1-24hrs'] = (acc['1-24hrs'] || 0) + 1;
      else acc['>24hrs'] = (acc['>24hrs'] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    console.log('[DASHBOARD_ORDERS] Age Distribution:', ageDistribution);
    
    // Status distribution
    const statusDistribution = orders.reduce((acc, order) => {
      acc[order.status] = (acc[order.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    console.log('[DASHBOARD_ORDERS] Status Distribution:', statusDistribution);
  } else {
    console.log('[DASHBOARD_ORDERS] No orders found for this scope');
  }
  console.log('[DASHBOARD_ORDERS] ===== END DASHBOARD ORDERS DEBUG =====');

  // Get active tables count based on scope
  let activeTablesQuery = supabase
    .from('orders')
    .select('table_number')
    .eq('venue_id', venueId)
    .not('table_number', 'is', null);

  if (scope === 'live') {
    const timeWindow = liveOrdersWindow();
    activeTablesQuery = activeTablesQuery.gte('created_at', timeWindow.startUtcISO);
  } else if (scope === 'earlier') {
    const timeWindow = earlierTodayWindow();
    activeTablesQuery = activeTablesQuery.gte('created_at', timeWindow.startUtcISO).lt('created_at', timeWindow.endUtcISO);
  } else if (scope === 'history') {
    const timeWindow = historyWindow();
    activeTablesQuery = activeTablesQuery.lt('created_at', timeWindow.endUtcISO);
  }

  const { data: activeTables } = await activeTablesQuery;

  const activeTablesToday = new Set(activeTables?.map((o: any) => o.table_number) || []).size;

  return NextResponse.json({
    ok: true,
    orders: orders || [],
    meta: {
      activeTablesToday,
      total: orders?.length || 0
    }
  });
}