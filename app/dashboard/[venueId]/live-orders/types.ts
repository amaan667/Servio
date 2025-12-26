export interface Order {
  id: string;
  venue_id: string;
  table_number: number | null; // Only for table orders
  table_id?: string | null;
  session_id?: string | null;
  fulfillment_type?: "table" | "counter" | "delivery" | "pickup"; // New: proper fulfillment type
  counter_label?: string | null; // New: counter label for counter orders
  customer_name: string | null;
  customer_phone?: string | null;
  customer_email?: string | null;
  items: Array<{
    menu_item_id: string;
    item_name: string;
    quantity: number;
    price: number;
    specialInstructions?: string;
  }>;
  total_amount: number;
  created_at: string;
  updated_at?: string;
  order_status:
    | "PLACED"
    | "ACCEPTED"
    | "IN_PREP"
    | "READY"
    | "OUT_FOR_DELIVERY"
    | "SERVING"
    | "SERVED"
    | "COMPLETED"
    | "CANCELLED"
    | "REFUNDED"
    | "EXPIRED";
  payment_status?: string;
  payment_method?: string;
  notes?: string;
  scheduled_for?: string;
  prep_lead_minutes?: number;
  source?: "qr" | "counter"; // Legacy: kept for backward compatibility
  table_label?: string;
  counter_label?: string; // Duplicate for backward compatibility
  table?: { is_configured: boolean } | null;
}

export interface LiveOrdersClientProps {
  venueId: string;
  venueName?: string;
}

export interface GroupedHistoryOrders {
  [date: string]: Order[];
}
