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
      if (order && (order.table_id || order.table_number) && order.source === 'qr') {
        
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
            }
          }

        } else {
        }

        // If order is completed and paid, check if reservations should be auto-completed
        if (status === 'COMPLETED' && order.payment_status === 'PAID') {
          try {
            const completionResponse = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/reservations/check-completion`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                venueId: order.venue_id,
                tableId: order.table_id
              }),
            });

            if (completionResponse.ok) {
              const completionResult = await completionResponse.json();
            }
          } catch (completionError) {
            console.error('[UPDATE STATUS] Error checking reservation completion:', completionError);
            // Don't fail the main request if completion check fails
          }
        }
      }
    }

    return NextResponse.json({ ok: true, order: data?.[0] });
  } catch (error) {
    console.error('[UPDATE STATUS] Unexpected error:', error);
    return NextResponse.json({ ok: false, error: 'Internal server error' }, { status: 500 });
  }
}