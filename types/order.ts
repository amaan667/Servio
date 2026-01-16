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

export type PaymentMethod =
  | "PAY_NOW"
  | "PAY_LATER"
  | "PAY_AT_TILL"
  | "demo"
  | "stripe"
  | "till"
  | "cash"
  | "card"
  | null;

export interface OrderItem {
  id?: string;
  menu_item_id?: string;
  item_name: string;
  quantity: number;
  price: number;
  special_instructions?: string;
  image_url?: string;
}

export interface Order {
  id: string;
  venue_id: string;
  qr_type?: "TABLE_FULL_SERVICE" | "TABLE_COLLECTION" | "COUNTER";
  fulfillment_status?: "NEW" | "PREPARING" | "READY" | "SERVED" | "COMPLETED" | "CANCELLED";
  table_number?: number | string;
  table_id?: string | null;
  customer_name?: string;
  customer_phone?: string;
  customer_email?: string;
  items: OrderItem[];
  total_amount: number;
  notes?: string;
  order_status: OrderStatus;
  payment_status: PaymentStatus;
  payment_method?: PaymentMethod;
  payment_mode?: string;
  source?: string;
  session_id?: string;
  order_number?: string;
  created_at?: string;
  updated_at?: string;
}
