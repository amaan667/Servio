/**
 * Order API Type Definitions
 */

export interface OrderPayload {
  venue_id: string;
  customer_name: string;
  customer_phone: string;
  customer_email?: string | null;
  table_number?: number | null;
  table_id?: string | null;
  items: OrderItem[];
  total_amount: number;
  payment_method: "CARD" | "CASH" | "PAY_LATER" | "STRIPE";
  payment_status: "PAID" | "UNPAID" | "PROCESSING";
  order_status?: string;
  source?: "qr" | "counter" | "pos" | "admin";
  session_id?: string | null;
  notes?: string | null;
  stripe_session_id?: string | null;
}

export interface OrderItem {
  menu_item_id?: string | null;
  item_name: string;
  quantity: number | string;
  price: number;
  unit_price?: number;
  specialInstructions?: string | null;
  special_instructions?: string | null;
}

export interface OrderResponse {
  ok: boolean;
  order?: Record<string, unknown>;
  table_auto_created?: boolean;
  table_id?: string | null;
  session_id?: string | null;
  source?: string;
  display_name?: string;
  duplicate?: boolean;
  error?: string;
}
