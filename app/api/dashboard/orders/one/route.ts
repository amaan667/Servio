export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { todayWindowForTZ } from '@/lib/time';
import { liveOrdersWindow, earlierTodayWindow, historyWindow } from '@/lib/dates';
import { cookieAdapter } from '@/lib/server/supabase';

type OrderRow = {
  id: string;
  venue_id: string;
  table_number: number | null;
  customer_name: string | null;
  items: any[];                    // jsonb[]
  total_amount: number;
  created_at: string;              // timestamptz
  order_status: 'pending' | 'preparing' | 'served' | 'delivered' | 'cancelled';
  payment_status: 'paid' | 'unpaid' | null;
};

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const venueId = url.searchParams.get('venueId');
    // scope: 'live' (last 30 minutes) | 'earlier' (today but more than 30 min ago) | 'history' (yesterday and earlier)
    const scope = (url.searchParams.get('scope') || 'live') as 'live' | 'earlier' | 'history';

    if (!venueId) {
      return NextResponse.json({ ok: false, error: 'venueId required' }, { status: 400 });
    }

    // SSR supabase client (uses user cookies for RLS)
    const jar = cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: cookieAdapter(jar) }
    );

    // Use default timezone since venues table doesn't have timezone column
    const { startUtcISO, endUtcISO, zone } = todayWindowForTZ('Europe/London');

    // base query: always sort by created_at DESC  ✅ (Requirement #2)
    let q = supabase
      .from('orders')
      .select(
        'id, venue_id, table_number, customer_name, items, total_amount, created_at, order_status, payment_status'
      )
      .eq('venue_id', venueId)
      .eq('payment_status', 'PAID') // Only show paid orders
      .order('created_at', { ascending: false });

    if (scope === 'live') {
      // Live orders: last 30 minutes only
      const timeWindow = liveOrdersWindow();
      q = q.gte('created_at', timeWindow.startUtcISO);
    } else if (scope === 'earlier') {
      // Earlier today: orders from today but more than 30 minutes ago
      const timeWindow = earlierTodayWindow('Europe/London');
      console.log('[DEBUG] Earlier today filtering:', {
        scope,
        timezone: 'Europe/London',
        timeWindow,
        startUtcISO: timeWindow.startUtcISO,
        endUtcISO: timeWindow.endUtcISO
      });
      q = q.gte('created_at', timeWindow.startUtcISO).lt('created_at', timeWindow.endUtcISO);
    } else if (scope === 'history') {
      // History: orders from yesterday and earlier
      const timeWindow = historyWindow('Europe/London');
      q = q.lt('created_at', timeWindow.endUtcISO).limit(500);
    }

    const { data, error } = await q;
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    // Detailed logging for Railway deployment monitoring
    console.log('[TAB_FILTERING] ===== TAB SELECTION DEBUG =====');
    console.log('[TAB_FILTERING] Tab:', scope.toUpperCase());
    console.log('[TAB_FILTERING] Venue ID:', venueId);
    console.log('[TAB_FILTERING] Venue Timezone:', 'Europe/London');
    console.log('[TAB_FILTERING] Order Count:', data?.length || 0);
    
    if (data && data.length > 0) {
      console.log('[TAB_FILTERING] Sample Orders (first 3):');
      data.slice(0, 3).forEach((order, index) => {
        const orderDate = new Date(order.created_at);
        const ageMinutes = Math.round((Date.now() - orderDate.getTime()) / (1000 * 60));
        console.log(`[TAB_FILTERING]   Order ${index + 1}: ID=${order.id}, Created=${order.created_at}, Age=${ageMinutes}min, Status=${order.order_status}`);
      });
      
      // Age distribution analysis
      const ageDistribution = data.reduce((acc, order) => {
        const orderDate = new Date(order.created_at);
        const ageMinutes = Math.round((Date.now() - orderDate.getTime()) / (1000 * 60));
        if (ageMinutes < 30) acc['<30min'] = (acc['<30min'] || 0) + 1;
        else if (ageMinutes < 60) acc['30-60min'] = (acc['30-60min'] || 0) + 1;
        else if (ageMinutes < 1440) acc['1-24hrs'] = (acc['1-24hrs'] || 0) + 1;
        else acc['>24hrs'] = (acc['>24hrs'] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      console.log('[TAB_FILTERING] Age Distribution:', ageDistribution);
      
      // Status distribution
      const statusDistribution = data.reduce((acc, order) => {
        acc[order.order_status] = (acc[order.order_status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      console.log('[TAB_FILTERING] Status Distribution:', statusDistribution);
    } else {
      console.log('[TAB_FILTERING] No orders found for this tab');
    }
    console.log('[TAB_FILTERING] ===== END TAB DEBUG =====');

    return NextResponse.json({
      ok: true,
      meta: { scope, zone, startUtcISO, endUtcISO, count: data?.length ?? 0 },
      orders: (data || []) as OrderRow[],
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}