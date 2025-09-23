import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient();
}

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = await req.json().catch(() => ({}));
  const { order_status, payment_status } = body as { order_status?: 'PLACED'|'IN_PREP'|'READY'|'SERVING'|'SERVED'|'COMPLETED'|'CANCELLED'|'REFUNDED'|'EXPIRED', payment_status?: 'UNPAID'|'PAID'|'REFUNDED' };
  if (!id) {
    return NextResponse.json({ ok: false, error: 'Invalid payload' }, { status: 400 });
  }
  if (order_status && !['PLACED','IN_PREP','READY','SERVING','SERVED','COMPLETED','CANCELLED','REFUNDED','EXPIRED'].includes(order_status)) {
    return NextResponse.json({ ok: false, error: 'Invalid payload' }, { status: 400 });
  }
  const supa = await admin();
  const update: Record<string, any> = {};
  if (order_status) {
    update.order_status = order_status;
  }
  if (payment_status) update.payment_status = payment_status;
  const { data, error } = await supa
    .from('orders')
    .update(update)
    .eq('id', id)
    .select('*')
    .maybeSingle();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });

  // Handle table state transitions when order is completed or cancelled
  if (order_status === 'COMPLETED' || order_status === 'CANCELLED') {
    const order = data;
    if (order && order.table_number && order.source === 'qr') {
      console.log('[TABLE CLEAR] Order completed/cancelled, checking if table should be cleared:', {
        orderId: id,
        tableNumber: order.table_number,
        venueId: order.venue_id,
        orderStatus: order_status
      });
      
      // Check if there are any other active orders for this table
      const { data: activeOrders, error: activeOrdersError } = await supa
        .from('orders')
        .select('id, order_status')
        .eq('venue_id', order.venue_id)
        .eq('table_number', order.table_number)
        .eq('source', 'qr')
        .in('order_status', ['PLACED', 'ACCEPTED', 'IN_PREP', 'READY', 'SERVING'])
        .neq('id', id);

      if (activeOrdersError) {
        console.error('[TABLE CLEAR] Error checking active orders:', activeOrdersError);
      } else if (!activeOrders || activeOrders.length === 0) {
        // No other active orders for this table, clear the table setup
        console.log('[TABLE CLEAR] No other active orders for table, clearing table setup');
        
        // Clear table sessions (active sessions)
        const { error: sessionClearError } = await supa
          .from('table_sessions')
          .update({ 
            status: 'FREE',
            order_id: null,
            closed_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('venue_id', order.venue_id)
          .eq('table_number', order.table_number)
          .is('closed_at', null);

        if (sessionClearError) {
          console.error('[TABLE CLEAR] Error clearing table sessions:', sessionClearError);
        } else {
          console.log('[TABLE CLEAR] Successfully cleared table sessions');
        }

        // Also clear table runtime state if it exists
        const { error: runtimeClearError } = await supa
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

        console.log('[TABLE CLEAR] Table setup cleared successfully for table', order.table_number);
      } else {
        console.log('[TABLE CLEAR] Other active orders exist for table, keeping table occupied:', {
          activeOrdersCount: activeOrders.length,
          activeOrderIds: activeOrders.map(o => o.id)
        });
      }
    }
  }

  return NextResponse.json({ ok: true, order: data });
}

export async function DELETE(_req: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!id) return NextResponse.json({ ok: false, error: 'id required' }, { status: 400 });
  const supa = await admin();
  const { error } = await supa.from('orders').delete().eq('id', id);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}


