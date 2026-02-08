/**
 * Order Types
 * Type-safe interfaces for order-related data structures
 */

import type {
  OrderStatusType,
  PaymentStatusType,
  PaymentMethodType,
  PaymentModeType,
  FulfillmentTypeType,
  OrderSourceType,
} from "./constants";

// ============================================================================
// Core Order Types
// ============================================================================

/**
 * Individual modifier applied to an order item
 */
export interface OrderItemModifier {
  id: string;
  name: string;
  price: number;
  quantity?: number;
}

/**
 * Order item with all details
 */
export interface OrderItem {
  menu_item_id: string | null;
  item_name: string;
  quantity: number;
  price: number;
  special_instructions?: string | null;
  modifiers?: OrderItemModifier[];
  station?: string;
  category?: string;
  is_available?: boolean;
}

/**
 * Order with all relations
 */
export interface Order {
  id: string;
  venue_id: string;
  table_number?: number | null;
  table_id?: string | null;
  table?: TableInfo | null;
  fulfillment_type: FulfillmentTypeType;
  counter_label?: string | null;
  customer_name: string;
  customer_phone: string;
  customer_email?: string | null;
  items: OrderItem[];
  total_amount: number;
  order_status: OrderStatusType;
  payment_status: PaymentStatusType;
  payment_method: PaymentMethodType;
  payment_mode: PaymentModeType;
  notes?: string | null;
  source: OrderSourceType;
  qr_type?: string | null;
  requires_collection: boolean;
  created_at: string;
  updated_at: string;
  table_auto_created?: boolean;
  session_id?: string;
  // Timestamps
  placed_at?: string | null;
  preparing_at?: string | null;
  ready_at?: string | null;
  served_at?: string | null;
  completed_at?: string | null;
  cancelled_at?: string | null;
  // Payment info
  stripe_payment_intent_id?: string | null;
  paid_at?: string | null;
  // Metadata
  metadata?: Record<string, unknown>;
}

/**
 * Table information (from join)
 */
export interface TableInfo {
  id: string;
  label: string;
  area?: string;
}

/**
 * Session information
 */
export interface TableSession {
  id: string;
  venue_id: string;
  table_id: string;
  order_id: string;
  status: string;
  customer_count?: number;
  started_at: string;
  completed_at?: string | null;
}

/**
 * KDS Ticket
 */
export interface KDSTicket {
  id: string;
  order_id: string;
  venue_id: string;
  station: string;
  status: "pending" | "in_progress" | "ready" | "completed";
  priority: number;
  created_at: string;
  updated_at: string;
  estimated_ready_time?: string | null;
}

/**
 * Order Filters
 */
export interface OrderFilters {
  status?: OrderStatusType | OrderStatusType[];
  paymentStatus?: PaymentStatusType[];
  limit?: number;
  startDate?: string;
  endDate?: string;
  tableId?: string;
  sessionId?: string;
  source?: OrderSourceType;
  fulfillmentType?: FulfillmentTypeType;
}

/**
 * Pagination
 */
export interface OrderPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/**
 * Paginated response
 */
export interface PaginatedOrders {
  orders: Order[];
  pagination: OrderPagination;
}

// ============================================================================
// Input Types (for API calls)
// ============================================================================

/**
 * Create order item input
 */
export interface CreateOrderItemInput {
  menu_item_id?: string;
  item_name: string;
  quantity: number;
  price: number;
  special_instructions?: string;
  modifiers?: OrderItemModifier[];
  station?: string;
}

/**
 * Create order input (validated by Zod)
 */
export interface CreateOrderInput {
  table_number?: number | string | null;
  customer_name: string;
  customer_phone: string;
  customer_email?: string | null;
  items: CreateOrderItemInput[];
  total_amount: number;
  notes?: string | null;
  order_status?: OrderStatusType;
  payment_status?: PaymentStatusType;
  payment_method?: PaymentMethodType;
  payment_mode?: PaymentModeType;
  source?: OrderSourceType;
  fulfillment_type?: FulfillmentTypeType;
  counter_label?: string | null;
  qr_type?: string;
  requires_collection?: boolean;
}

/**
 * Update order status input
 */
export interface UpdateOrderStatusInput {
  status: OrderStatusType;
  reason?: string;
  userId?: string;
}

/**
 * Update payment status input
 */
export interface UpdatePaymentStatusInput {
  paymentStatus: PaymentStatusType;
  paymentMethod?: PaymentMethodType;
  paymentIntentId?: string;
}

/**
 * Mark served input
 */
export interface MarkServedInput {
  orderId: string;
  venueId: string;
}

/**
 * Complete order input
 */
export interface CompleteOrderInput {
  forced?: boolean;
  userId?: string;
  forcedReason?: string;
}

// ============================================================================
// Response Types
// ============================================================================

/**
 * Order creation response
 */
export interface CreateOrderResponse {
  order: Order;
  table_auto_created?: boolean;
  session_id?: string;
}

/**
 * Bulk operation response
 */
export interface BulkOperationResponse {
  success: number;
  failed: number;
  errors: Array<{ orderId: string; error: string }>;
}

/**
 * Order summary for lists
 */
export interface OrderSummary {
  id: string;
  table_number?: number | null;
  customer_name: string;
  total_amount: number;
  order_status: OrderStatusType;
  payment_status: PaymentStatusType;
  item_count: number;
  created_at: string;
}

/**
 * Order analytics
 */
export interface OrderAnalytics {
  total_orders: number;
  total_revenue: number;
  average_order_value: number;
  orders_by_status: Record<OrderStatusType, number>;
  orders_by_hour: Record<string, number>;
  top_items: Array<{ name: string; quantity: number }>;
}
