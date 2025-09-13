import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

// GET /api/debug-orders?venueId=xxx - Debug orders and table assignments
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const venueId = searchParams.get('venue_id') || searchParams.get('venueId') || 'venue-1e02af4d';

    console.log('[DEBUG ORDERS] Starting debug for venue:', venueId);
    
    const adminSupabase = createAdminClient();
    
    if (!adminSupabase) {
      console.error('[DEBUG ORDERS] Failed to create admin client');
      return NextResponse.json({ ok: false, error: 'Failed to create admin client' }, { status: 500 });
    }

    const debug: any = {
      venue_id: venueId,
      checks: {}
    };

    // Check recent orders
    try {
      const { data: orders, error: ordersError } = await adminSupabase
        .from('orders')
        .select('id, table_number, table_id, source, customer_name, order_status, payment_status, total_amount, created_at')
        .eq('venue_id', venueId)
        .order('created_at', { ascending: false })
        .limit(10);
      
      debug.checks.recent_orders = {
        exists: !ordersError,
        error: ordersError?.message,
        count: orders?.length || 0,
        orders: orders || []
      };
    } catch (e: any) {
      debug.checks.recent_orders = { exists: false, error: e.message };
    }

    // Check orders with table_number = 9
    try {
      const { data: counter9Orders, error: counter9Error } = await adminSupabase
        .from('orders')
        .select('id, table_number, table_id, source, customer_name, order_status, payment_status, total_amount, created_at')
        .eq('venue_id', venueId)
        .eq('table_number', 9)
        .order('created_at', { ascending: false })
        .limit(5);
      
      debug.checks.counter_9_orders = {
        exists: !counter9Error,
        error: counter9Error?.message,
        count: counter9Orders?.length || 0,
        orders: counter9Orders || []
      };
    } catch (e: any) {
      debug.checks.counter_9_orders = { exists: false, error: e.message };
    }

    // Check orders with table_number = 1
    try {
      const { data: table1Orders, error: table1Error } = await adminSupabase
        .from('orders')
        .select('id, table_number, table_id, source, customer_name, order_status, payment_status, total_amount, created_at')
        .eq('venue_id', venueId)
        .eq('table_number', 1)
        .order('created_at', { ascending: false })
        .limit(5);
      
      debug.checks.table_1_orders = {
        exists: !table1Error,
        error: table1Error?.message,
        count: table1Orders?.length || 0,
        orders: table1Orders || []
      };
    } catch (e: any) {
      debug.checks.table_1_orders = { exists: false, error: e.message };
    }

    // Check available tables
    try {
      const { data: tables, error: tablesError } = await adminSupabase
        .from('table_runtime_state')
        .select('id, label, venue_id, primary_status, created_at')
        .eq('venue_id', venueId)
        .eq('is_active', true)
        .order('label');
      
      debug.checks.available_tables = {
        exists: !tablesError,
        error: tablesError?.message,
        count: tables?.length || 0,
        tables: tables || []
      };
    } catch (e: any) {
      debug.checks.available_tables = { exists: false, error: e.message };
    }

    return NextResponse.json({
      ok: true,
      debug
    });

  } catch (error) {
    console.error('[DEBUG ORDERS] Unexpected error:', error);
    return NextResponse.json({ ok: false, error: 'Internal server error' }, { status: 500 });
  }
}