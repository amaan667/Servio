/**
 * Order Service
 * Handles all order-related business logic
 */

import { BaseService } from "./BaseService";
import { createSupabaseClient } from "@/lib/supabase";

export interface OrderItem {
  menu_item_id: string;
  item_name: string;
  quantity: number;
  price: number;
  specialInstructions?: string;
  station?: string;
}

export interface Order {
  id: string;
  venue_id: string;
  table_number?: number | null;
  table_id?: string | null;
  session_id?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  customer_email?: string | null;
  items: OrderItem[];
  total_amount: number;
  order_status: string;
  payment_status?: string | null;
  payment_method?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrderFilters {
  status?: string;
  paymentStatus?: string[];
  limit?: number;
  startDate?: string;
  endDate?: string;
  tableId?: string;
  sessionId?: string;
}

export class OrderService extends BaseService {
  /**
   * Get orders with caching
   */
  async getOrders(venueId: string, filters?: OrderFilters): Promise<Order[]> {
    const cacheKey = this.getCacheKey("orders:list", venueId, JSON.stringify(filters));

    return this.withCache(
      cacheKey,
      async () => {
        const supabase = await createSupabaseClient();
        let query = supabase
          .from("orders")
          .select(
            `
          *,
          tables!left (
            id,
            label,
            area
          )
        `
          )
          .eq("venue_id", venueId)
          .order("created_at", { ascending: false });

        if (filters?.status) {
          query = query.eq("order_status", filters.status);
        }

        if (filters?.paymentStatus && filters.paymentStatus.length > 0) {
          query = query.in("payment_status", filters.paymentStatus);
        }

        if (filters?.tableId) {
          query = query.eq("table_id", filters.tableId);
        }

        if (filters?.sessionId) {
          query = query.eq("session_id", filters.sessionId);
        }

        if (filters?.startDate) {
          query = query.gte("created_at", filters.startDate);
        }

        if (filters?.endDate) {
          query = query.lte("created_at", filters.endDate);
        }

        if (filters?.limit) {
          query = query.limit(filters.limit);
        }

        const { data, error } = await query;
        if (error) throw error;
        return data || [];
      },
      60
    ); // 1 minute cache for orders
  }

  /**
   * Get order by ID
   */
  async getOrder(orderId: string, venueId: string): Promise<Order | null> {
    const cacheKey = this.getCacheKey("orders:item", venueId, orderId);

    return this.withCache(
      cacheKey,
      async () => {
        const supabase = await createSupabaseClient();
        const { data, error } = await supabase
          .from("orders")
          .select(
            `
          *,
          tables!left (
            id,
            label,
            area
          )
        `
          )
          .eq("id", orderId)
          .eq("venue_id", venueId)
          .single();

        if (error) throw error;
        return data;
      },
      60
    );
  }

  /**
   * Create order using transactional RPC function
   * This ensures atomicity: order + table (if needed) + table session
   */
  async createOrder(
    venueId: string,
    orderData: Omit<
      Order,
      "id" | "venue_id" | "created_at" | "updated_at" | "order_status" | "payment_status"
    > & {
      table_number?: number | null;
      seat_count?: number;
      source?: "qr" | "counter";
    }
  ): Promise<Order & { table_auto_created?: boolean; session_id?: string }> {
    const supabase = await createSupabaseClient();
    
    // Use RPC function for transactional order creation
    const { data, error } = await supabase.rpc("create_order_with_session", {
      p_venue_id: venueId,
      p_table_number: orderData.table_number ?? null,
      p_customer_name: orderData.customer_name ?? "",
      p_customer_phone: orderData.customer_phone ?? "",
      p_customer_email: orderData.customer_email ?? null,
      p_items: orderData.items as unknown as Record<string, unknown>,
      p_total_amount: orderData.total_amount,
      p_notes: orderData.notes ?? null,
      p_order_status: orderData.order_status ?? "PLACED",
      p_payment_status: orderData.payment_status ?? "UNPAID",
      p_payment_method: orderData.payment_method ?? "PAY_NOW",
      p_payment_mode: (() => {
        const method = orderData.payment_method ?? "PAY_NOW";
        if (method === "PAY_NOW") return "online";
        if (method === "PAY_AT_TILL") return "offline";
        if (method === "PAY_LATER") return "deferred";
        return "online";
      })(),
      p_source: orderData.source ?? "qr",
      p_seat_count: orderData.seat_count ?? 4,
    });

    if (error) {
      throw new Error(`Order creation failed: ${error.message}`);
    }

    // Invalidate cache
    await this.invalidateCachePattern(`orders:*:${venueId}:*`);

    return data as Order & { table_auto_created?: boolean; session_id?: string };
  }

  /**
   * Update order status
   */
  async updateOrderStatus(orderId: string, venueId: string, status: string): Promise<Order> {
    const supabase = await createSupabaseClient();
    const { data, error } = await supabase
      .from("orders")
      .update({ order_status: status })
      .eq("id", orderId)
      .eq("venue_id", venueId)
      .select()
      .single();

    if (error) throw error;

    // Invalidate cache
    await this.invalidateCachePattern(`orders:*:${venueId}:*`);

    return data;
  }

  /**
   * Update payment status
   */
  async updatePaymentStatus(
    orderId: string,
    venueId: string,
    paymentStatus: string,
    paymentMethod?: string
  ): Promise<Order> {
    const supabase = await createSupabaseClient();
    const updates: { payment_status: string; payment_method?: string } = {
      payment_status: paymentStatus,
    };
    if (paymentMethod) {
      updates.payment_method = paymentMethod;
    }

    const { data, error } = await supabase
      .from("orders")
      .update(updates)
      .eq("id", orderId)
      .eq("venue_id", venueId)
      .select()
      .single();

    if (error) throw error;

    // Invalidate cache
    await this.invalidateCachePattern(`orders:*:${venueId}:*`);

    return data;
  }

  /**
   * Mark order as served
   */
  async markServed(orderId: string, venueId: string): Promise<Order> {
    return this.updateOrderStatus(orderId, venueId, "SERVED");
  }

  /**
   * Mark order as completed
   */
  async markCompleted(orderId: string, venueId: string): Promise<Order> {
    return this.updateOrderStatus(orderId, venueId, "COMPLETED");
  }

  /**
   * Cancel order
   */
  async cancelOrder(orderId: string, venueId: string): Promise<Order> {
    return this.updateOrderStatus(orderId, venueId, "CANCELLED");
  }

  /**
   * Bulk complete orders
   */
  async bulkCompleteOrders(orderIds: string[], venueId: string): Promise<void> {
    const supabase = await createSupabaseClient();
    const { error } = await supabase
      .from("orders")
      .update({ order_status: "COMPLETED" })
      .in("id", orderIds)
      .eq("venue_id", venueId);

    if (error) throw error;

    // Invalidate cache
    await this.invalidateCachePattern(`orders:*:${venueId}:*`);
  }

  /**
   * Get orders by session
   */
  async getOrdersBySession(sessionId: string, venueId: string): Promise<Order[]> {
    return this.getOrders(venueId, { sessionId });
  }

  /**
   * Get orders by table
   */
  async getOrdersByTable(tableId: string, venueId: string): Promise<Order[]> {
    return this.getOrders(venueId, { tableId });
  }

  /**
   * Get recent orders
   */
  async getRecentOrders(venueId: string, hours: number = 24): Promise<Order[]> {
    const startDate = new Date();
    startDate.setHours(startDate.getHours() - hours);
    return this.getOrders(venueId, { startDate: startDate.toISOString() });
  }
}

// Export singleton instance
export const orderService = new OrderService();
