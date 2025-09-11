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
      if (order && order.table_number && order.source === 'qr') {
        console.log('[UPDATE STATUS] Order completed/cancelled, checking if table should be set to FREE');
        
        // Check if there are any other active orders for this table
        const { data: activeOrders, error: activeOrdersError } = await supabase
          .from('orders')
          .select('id')
          .eq('venue_id', order.venue_id)
          .eq('table_number', order.table_number)
          .eq('source', 'qr')
          .in('order_status', ['PLACED', 'ACCEPTED', 'IN_PREP', 'READY', 'SERVING'])
          .neq('id', orderId);

        if (activeOrdersError) {
          console.error('[UPDATE STATUS] Error checking active orders:', activeOrdersError);
        } else if (!activeOrders || activeOrders.length === 0) {
          // No other active orders for this table, set it back to FREE
          console.log('[UPDATE STATUS] No other active orders for table, setting to FREE');
          
          // Find the table by venue_id and table_number
          const { data: tableData, error: tableFindError } = await supabase
            .from('table_runtime_state')
            .select('id')
            .eq('venue_id', order.venue_id)
            .eq('label', `Table ${order.table_number}`)
            .single();

          if (tableFindError) {
            console.error('[UPDATE STATUS] Error finding table:', tableFindError);
          } else if (tableData) {
            const { error: tableUpdateError } = await supabase
              .from('table_sessions')
              .update({ 
                status: 'FREE',
                order_id: null,
                closed_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              })
              .eq('table_id', tableData.id)
              .is('closed_at', null);

            if (tableUpdateError) {
              console.error('[UPDATE STATUS] Error updating table to FREE:', tableUpdateError);
            } else {
              console.log('[UPDATE STATUS] Successfully set table to FREE');
            }
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


