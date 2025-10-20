import { errorToContext } from '@/lib/utils/error-to-context';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { cleanupTableOnOrderCompletion } from '@/lib/table-cleanup';
import { apiLogger, logger } from '@/lib/logger';

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
  const update: Record<string, unknown> = {};
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

  // Deduct inventory stock when order is completed
  if (order_status === 'COMPLETED' && data) {
    try {
      await supa.rpc('deduct_stock_for_order', {
        p_order_id: id,
        p_venue_id: data.venue_id,
      });
      logger.debug('[INVENTORY] Stock deducted for order:', { value: id });
    } catch (inventoryError) {
      logger.error('[INVENTORY] Error deducting stock:', { value: inventoryError });
      // Don't fail the order completion if inventory deduction fails
    }
  }

  // Handle table state transitions when order is completed or cancelled
  if (order_status === 'COMPLETED' || order_status === 'CANCELLED') {
    const order = data;
    if (order && order.table_number) {
      
      // Use centralized table cleanup function
      const cleanupResult = await cleanupTableOnOrderCompletion({
        venueId: order.venue_id,
        tableNumber: order.table_number,
        orderId: id
      });

      if (!cleanupResult.success) {
        logger.error('[DASHBOARD ORDER] Table cleanup failed:', cleanupResult.error);
      } else {
        logger.debug('[DASHBOARD ORDER] Table cleanup successful:', cleanupResult.details);
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


