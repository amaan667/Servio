import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const venueId = searchParams.get('venueId');

    if (!venueId) {
      return NextResponse.json({ error: 'venueId required' }, { status: 400 });
    }

    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        cookies: {
          get(name: string) { return cookieStore.get(name)?.value; },
          set(name: string, value: string, options: any) { },
          remove(name: string, options: any) { },
        },
      }
    );

    console.log('[DEBUG TABLE COUNTS] Fetching data for venue:', venueId);

    // 1. Get actual tables from database
    const { data: actualTables, error: tablesError } = await supabase
      .from('tables')
      .select('*')
      .eq('venue_id', venueId);

    // 2. Get orders with table numbers
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('id, table_number, customer_name, payment_status, order_status, created_at')
      .eq('venue_id', venueId)
      .not('table_number', 'is', null)
      .order('created_at', { ascending: false });

    // 3. Get RPC function result
    const { data: rpcResult, error: rpcError } = await supabase.rpc('api_table_counters', {
      p_venue_id: venueId
    });

    // 4. Calculate virtual tables from orders
    const uniqueTableNumbers = orders ? [...new Set(orders.map(o => o.table_number).filter(Boolean))] : [];
    const occupiedTables = orders ? orders.filter(o => 
      o.payment_status === 'UNPAID' || 
      (o.payment_status === 'PAID' && ['PLACED', 'IN_PREP', 'READY'].includes(o.order_status))
    ) : [];
    const occupiedTableNumbers = [...new Set(occupiedTables.map(o => o.table_number))];

    const virtualTableCounts = {
      total_tables: uniqueTableNumbers.length,
      available: uniqueTableNumbers.length - occupiedTableNumbers.length,
      occupied: occupiedTableNumbers.length,
      reserved_now: 0,
      reserved_later: 0,
      unassigned_reservations: 0,
      block_window_mins: 0
    };

    return NextResponse.json({
      venueId,
      actualTables: {
        data: actualTables,
        count: actualTables?.length || 0,
        error: tablesError?.message
      },
      orders: {
        data: orders,
        count: orders?.length || 0,
        uniqueTableNumbers,
        occupiedTableNumbers,
        error: ordersError?.message
      },
      rpcResult: {
        data: rpcResult,
        error: rpcError?.message
      },
      virtualTableCounts,
      summary: {
        actualTablesCount: actualTables?.length || 0,
        ordersWithTablesCount: orders?.length || 0,
        uniqueTableNumbersCount: uniqueTableNumbers.length,
        rpcTotalTables: Array.isArray(rpcResult) ? rpcResult[0]?.total_tables : rpcResult?.total_tables,
        virtualTotalTables: virtualTableCounts.total_tables
      }
    });

  } catch (error: any) {
    console.error('[DEBUG TABLE COUNTS] Error:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error.message 
    }, { status: 500 });
  }
}
