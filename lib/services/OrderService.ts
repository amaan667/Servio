/**
 * Order Service
 * Handles all order-related business logic
 */

import { BaseService } from "./BaseService";
import { createSupabaseClient } from "@/lib/supabase";
import { trackOrderError } from "@/lib/monitoring/error-tracking";

export interface OrderItem {
  menu_item_id: string | null;
  item_name: string;
  quantity: number;
  price: number;
  special_instructions?: string | null;
  modifiers?: Record<string, unknown>;
  station?: string;
}

export interface Order {
  id: string;
  venue_id: string;
  table_number?: number | null;
  table_id?: string | null;
  fulfillment_type?: "table" | "counter" | "delivery" | "pickup";
  counter_label?: string | null;
  customer_name: string;
  customer_phone: string;
  customer_email?: string | null;
  items: OrderItem[];
  total_amount: number;
  order_status: string;
  payment_status: string;
  payment_method: string;
  payment_mode: string;
  notes?: string | null;
  source: string;
  qr_type?: string | null;
  requires_collection: boolean;
  created_at: string;
  updated_at: string;
  table_auto_created?: boolean;
  session_id?: string;
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
   * Create order using direct insert
   * Simple and reliable order creation
   */
  async createOrder(
    venueId: string,
    orderData: {
      table_number?: number | string | null;
      customer_name: string;
      customer_phone: string;
      customer_email?: string | null;
      items: Record<string, unknown>[];
      total_amount: number;
      notes?: string | null;
      order_status?: string;
      payment_status?: string;
      payment_method?: string;
      payment_mode?: string;
      source?: "qr" | "counter";
      fulfillment_type?: "table" | "counter" | "delivery" | "pickup";
      counter_label?: string | null;
      qr_type?: string;
      requires_collection?: boolean;
    }
  ): Promise<Order & { table_auto_created?: boolean; session_id?: string }> {
    // eslint-disable-next-line no-console
    console.log("🔄 [OrderService] createOrder called");
    // eslint-disable-next-line no-console
    console.log("📋 [OrderService] Input:", {
      venueId,
      orderData: {
        ...orderData,
        items_count: orderData.items?.length || 0,
      },
    });

    const supabase = await createSupabaseClient();

    // Determine fulfillment_type from source if not provided
    const fulfillmentType =
      orderData.fulfillment_type ||
      (orderData.source === "counter" ? "counter" : "table");

    // Standardize table number
    const tableNumber = fulfillmentType === "table" ? 
      (typeof orderData.table_number === 'string' ? parseInt(orderData.table_number) : orderData.table_number) 
      : null;

    // Calculate payment_mode based on payment_method
    const paymentMode = orderData.payment_mode || (() => {
      const method = orderData.payment_method ?? "PAY_NOW";
      if (method === "PAY_NOW") return "online";
      if (method === "PAY_AT_TILL") return "offline";
      if (method === "PAY_LATER") return "deferred";
      return "online";
    })();

    const insertPayload = {
      venue_id: venueId,
      table_number: tableNumber,
      customer_name: orderData.customer_name,
      customer_phone: orderData.customer_phone,
      customer_email: orderData.customer_email ?? null,
      items: orderData.items,
      total_amount: orderData.total_amount,
      notes: orderData.notes ?? null,
      order_status: orderData.order_status || "PLACED",
      payment_status: orderData.payment_status || "UNPAID",
      payment_method: orderData.payment_method || "PAY_NOW",
      payment_mode: paymentMode,
      source: orderData.source || "qr",
      fulfillment_type: fulfillmentType,
      counter_label: fulfillmentType === "counter" ? orderData.counter_label ?? null : null,
      qr_type: orderData.qr_type ?? null,
      requires_collection: orderData.requires_collection ?? false
    };

    // eslint-disable-next-line no-console
    console.log("📦 [OrderService] Insert Payload:", JSON.stringify(insertPayload, null, 2));
    // eslint-disable-next-line no-console
    console.log("🔄 [OrderService] Executing Supabase insert...");

    // Direct insert - don't use .single() as it fails when no rows returned
    const { data: insertedRows, error } = await supabase
      .from("orders")
      .insert(insertPayload)
      .select("*");

    if (error) {
      // eslint-disable-next-line no-console
      console.error("❌ [OrderService] Insert failed:", {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
      });
      trackOrderError(error, { venueId, action: "createOrder" });
      throw new Error(`Failed to create order: ${error.message}`);
    }

    // Handle array response - take first row
    const data = Array.isArray(insertedRows) ? insertedRows[0] : insertedRows;
    
    if (!data) {
      // eslint-disable-next-line no-console
      console.error("❌ [OrderService] Insert returned no data");
      throw new Error("Failed to create order: No data returned from insert");
    }

    // eslint-disable-next-line no-console
    console.log("✅ [OrderService] Order created:", {
      id: data?.id,
      order_number: data?.order_number,
      status: data?.order_status,
      payment_status: data?.payment_status,
    });

    // Invalidate cache
    await this.invalidateCachePattern(`orders:*:${venueId}:*`);

    return data;
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
   * Mark order as served (handles RPC + fulfillment_status)
   */
  async markServed(orderId: string, venueId: string): Promise<Order> {
    const supabase = await createSupabaseClient();
    
    // Canonical transition: SERVE (requires kitchen_status=BUMPED in DB)
    const { data, error } = await supabase.rpc("orders_set_served", {
      p_order_id: orderId,
      p_venue_id: venueId,
    });

    if (error) throw error;

    const result = Array.isArray(data) ? data[0] : data;
    
    // Best-effort: update table_sessions
    await supabase
      .from("table_sessions")
      .update({ status: "SERVED", updated_at: new Date().toISOString() })
      .eq("order_id", orderId)
      .eq("venue_id", venueId);

    await this.invalidateCachePattern(`orders:*:${venueId}:*`);
    return result;
  }

  /**
   * Mark order as completed (handles RPC + cleanup)
   */
  async completeOrder(
    orderId: string, 
    venueId: string, 
    options: { forced?: boolean; userId?: string; forcedReason?: string } = {}
  ): Promise<Order> {
    const supabase = await createSupabaseClient();

    // 1. Execute canonical completion RPC
    const { data, error } = await supabase.rpc("orders_complete", {
      p_order_id: orderId,
      p_venue_id: venueId,
      p_forced: options.forced || false,
      p_forced_by: options.forced ? options.userId : null,
      p_forced_reason: options.forced ? options.forcedReason : null,
    });

    if (error) throw error;

    const order = Array.isArray(data) ? data[0] : data;

    // 2. Trigger table cleanup
    if (order.table_id || order.table_number) {
      const { cleanupTableOnOrderCompletion } = await import("@/lib/table-cleanup");
      await cleanupTableOnOrderCompletion({
        venueId,
        tableId: order.table_id || undefined,
        tableNumber: order.table_number?.toString() || undefined,
        orderId,
      });
    }

    // 3. Deduct inventory
    await supabase.rpc("deduct_stock_for_order", {
      p_order_id: orderId,
      p_venue_id: venueId,
    });

    await this.invalidateCachePattern(`orders:*:${venueId}:*`);
    await this.invalidateCachePattern(`tables:*:${venueId}:*`);
    
    return order;
  }

  /**
   * Cancel order
   */
  async cancelOrder(orderId: string, venueId: string): Promise<Order> {
    return this.updateOrderStatus(orderId, venueId, "CANCELLED");
  }

  /**
   * Bulk complete orders with atomic cleanup
   */
  async bulkCompleteOrders(orderIds: string[], venueId: string): Promise<number> {
    const supabase = await createSupabaseClient();
    
    // 1. Get orders to complete
    const { data: orders } = await supabase
      .from("orders")
      .select("id, table_id, table_number, payment_status, order_status")
      .in("id", orderIds)
      .eq("venue_id", venueId);

    if (!orders || orders.length === 0) return 0;

    // 2. Filter out already COMPLETED orders - they shouldn't be overridden (still need payment)
    const ordersToComplete = orders.filter(o => o.order_status !== "COMPLETED");
    
    if (ordersToComplete.length === 0) {
      return 0; // All orders are already completed
    }

    // 3. Validate payment status (Production requirement: all must be PAID)
    const unpaid = ordersToComplete.filter(o => o.payment_status !== 'PAID' && o.payment_status !== 'TILL');
    if (unpaid.length > 0) {
      throw new Error(`Cannot complete ${unpaid.length} unpaid orders.`);
    }

    let completedCount = 0;
    for (const order of ordersToComplete) {
      try {
        // Use RPC for atomic completion
        const { error } = await supabase.rpc("orders_complete", {
          p_order_id: order.id,
          p_venue_id: venueId,
        });

        if (!error) {
          completedCount++;
          // Trigger cleanup
          const { cleanupTableOnOrderCompletion } = await import("@/lib/table-cleanup");
          await cleanupTableOnOrderCompletion({
            venueId,
            tableId: order.table_id || undefined,
            tableNumber: order.table_number?.toString() || undefined,
          });
        }
      } catch (err) {
        trackOrderError(err, { venueId, orderId: order.id, action: "bulkComplete" });
      }
    }

    await this.invalidateCachePattern(`orders:*:${venueId}:*`);
    await this.invalidateCachePattern(`tables:*:${venueId}:*`);
    
    return completedCount;
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

  /**
   * Get order by ID (Public - no venue filter)
   * Use carefully for public tracking
   */
  async getOrderByIdPublic(orderId: string): Promise<Order | null> {
    const cacheKey = this.getCacheKey("orders:public", orderId);

    return this.withCache(
      cacheKey,
      async () => {
        const supabase = await createSupabaseClient();
        const { data, error } = await supabase
          .from("orders")
          .select("*")
          .eq("id", orderId)
          .maybeSingle();

        if (error) throw error;
        return data;
      },
      30
    ); // Short cache for public tracking
  }
}

// Export singleton instance
export const orderService = new OrderService();
