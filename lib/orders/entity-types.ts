// Entity type definitions and derivation logic for orders

export type EntityKind = 'table' | 'counter' | 'unassigned';

export interface OrderForEntityKind {
  table_id: string | null;
  table?: { is_configured: boolean } | null;
  source?: 'qr_table' | 'qr_counter' | 'pos' | 'manual' | 'unknown';
}

/**
 * Pure function to determine entity type based on order data
 * 
 * Rules:
 * - TABLE: table_id != null and tables.is_configured = true
 * - COUNTER/UNASSIGNED: table_id IS NULL (or is_configured = false)
 * - Never infer from UI route; only from data
 */
export function deriveEntityKind(order: OrderForEntityKind): EntityKind {
  // Primary rule: configured table with table_id
  if (order.table_id && order.table?.is_configured === true) {
    return 'table';
  }

  // Counter: no table_id or unconfigured table
  if (!order.table_id && order.table?.is_configured === false) {
    return 'counter';
  }

  // Generic/free QR behaves like counter
  if (!order.table_id && !order.table) {
    return 'counter';
  }

  // Fallback for legacy data with table_id but missing join
  return 'table';
}

/**
 * Helper to determine if an order should show "Unpaid" chip
 * Only show for till/later unpaid orders
 */
export function shouldShowUnpaidChip(order: {
  payment: {
    mode: 'online' | 'pay_at_till' | 'pay_later';
    status: 'paid' | 'unpaid' | 'failed' | 'refunded';
  };
}): boolean {
  return (
    order.payment.mode === 'pay_at_till' || 
    order.payment.mode === 'pay_later'
  ) && order.payment.status === 'unpaid';
}
