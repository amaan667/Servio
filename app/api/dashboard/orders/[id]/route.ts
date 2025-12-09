import { success, apiErrors } from '@/lib/api/standard-response';
import { createClient } from '@/lib/supabase';
import { cleanupTableOnOrderCompletion } from '@/lib/table-cleanup';
import { logger } from '@/lib/logger';
import { withUnifiedAuth } from '@/lib/auth/unified-auth';
import { NextRequest } from 'next/server';

export const runtime = 'nodejs';

/**
 * Update order status/payment status
 * SECURITY: Uses withUnifiedAuth to enforce venue access and RLS.
 * The authenticated client ensures users can only update orders for venues they have access to.
 */
export const PATCH = withUnifiedAuth(
  async (req: NextRequest, context, routeParams) => {
    const { id } = await routeParams?.params || {};
    const body = await req.json().catch(() => ({ /* Empty */ }));
    const { order_status, payment_status } = body as { order_status?: 'PLACED'|'IN_PREP'|'READY'|'SERVING'|'SERVED'|'COMPLETED'|'CANCELLED'|'REFUNDED'|'EXPIRED', payment_status?: 'UNPAID'|'PAID'|'REFUNDED' };
    
    if (!id) {
      return apiErrors.badRequest('Invalid payload');
    }
    if (order_status && !['PLACED','IN_PREP','READY','SERVING','SERVED','COMPLETED','CANCELLED','REFUNDED','EXPIRED'].includes(order_status)) {
      return apiErrors.badRequest('Invalid payload');
    }
    
    // Use authenticated client that respects RLS (not admin client)
    // RLS policies ensure users can only access orders for venues they have access to
    const supa = await createClient();
  
    // CRITICAL: Verify payment status before allowing COMPLETED
    // Also verify order belongs to user's venue (RLS enforces this, but explicit check for clarity)
    if (order_status === 'COMPLETED') {
      const { data: currentOrder } = await supa
        .from('orders')
        .select('payment_status, order_status, venue_id')
        .eq('id', id)
        .eq('venue_id', context.venueId) // Explicit venue check (RLS also enforces this)
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
    
    // Update order - RLS ensures user can only update orders for venues they have access to
    const { data, error } = await supa
      .from('orders')
      .update(update)
      .eq('id', id)
      .eq('venue_id', context.venueId) // Explicit venue check (RLS also enforces this)
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
);

/**
 * Delete order
 * SECURITY: Uses withUnifiedAuth to enforce venue access and RLS.
 * The authenticated client ensures users can only delete orders for venues they have access to.
 */
export const DELETE = withUnifiedAuth(
  async (_req: NextRequest, context, routeParams) => {
    try {
      const { id } = await routeParams?.params || {};
      if (!id) return apiErrors.badRequest('id required');
      
      // Use authenticated client that respects RLS (not admin client)
      const supa = await createClient();
      
      // Delete order - RLS ensures user can only delete orders for venues they have access to
      const { error } = await supa
        .from('orders')
        .delete()
        .eq('id', id)
        .eq('venue_id', context.venueId); // Explicit venue check (RLS also enforces this)
      
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
        venueId: context.venueId,
      });
      return apiErrors.internal(errorMessage);
    }
  }
);

