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
      if (order && order.table_id && order.source === 'qr') {
        console.log('[UPDATE STATUS] Order completed/cancelled, checking if table should be set to FREE');
        
        // Check if there are any other active orders for this table
        const { data: activeOrders, error: activeOrdersError } = await supabase
          .from('orders')
          .select('id')
          .eq('venue_id', order.venue_id)
          .eq('table_id', order.table_id)
          .in('order_status', ['PLACED', 'IN_PREP', 'READY', 'SERVING'])
          .limit(1);

        if (activeOrdersError) {
          console.error('[UPDATE STATUS] Error checking active orders:', activeOrdersError);
        } else if (!activeOrders || activeOrders.length === 0) {
          console.log('[UPDATE STATUS] No active orders found, setting table to FREE');
          
          // Set table session to FREE
          const { error: tableError } = await supabase
            .from('table_sessions')
            .upsert({
              table_id: order.table_id,
              status: 'FREE',
              closed_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            }, {
              onConflict: 'table_id'
            });

          if (tableError) {
            console.error('[UPDATE STATUS] Error updating table session:', tableError);
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
                console.log('[UPDATE STATUS] Auto-completion check result:', completionResult);
              }
            } catch (completionError) {
              console.error('[UPDATE STATUS] Error checking reservation completion:', completionError);
              // Don't fail the main request if completion check fails
            }
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