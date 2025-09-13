import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export const runtime = 'nodejs';

// GET /api/match-orders - Find orders matching screenshot details
export async function GET(req: Request) {
  try {
    console.log('[MATCH ORDERS] Starting order matching...');
    
    // Create admin client to bypass RLS
    const adminSupabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        cookies: {
          get(name: string) { return undefined; },
          set(name: string, value: string, options: any) { },
          remove(name: string, options: any) { },
        },
      }
    );
    
    if (!adminSupabase) {
      console.error('[MATCH ORDERS] Failed to create admin client');
      return NextResponse.json({ ok: false, error: 'Failed to create admin client' }, { status: 500 });
    }

    const venueId = 'venue-1e02af4d';
    const results: any = {
      venue_id: venueId,
      matches: {}
    };

    // Look for Hamza's £133.50 order
    console.log('[MATCH ORDERS] Looking for Hamza order...');
    try {
      const { data: hamzaOrders, error: hamzaError } = await adminSupabase
        .from('orders')
        .select('id, table_number, table_id, source, customer_name, order_status, payment_status, total_amount, created_at, items')
        .eq('venue_id', venueId)
        .ilike('customer_name', '%hamza%')
        .order('created_at', { ascending: false })
        .limit(5);
      
      results.matches.hamza_orders = {
        found: !hamzaError && hamzaOrders && hamzaOrders.length > 0,
        error: hamzaError?.message,
        count: hamzaOrders?.length || 0,
        orders: hamzaOrders || []
      };

      // Also search by amount 13350 (£133.50 in pence)
      const { data: amount133Orders, error: amount133Error } = await adminSupabase
        .from('orders')
        .select('id, table_number, table_id, source, customer_name, order_status, payment_status, total_amount, created_at, items')
        .eq('venue_id', venueId)
        .eq('total_amount', 13350)
        .order('created_at', { ascending: false })
        .limit(5);

      results.matches.amount_133_50_orders = {
        found: !amount133Error && amount133Orders && amount133Orders.length > 0,
        error: amount133Error?.message,
        count: amount133Orders?.length || 0,
        orders: amount133Orders || []
      };

    } catch (e: any) {
      results.matches.hamza_orders = { found: false, error: e.message };
    }

    // Look for Donald's £47.70 order with Baba Ghanoush
    console.log('[MATCH ORDERS] Looking for Donald order...');
    try {
      const { data: donaldOrders, error: donaldError } = await adminSupabase
        .from('orders')
        .select('id, table_number, table_id, source, customer_name, order_status, payment_status, total_amount, created_at, items')
        .eq('venue_id', venueId)
        .ilike('customer_name', '%donald%')
        .order('created_at', { ascending: false })
        .limit(5);
      
      results.matches.donald_orders = {
        found: !donaldError && donaldOrders && donaldOrders.length > 0,
        error: donaldError?.message,
        count: donaldOrders?.length || 0,
        orders: donaldOrders || []
      };

      // Also search by amount 4770 (£47.70 in pence)
      const { data: amount47Orders, error: amount47Error } = await adminSupabase
        .from('orders')
        .select('id, table_number, table_id, source, customer_name, order_status, payment_status, total_amount, created_at, items')
        .eq('venue_id', venueId)
        .eq('total_amount', 4770)
        .order('created_at', { ascending: false })
        .limit(5);

      results.matches.amount_47_70_orders = {
        found: !amount47Error && amount47Orders && amount47Orders.length > 0,
        error: amount47Error?.message,
        count: amount47Orders?.length || 0,
        orders: amount47Orders || []
      };

    } catch (e: any) {
      results.matches.donald_orders = { found: false, error: e.message };
    }

    // Look for orders containing "Baba Ghanoush" in items
    console.log('[MATCH ORDERS] Looking for Baba Ghanoush orders...');
    try {
      const { data: babaOrders, error: babaError } = await adminSupabase
        .from('orders')
        .select('id, table_number, table_id, source, customer_name, order_status, payment_status, total_amount, created_at, items')
        .eq('venue_id', venueId)
        .order('created_at', { ascending: false })
        .limit(20); // Get more orders to search through items

      const babaGhanoushOrders = babaOrders?.filter(order => {
        if (!order.items || !Array.isArray(order.items)) return false;
        return order.items.some((item: any) => 
          item.item_name && item.item_name.toLowerCase().includes('baba ghanoush')
        );
      }) || [];

      results.matches.baba_ghanoush_orders = {
        found: babaGhanoushOrders.length > 0,
        error: babaError?.message,
        count: babaGhanoushOrders.length,
        orders: babaGhanoushOrders
      };

    } catch (e: any) {
      results.matches.baba_ghanoush_orders = { found: false, error: e.message };
    }

    // Get recent orders from table 1 and table 9 for comparison
    console.log('[MATCH ORDERS] Checking table 1 and 9 orders...');
    try {
      const { data: table1Orders, error: table1Error } = await adminSupabase
        .from('orders')
        .select('id, table_number, table_id, source, customer_name, order_status, payment_status, total_amount, created_at, items')
        .eq('venue_id', venueId)
        .eq('table_number', 1)
        .order('created_at', { ascending: false })
        .limit(5);

      const { data: table9Orders, error: table9Error } = await adminSupabase
        .from('orders')
        .select('id, table_number, table_id, source, customer_name, order_status, payment_status, total_amount, created_at, items')
        .eq('venue_id', venueId)
        .eq('table_number', 9)
        .order('created_at', { ascending: false })
        .limit(5);

      results.matches.table_1_orders = {
        found: !table1Error && table1Orders && table1Orders.length > 0,
        error: table1Error?.message,
        count: table1Orders?.length || 0,
        orders: table1Orders || []
      };

      results.matches.table_9_orders = {
        found: !table9Error && table9Orders && table9Orders.length > 0,
        error: table9Error?.message,
        count: table9Orders?.length || 0,
        orders: table9Orders || []
      };

    } catch (e: any) {
      results.matches.table_comparison = { found: false, error: e.message };
    }

    console.log('[MATCH ORDERS] Order matching completed');
    return NextResponse.json({
      ok: true,
      results
    });

  } catch (error) {
    console.error('[MATCH ORDERS] Unexpected error:', error);
    return NextResponse.json({ ok: false, error: 'Internal server error' }, { status: 500 });
  }
}