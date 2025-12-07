import { success, apiErrors } from '@/lib/api/standard-response';
import { createClient } from '@/lib/supabase';
import { cleanupTableOnOrderCompletion } from '@/lib/table-cleanup';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';

function admin() {
  return createClient();
}

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = await req.json().catch(() => ({ /* Empty */ }));
  const { order_status, payment_status } = body as { order_status?: 'PLACED'|'IN_PREP'|'READY'|'SERVING'|'SERVED'|'COMPLETED'|'CANCELLED'|'REFUNDED'|'EXPIRED', payment_status?: 'UNPAID'|'PAID'|'REFUNDED' };
  if (!id) {
    return apiErrors.badRequest('Invalid payload');
  }
  if (order_status && !['PLACED','IN_PREP','READY','SERVING','SERVED','COMPLETED','CANCELLED','REFUNDED','EXPIRED'].includes(order_status)) {
    return apiErrors.badRequest('Invalid payload');
  }
  const supa = await admin();
  
  // CRITICAL: Verify payment status before allowing COMPLETED
  if (order_status === 'COMPLETED') {
    const { data: currentOrder } = await supa
      .from('orders')
      .select('payment_status, order_status')
      .eq('id', id)
      .maybeSingle();

    if (!currentOrder) {
      return apiErrors.notFound('Order not found');
    }

    if (currentOrder.payment_status !== 'PAID') {
      return apiErrors.badRequest(
        `Cannot complete order: payment status is ${currentOrder.payment_status}. Order must be PAID before completion.`,
        { payment_status: currentOrder.payment_status }
      );
    }

    // Also verify order is in a completable state
    const completableStatuses = ['SERVED', 'READY', 'SERVING'];
    if (!completableStatuses.includes(currentOrder.order_status)) {
      return apiErrors.badRequest(
        `Cannot complete order: current status is ${currentOrder.order_status}. Order must be SERVED, READY, or SERVING before completion.`,
        { current_status: currentOrder.order_status }
      );
    }
  }

  const update: Record<string, unknown> = { /* Empty */ };
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
  if (error) {
    logger.error("[DASHBOARD ORDER UPDATE] Database error", {
      error: error.message,
      orderId: id,
    });
    return apiErrors.database(error.message);
  }

  // Deduct inventory stock when order is completed
  if (order_status === 'COMPLETED' && data) {
    try {
      await supa.rpc('deduct_stock_for_order', {
        p_order_id: id,
        p_venue_id: data.venue_id,
      });
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
        logger.error('[DASHBOARD ORDER] Table cleanup failed:', { error: cleanupResult.error });
      } else {
        // Cleanup successful
      }
    }
  }

  return success({ order: data });
}

export async function DELETE(_req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    if (!id) return apiErrors.badRequest('id required');
    const supa = await admin();
    const { error } = await supa.from('orders').delete().eq('id', id);
    if (error) {
      logger.error("[DASHBOARD ORDER DELETE] Database error", {
        error: error.message,
        orderId: id,
      });
      return apiErrors.database(error.message);
    }
    return success({});
  } catch (_error) {
    const errorMessage = _error instanceof Error ? _error.message : "Unknown error";
    logger.error("[DASHBOARD ORDER DELETE] Unexpected error", {
      error: errorMessage,
    });
    return apiErrors.internal(errorMessage);
  }
}

