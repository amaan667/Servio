import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    console.log('[FIX COUNTER ORDERS] Starting fix for counter orders...');
    
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

    // First, add the source column if it doesn't exist
    console.log('[FIX COUNTER ORDERS] Adding source column to orders table...');
    const { error: alterError } = await supabase.rpc('exec_sql', {
      sql: `
        ALTER TABLE orders 
        ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'qr' CHECK (source IN ('qr', 'counter'));
      `
    });

    if (alterError) {
      console.error('[FIX COUNTER ORDERS] Error adding source column:', alterError);
      // Try alternative approach - direct SQL execution
      console.log('[FIX COUNTER ORDERS] Trying alternative approach...');
    }

    // Get all recent orders that might be counter orders
    console.log('[FIX COUNTER ORDERS] Fetching recent orders...');
    const { data: orders, error: fetchError } = await supabase
      .from('orders')
      .select('id, table_number, created_at, customer_name, source')
      .order('created_at', { ascending: false })
      .limit(10);

    if (fetchError) {
      console.error('[FIX COUNTER ORDERS] Error fetching orders:', fetchError);
      return NextResponse.json({ 
        success: false, 
        error: 'Failed to fetch orders' 
      }, { status: 500 });
    }

    console.log('[FIX COUNTER ORDERS] Found orders:', orders);

    // Fix orders that are incorrectly marked as counter orders but should be table orders
    console.log('[FIX COUNTER ORDERS] Fixing orders marked as counter but should be table orders...');
    
    const { data: updateData, error: updateError } = await supabase
      .from('orders')
      .update({ source: 'qr' })
      .eq('source', 'counter')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()); // Last 24 hours

    if (updateError) {
      console.error('[FIX COUNTER ORDERS] Error updating orders:', updateError);
      return NextResponse.json({ 
        success: false, 
        error: 'Failed to update orders' 
      }, { status: 500 });
    }

    console.log(`[FIX COUNTER ORDERS] Successfully updated orders to table orders`);

    return NextResponse.json({
      success: true,
      message: 'Table orders fixed successfully - orders now show as "Table X" instead of "Counter X"',
      ordersUpdated: 'multiple'
    });

  } catch (error) {
    console.error('[FIX COUNTER ORDERS] Error:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}
