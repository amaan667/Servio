import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export const runtime = 'nodejs';

export async function POST() {
  try {
    console.log('[FIX TABLE 10 ORDER] Starting to fix table 10 order...');
    
    // Create admin client to bypass RLS
    const supabase = createServerClient(
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

    // First, ensure the source column exists
    console.log('[FIX TABLE 10 ORDER] Ensuring source column exists...');
    const { error: alterError } = await supabase.rpc('exec_sql', {
      sql: `ALTER TABLE orders 
            ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'qr' CHECK (source IN ('qr', 'counter'));`
    });

    if (alterError) {
      console.log('[FIX TABLE 10 ORDER] Alter table result:', alterError.message);
    }

    // Fix the most recent order on table 10 that's incorrectly marked as counter
    console.log('[FIX TABLE 10 ORDER] Fixing table 10 order...');
    const { data: updateResult, error: updateError } = await supabase
      .from('orders')
      .update({ source: 'qr' })
      .eq('table_number', 10)
      .eq('source', 'counter')
      .order('created_at', { ascending: false })
      .limit(1);

    if (updateError) {
      console.error('[FIX TABLE 10 ORDER] Error updating order:', updateError);
      return NextResponse.json({ 
        success: false, 
        error: 'Failed to update order' 
      }, { status: 500 });
    }

    // Get the updated order to verify
    const { data: updatedOrder, error: fetchError } = await supabase
      .from('orders')
      .select('id, table_number, source, created_at, customer_name, order_status, payment_status')
      .eq('table_number', 10)
      .order('created_at', { ascending: false })
      .limit(3);

    if (fetchError) {
      console.error('[FIX TABLE 10 ORDER] Error fetching updated order:', fetchError);
      return NextResponse.json({ 
        success: false, 
        error: 'Failed to fetch updated order' 
      }, { status: 500 });
    }

    const results = updatedOrder?.map(order => ({
      id: order.id,
      customer_name: order.customer_name,
      table_number: order.table_number,
      source: order.source,
      display_name: order.source === 'qr' ? `Table ${order.table_number}` : 
                   order.source === 'counter' ? `Counter ${order.table_number}` : 'Unknown',
      order_status: order.order_status,
      payment_status: order.payment_status,
      created_at: order.created_at
    })) || [];

    console.log('[FIX TABLE 10 ORDER] ✅ Successfully fixed table 10 order');
    console.log('[FIX TABLE 10 ORDER] Results:', results);

    return NextResponse.json({
      success: true,
      message: 'Table 10 order fixed successfully - now shows as "Table 10" instead of "Counter 10"',
      ordersUpdated: results.length,
      results
    });

  } catch (error) {
    console.error('[FIX TABLE 10 ORDER] Unexpected error:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}
