import { NextResponse } from 'next/server';
import { createClient, getAuthenticatedUser } from '@/lib/supabase/server';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const { orderId, status } = await req.json();
    
    if (!orderId || !status) {
      return NextResponse.json({ ok: false, error: 'orderId and status required' }, { status: 400 });
    }

    const { user } = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
    
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('orders')
      .update({ order_status: status })
      .eq('id', orderId)
      .select();

    if (error) {
      console.error('[UPDATE STATUS] Error:', error);
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    // Handle table state transitions when order is completed or cancelled
    if (status === 'COMPLETED' || status === 'CANCELLED') {
      const order = data?.[0];
      if (order && order.table_id) {
        console.log('[UPDATE STATUS] Order completed/cancelled, checking if table should be set to FREE');
        
        // Check if there are any other active orders for this table
        const { data: activeOrders, error: activeOrdersError } = await supabase
          .from('orders')
          .select('id')
          .eq('table_id', order.table_id)
          .in('order_status', ['PLACED', 'ACCEPTED', 'IN_PREP', 'READY', 'SERVING'])
          .neq('id', orderId);

        if (activeOrdersError) {
          console.error('[UPDATE STATUS] Error checking active orders:', activeOrdersError);
        } else if (!activeOrders || activeOrders.length === 0) {
          // No other active orders for this table, set it back to FREE
          console.log('[UPDATE STATUS] No other active orders for table, setting to FREE');
          
          const { error: tableUpdateError } = await supabase
            .from('table_sessions')
            .update({ 
              status: 'FREE',
              order_id: null,
              closed_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
            .eq('table_id', order.table_id)
            .is('closed_at', null);

          if (tableUpdateError) {
            console.error('[UPDATE STATUS] Error updating table to FREE:', tableUpdateError);
          } else {
            console.log('[UPDATE STATUS] Successfully set table to FREE');
          }
        } else {
          console.log('[UPDATE STATUS] Other active orders exist for table, keeping OCCUPIED');
        }
      }
    }

    return NextResponse.json({ ok: true, order: data?.[0] });
  } catch (error) {
    console.error('[UPDATE STATUS] Unexpected error:', error);
    return NextResponse.json({ ok: false, error: 'Internal server error' }, { status: 500 });
  }
}


