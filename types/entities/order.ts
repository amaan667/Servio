/**
 * Order Entity Types
 */

export type OrderStatus = 
  | 'PENDING'
  | 'PLACED'
  | 'CONFIRMED'
  | 'PREPARING'
  | 'READY'
  | 'SERVED'
  | 'COMPLETED'
  | 'CANCELLED';

export type PaymentStatus = 
  | 'PENDING'
  | 'PAID'
  | 'PARTIALLY_PAID'
  | 'REFUNDED'
  | 'FAILED';

export type PaymentMethod = 
  | 'CARD'
  | 'CASH'
  | 'DIGITAL_WALLET'
  | 'PAY_LATER'
  | 'DEMO';

export interface OrderItem {
  id: string;
  menu_item_id: string;
  item_name: string;
  quantity: number;
  price: number;
  special_instructions?: string;
  station?: string;
  created_at: string;
}

export interface Order {
  id: string;
  venue_id: string;
  table_id?: string;
  table_number?: number;
  session_id?: string;
  customer_name?: string;
  customer_phone?: string;
  customer_email?: string;
  items: OrderItem[];
  total_amount: number;
  order_status: OrderStatus;
  payment_status: PaymentStatus;
  payment_method?: PaymentMethod;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateOrderRequest {
  venueId: string;
  tableId?: string;
  sessionId?: string;
  items: {
    menu_item_id: string;
    quantity: number;
    special_instructions?: string;
  }[];
  customerInfo?: {
    name?: string;
    phone?: string;
    email?: string;
  };
  notes?: string;
}

export interface UpdateOrderRequest {
  orderId: string;
  venueId: string;
  updates: {
    order_status?: OrderStatus;
    payment_status?: PaymentStatus;
    payment_method?: PaymentMethod;
    notes?: string;
  };
}

export interface OrderWithTable extends Order {
  table?: {
    id: string;
    label: string;
    area: string;
  };
}

