import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export const runtime = 'nodejs';

export async function POST() {
  try {
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

    console.log('[FIX COUNTER 10 ORDERS] Starting to fix counter 10 orders...');

    // Update orders placed on counter 10 to have source='counter'
    const { data: updateResult, error: updateError } = await supabase
      .from('orders')
      .update({ source: 'counter' })
      .eq('table_number', 10)
      .eq('source', 'qr')
      .gte('created_at', '2025-09-10');

    if (updateError) {
      console.error('[FIX COUNTER 10 ORDERS] Error updating orders:', updateError);
      return NextResponse.json({ 
        success: false, 
        error: 'Failed to update orders' 
      }, { status: 500 });
    }

    // Get the updated orders to verify
    const { data: updatedOrders, error: fetchError } = await supabase
      .from('orders')
      .select('id, table_number, source, created_at, customer_name, order_status, payment_status')
      .eq('table_number', 10)
      .order('created_at', { ascending: false })
      .limit(10);

    if (fetchError) {
      console.error('[FIX COUNTER 10 ORDERS] Error fetching updated orders:', fetchError);
      return NextResponse.json({ 
        success: false, 
        error: 'Failed to fetch updated orders' 
      }, { status: 500 });
    }

    console.log('[FIX COUNTER 10 ORDERS] Successfully updated counter 10 orders');
    console.log('[FIX COUNTER 10 ORDERS] Updated orders:', updatedOrders);

    return NextResponse.json({
      success: true,
      message: 'Counter 10 orders fixed successfully',
      ordersUpdated: updatedOrders?.length || 0,
      updatedOrders: updatedOrders
    });

  } catch (error) {
    console.error('[FIX COUNTER 10 ORDERS] Unexpected error:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}
