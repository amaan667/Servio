/**
 * Order-related types
 */

export type OrderStatus =
  | "PLACED"
  | "ACCEPTED"
  | "IN_PREP"
  | "READY"
  | "SERVING"
  | "SERVED"
  | "COMPLETED"
  | "CANCELLED";

export type PaymentStatus = "PAID" | "UNPAID" | "REFUNDED" | "PARTIALLY_PAID";

export type PaymentMethod = "demo" | "stripe" | "till" | "cash" | "card" | null;

export interface OrderItem {
  id?: string;
  menu_item_id?: string;

}

export interface Order {

}
