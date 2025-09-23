import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(req: Request) {
  try {
    const { orderId, status } = await req.json();
    
    if (!orderId || !status) {
      return NextResponse.json({ error: 'Order ID and status are required' }, { status: 400 });
    }

    // Validate status
    const validStatuses = ['IN_PREP', 'READY', 'SERVING', 'SERVED', 'COMPLETED', 'CANCELLED'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    const supabase = await createClient();
    
    // First get the order details before updating
    const { data: orderData, error: fetchError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single();

    if (fetchError) {
      console.error('Failed to fetch order:', fetchError);
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    // Update the order status
    const { error } = await supabase
      .from('orders')
      .update({ order_status: status })
      .eq('id', orderId);

    if (error) {
      console.error('Failed to set order status:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Handle table clearing when order is completed or cancelled
    if (status === 'COMPLETED' || status === 'CANCELLED') {
      const order = orderData;
      if (order && (order.table_id || order.table_number) && order.source === 'qr') {
        console.log('[TABLE CLEAR] Order completed/cancelled, checking if table should be cleared:', {
          orderId: orderId,
          tableId: order.table_id,
          tableNumber: order.table_number,
          venueId: order.venue_id,
          orderStatus: status
        });
        
        // Check if there are any other active orders for this table
        const { data: activeOrders, error: activeOrdersError } = await supabase
          .from('orders')
          .select('id, order_status, table_id, table_number')
          .eq('venue_id', order.venue_id)
          .in('order_status', ['PLACED', 'ACCEPTED', 'IN_PREP', 'READY', 'SERVING'])
          .neq('id', orderId);

        // Filter by table_id or table_number
        let filteredActiveOrders = activeOrders || [];
        if (order.table_id) {
          filteredActiveOrders = (activeOrders || []).filter(o => o.table_id === order.table_id);
        } else if (order.table_number) {
          filteredActiveOrders = (activeOrders || []).filter(o => o.table_number === order.table_number);
        }

        if (activeOrdersError) {
          console.error('[TABLE CLEAR] Error checking active orders:', activeOrdersError);
        } else if (!filteredActiveOrders || filteredActiveOrders.length === 0) {
          console.log('[TABLE CLEAR] No other active orders for table, clearing table setup');
          
          // Clear table sessions (active sessions)
          const sessionUpdateData = {
            status: 'FREE',
            order_id: null,
            closed_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };

          let sessionQuery = supabase
            .from('table_sessions')
            .update(sessionUpdateData)
            .eq('venue_id', order.venue_id)
            .is('closed_at', null);

          if (order.table_id) {
            sessionQuery = sessionQuery.eq('table_id', order.table_id);
          } else if (order.table_number) {
            sessionQuery = sessionQuery.eq('table_number', order.table_number);
          }

          const { error: sessionClearError } = await sessionQuery;

          if (sessionClearError) {
            console.error('[TABLE CLEAR] Error clearing table sessions:', sessionClearError);
          } else {
            console.log('[TABLE CLEAR] Successfully cleared table sessions');
          }

          // Also clear table runtime state if it exists
          if (order.table_number) {
            const { error: runtimeClearError } = await supabase
              .from('table_runtime_state')
              .update({ 
                primary_status: 'FREE',
                order_id: null,
                updated_at: new Date().toISOString()
              })
              .eq('venue_id', order.venue_id)
              .eq('label', `Table ${order.table_number}`);

            if (runtimeClearError) {
              console.error('[TABLE CLEAR] Error clearing table runtime state:', runtimeClearError);
            } else {
              console.log('[TABLE CLEAR] Successfully cleared table runtime state');
            }
          }

          console.log('[TABLE CLEAR] Table setup cleared successfully');
        } else {
          console.log('[TABLE CLEAR] Other active orders exist for table, keeping table occupied:', {
            activeOrdersCount: filteredActiveOrders.length,
            activeOrderIds: filteredActiveOrders.map(o => o.id)
          });
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Set status error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
