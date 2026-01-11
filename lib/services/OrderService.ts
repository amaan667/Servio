/**
 * Order Service
 * Handles all order-related business logic
 */

import { BaseService } from "./BaseService";
import { createSupabaseClient } from "@/lib/supabase";

export interface OrderItem {

}

export interface Order {

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

      "id" | "venue_id" | "created_at" | "updated_at" | "order_status" | "payment_status"
    > & {
      table_number?: number | null;
      seat_count?: number;
      source?: "qr" | "counter";
      fulfillment_type?: "table" | "counter" | "delivery" | "pickup";
      counter_label?: string | null;
      order_status?: Order["order_status"];
      payment_status?: Order["payment_status"];
      payment_method?: Order["payment_method"];
    }
  ): Promise<Order & { table_auto_created?: boolean; session_id?: string }> {
    const supabase = await createSupabaseClient();

    // Determine fulfillment_type from source if not provided
    const fulfillmentType =
      orderData.fulfillment_type ||
      (orderData.source === "counter" ? "counter" : "table");

    // Use RPC function for transactional order creation
    // Note: RPC function needs to be updated to accept p_fulfillment_type and p_counter_label
    // For now, we'll insert directly if RPC doesn't support new params
    const { data, error } = await supabase.rpc("create_order_with_session", {

      p_items: orderData.items as unknown as Record<string, unknown>,

      })(),

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

    paymentMethod?: string
  ): Promise<Order> {
    const supabase = await createSupabaseClient();
    const updates: { payment_status: string; payment_method?: string } = {

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
