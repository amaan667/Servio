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
  const { order_status, payment_status } = body as { order_status?: 'PLACED'|'IN_PREP'|'READY'|'COMPLETED'|'CANCELLED', payment_status?: 'UNPAID'|'PAID'|'REFUNDED' };
  if (!id) {
    return NextResponse.json({ ok: false, error: 'Invalid payload' }, { status: 400 });
  }
  if (order_status && !['PLACED','IN_PREP','READY','COMPLETED','CANCELLED'].includes(order_status)) {
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
      console.log('[DASHBOARD UPDATE] Order completed/cancelled, checking if table should be set to FREE');
      
      // Check if there are any other active orders for this table
      const { data: activeOrders, error: activeOrdersError } = await supa
        .from('orders')
        .select('id')
        .eq('venue_id', order.venue_id)
        .eq('table_number', order.table_number)
        .eq('source', 'qr')
        .in('order_status', ['PLACED', 'ACCEPTED', 'IN_PREP', 'READY', 'SERVING'])
        .neq('id', id);

      if (activeOrdersError) {
        console.error('[DASHBOARD UPDATE] Error checking active orders:', activeOrdersError);
      } else if (!activeOrders || activeOrders.length === 0) {
        // No other active orders for this table, set it back to FREE
        console.log('[DASHBOARD UPDATE] No other active orders for table, setting to FREE');
        
        // Find the table by venue_id and table_number
        const { data: tableData, error: tableFindError } = await supa
          .from('table_runtime_state')
          .select('id')
          .eq('venue_id', order.venue_id)
          .eq('label', `Table ${order.table_number}`)
          .single();

        if (tableFindError) {
          console.error('[DASHBOARD UPDATE] Error finding table:', tableFindError);
        } else if (tableData) {
          const { error: tableUpdateError } = await supa
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
            console.error('[DASHBOARD UPDATE] Error updating table to FREE:', tableUpdateError);
          } else {
            console.log('[DASHBOARD UPDATE] Successfully set table to FREE');
          }
        }
      } else {
        console.log('[DASHBOARD UPDATE] Other active orders exist for table, keeping OCCUPIED');
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


