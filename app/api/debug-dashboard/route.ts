import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAuthenticatedUser } from '@/lib/supabase/server';

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

  try {
    // Get dashboard counts using the RPC function
    const { data: counts, error: countsError } = await supabase
      .rpc('dashboard_counts', { 
        p_venue_id: venueId, 
        p_tz: 'Europe/London', 
        p_live_window_mins: 30 
      })
      .single();

    if (countsError) {
      console.error('Error fetching dashboard counts:', countsError);
      return NextResponse.json({ ok: false, error: countsError.message }, { status: 500 });
    }

    // Get detailed order breakdown by date
    const { data: ordersByDate, error: ordersError } = await supabase
      .from('orders')
      .select('id, created_at, payment_status, order_status')
      .eq('venue_id', venueId)
      .eq('payment_status', 'PAID')
      .order('created_at', { ascending: false })
      .limit(50);

    if (ordersError) {
      console.error('Error fetching orders:', ordersError);
      return NextResponse.json({ ok: false, error: ordersError.message }, { status: 500 });
    }

    // Group orders by date
    const ordersByDateMap = new Map();
    ordersByDate?.forEach(order => {
      const date = new Date(order.created_at).toISOString().split('T')[0];
      if (!ordersByDateMap.has(date)) {
        ordersByDateMap.set(date, []);
      }
      ordersByDateMap.get(date).push(order);
    });

    // Get current time info
    const now = new Date();
    const londonTime = new Date(now.toLocaleString("en-US", {timeZone: "Europe/London"}));
    const todayStart = new Date(londonTime);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);

    return NextResponse.json({
      ok: true,
      timestamp: now.toISOString(),
      londonTime: londonTime.toISOString(),
      todayStart: todayStart.toISOString(),
      todayEnd: todayEnd.toISOString(),
      dashboardCounts: counts,
      ordersByDate: Object.fromEntries(ordersByDateMap),
      totalOrders: ordersByDate?.length || 0
    });

  } catch (error: any) {
    console.error('Debug dashboard error:', error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
