import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const supabase = await createClient();

    // Test the dashboard_counts function directly
    const { data: counts, error: countsError } = await supabase
      .rpc('dashboard_counts', { 
        p_venue_id: 'venue-1e02af4d', 
        p_tz: 'Europe/London', 
        p_live_window_mins: 30 
      })
      .single();

    if (countsError) {
      return NextResponse.json({ 
        ok: false, 
        error: countsError.message,
        details: countsError 
      });
    }

    // Get current time info
    const now = new Date();
    const londonTime = new Date(now.toLocaleString("en-US", {timeZone: "Europe/London"}));
    
    // Test the time window calculation
    const todayStart = new Date(londonTime);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);

    // Get some sample orders to see what dates they have
    const { data: recentOrders, error: ordersError } = await supabase
      .from('orders')
      .select('id, created_at, payment_status, order_status')
      .eq('venue_id', 'venue-1e02af4d')
      .eq('payment_status', 'PAID')
      .order('created_at', { ascending: false })
      .limit(10);

    return NextResponse.json({
      ok: true,
      timestamp: now.toISOString(),
      londonTime: londonTime.toISOString(),
      todayStart: todayStart.toISOString(),
      todayEnd: todayEnd.toISOString(),
      dashboardCounts: counts,
      recentOrders: recentOrders?.map(order => ({
        id: order.id,
        created_at: order.created_at,
        date: new Date(order.created_at).toISOString().split('T')[0],
        payment_status: order.payment_status,
        order_status: order.order_status
      })),
      ordersError: ordersError?.message
    });

  } catch (error: any) {
    return NextResponse.json({ 
      ok: false, 
      error: error.message,
      stack: error.stack 
    });
  }
}
