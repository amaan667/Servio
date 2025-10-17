import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const supabaseAdmin = createAdminClient();
    console.log('[KDS STATUS] Checking KDS system status...');
    
    // Check if KDS tables exist
    const { data: tables, error: tablesError } = await supabaseAdmin
      .from('information_schema.tables')
      .select('table_name')
      .in('table_name', ['kds_stations', 'kds_tickets', 'kds_station_categories'])
      .eq('table_schema', 'public');

    if (tablesError) {
      console.error('[KDS STATUS] Error checking tables:', tablesError);
      return NextResponse.json({ 
        error: 'Failed to check KDS tables',
        details: tablesError.message 
      }, { status: 500 });
    }

    const tableNames = tables?.map(t => t.table_name) || [];
    console.log('[KDS STATUS] Found KDS tables:', tableNames);

    // Check if there are any KDS stations
    let stationsCount = 0;
    let ticketsCount = 0;
    
    if (tableNames.includes('kds_stations')) {
      const { count: stationsCountResult } = await supabaseAdmin
        .from('kds_stations')
        .select('*', { count: 'exact', head: true });
      stationsCount = stationsCountResult || 0;
    }

    if (tableNames.includes('kds_tickets')) {
      const { count: ticketsCountResult } = await supabaseAdmin
        .from('kds_tickets')
        .select('*', { count: 'exact', head: true });
      ticketsCount = ticketsCountResult || 0;
    }

    // Check recent orders to see if any should have KDS tickets
    const { data: recentOrders, error: ordersError } = await supabaseAdmin
      .from('orders')
      .select('id, customer_name, table_number, order_status, payment_status, created_at')
      .eq('order_status', 'PLACED')
      .gte('created_at', new Date(Date.now() - 10 * 60 * 1000).toISOString()) // Last 10 minutes
      .order('created_at', { ascending: false })
      .limit(5);

    if (ordersError) {
      console.error('[KDS STATUS] Error checking recent orders:', ordersError);
    }

    const status = {
      kds_tables_exist: tableNames.length === 3,
      tables_found: tableNames,
      stations_count: stationsCount,
      tickets_count: ticketsCount,
      recent_orders: recentOrders || [],
      system_ready: tableNames.length === 3 && stationsCount > 0
    };

    console.log('[KDS STATUS] System status:', status);

    return NextResponse.json({ 
      ok: true,
      status 
    });

  } catch (error) {
    console.error('[KDS STATUS] Error:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
