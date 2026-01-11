// Entity type definitions and derivation logic for orders

export type EntityKind = "table" | "counter" | "unassigned";

export interface OrderForEntityKind {

  table?: { is_configured: boolean } | null;
  source?: "qr_table" | "qr_counter" | "qr" | "counter" | "pos" | "manual" | "unknown";
}

/**
 * Pure function to determine entity type based on order data
 *
 * Rules:
 * - TABLE: table_id != null OR source is 'qr' (QR table orders)
 * - COUNTER: source is 'counter' OR no table_id and not QR source
 * - Never infer from UI route; only from data
 */
export function deriveEntityKind(

  }
): EntityKind {
  // If we have an explicit counter_label and no table_label, it's a counter order
  if (order.counter_label && !order.table_label) {
    return "counter";
  }

  // If we have an explicit table_label, it's a table order
  if (order.table_label) {
    return "table";
  }

  // Primary rule: if source is explicitly 'qr', it's a table order
  if (order.source === "qr_table" || order.source === "qr") {
    return "table";
  }

  // If source is explicitly 'counter', it's a counter order (can be till order or pickup QR order)
  if (order.source === "qr_counter" || order.source === "counter") {
    return "counter";
  }

  // If we have a table_id, it's likely a table order
  if (order.table_id) {
    return "table";
  }

  // If we have a table_number (not null), it's likely a table order
  // (We already checked for counter source above, so if we're here, it's not a counter)
  if (order.table_number !== null && order.table_number !== undefined) {
    return "table";
  }

  // If table is configured, it's a table order
  if (order.table?.is_configured === true) {
    return "table";
  }

  // Default to counter for unassigned orders
  return "counter";
}

/**
 * Helper to determine if an order should show "Unpaid" chip
 * Only show for till/later unpaid orders
 */
export function shouldShowUnpaidChip(order: {

  };
}): boolean {
  return (
    (order.payment.mode === "pay_at_till" || order.payment.mode === "pay_later") &&
    order.payment.status === "unpaid"
  );
}
