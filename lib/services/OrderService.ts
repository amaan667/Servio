/**
 * Order Service
 * Handles all order-related business logic
 *
 * Refactored with:
 * - Type-safe constants
 * - Zod validation
 * - Standardized error handling
 * - Cache invalidation helper
 * - Parallel bulk operations
 */

import { BaseService } from "./BaseService";
import { createSupabaseClient } from "@/lib/supabase";
import { trackOrderError } from "@/lib/monitoring/error-tracking";
import { logger } from "@/lib/monitoring/structured-logger";

// Import constants and types
import { OrderStatus, PaymentStatus, PaymentMode, OrderDefaults } from "@/lib/orders/constants";
import { validateCreateOrderInput } from "@/lib/orders/validation";
import { wrapSupabaseError, wrapNotFoundError } from "@/lib/orders/errors";

export interface OrderItem {
  menu_item_id: string | null;
  item_name: string;
  quantity: number;
  price: number;
  special_instructions?: string | null;
  modifiers?: Record<string, unknown>[];
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
  // ========================================================================
  // Private Helper Methods
  // ========================================================================

  /**
   * Private cache invalidation helper
   * Ensures consistent cache key patterns across all methods
   */
  private async invalidateOrderCache(venueId: string): Promise<void> {
    await this.invalidateCachePattern(`orders:*:${venueId}:*`);
  }

  /**
   * Determine fulfillment type from source
   */
  private getFulfillmentType(source?: string, explicitType?: string): string {
    if (explicitType) return explicitType;
    return source === "counter" ? "counter" : "table";
  }

  /**
   * Determine payment mode from payment method
   */
  private getPaymentMode(method?: string): string {
    const paymentMethod = method ?? OrderDefaults.PAYMENT_METHOD;
    if (paymentMethod === "PAY_NOW") return PaymentMode.ONLINE;
    if (paymentMethod === "PAY_AT_TILL") return PaymentMode.OFFLINE;
    if (paymentMethod === "PAY_LATER") return PaymentMode.DEFERRED;
    return PaymentMode.ONLINE;
  }

  // ========================================================================
  // Read Operations
  // ========================================================================

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

        // Apply filters
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
        return (data as unknown as Order[]) || [];
      },
      60
    );
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
   * Get order by ID (Public - no venue filter)
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
    );
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

  // ========================================================================
  // Write Operations
  // ========================================================================

  /**
   * Create order using validated input
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
    // Validate input using Zod schema
    const validatedData = validateCreateOrderInput(orderData);

    const supabase = await createSupabaseClient();

    // Determine fulfillment_type from source if not provided
    const fulfillmentType = this.getFulfillmentType(orderData.source, orderData.fulfillment_type);

    // Standardize table number
    const tableNumber =
      fulfillmentType === "table"
        ? typeof orderData.table_number === "string"
          ? parseInt(orderData.table_number)
          : orderData.table_number
        : null;

    // Calculate payment_mode based on payment method
    const paymentMode = this.getPaymentMode(orderData.payment_method);

    const insertPayload = {
      venue_id: venueId,
      table_number: tableNumber,
      customer_name: validatedData.customer_name,
      customer_phone: validatedData.customer_phone,
      customer_email: validatedData.customer_email ?? null,
      items: validatedData.items,
      total_amount: validatedData.total_amount,
      notes: validatedData.notes ?? null,
      order_status: validatedData.order_status || OrderDefaults.STATUS,
      payment_status: validatedData.payment_status || OrderDefaults.PAYMENT_STATUS,
      payment_method: validatedData.payment_method || OrderDefaults.PAYMENT_METHOD,
      payment_mode: paymentMode,
      source: validatedData.source || OrderDefaults.SOURCE,
      fulfillment_type: fulfillmentType,
      counter_label: fulfillmentType === "counter" ? (orderData.counter_label ?? null) : null,
      qr_type: orderData.qr_type ?? null,
      requires_collection: orderData.requires_collection ?? OrderDefaults.REQUIRES_COLLECTION,
    };

    // Direct insert - don't use .single() as it fails when no rows returned
    const { data: insertedRows, error } = await supabase
      .from("orders")
      .insert(insertPayload)
      .select("*");

    if (error) {
      trackOrderError(error, { venueId, action: "createOrder" });
      throw wrapSupabaseError(error, { venueId, action: "createOrder" });
    }

    // Handle array response - take first row
    const data = Array.isArray(insertedRows) ? insertedRows[0] : insertedRows;

    if (!data) {
      throw wrapSupabaseError(new Error("No data returned from insert"), {
        venueId,
        action: "createOrder",
      });
    }

    // Invalidate cache
    await this.invalidateOrderCache(venueId);

    return data as Order & { table_auto_created?: boolean; session_id?: string };
  }

  /**
   * Update order status with standardized error handling
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

    if (error) {
      throw wrapSupabaseError(error, { orderId, venueId, status });
    }

    if (!data) {
      throw wrapNotFoundError("Order", orderId, { venueId });
    }

    // Invalidate cache
    await this.invalidateOrderCache(venueId);

    return data as Order;
  }

  /**
   * Force-complete an order (fallback when RPC fails)
   */
  async forceCompleteOrder(orderId: string, venueId: string): Promise<Order> {
    const supabase = await createSupabaseClient();
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from("orders")
      .update({
        order_status: OrderStatus.COMPLETED,
        payment_status: PaymentStatus.PAID,
        served_at: now,
        completed_at: now,
        updated_at: now,
      })
      .eq("id", orderId)
      .eq("venue_id", venueId)
      .select()
      .single();

    if (error) {
      throw wrapSupabaseError(error, { orderId, venueId, action: "forceComplete" });
    }

    if (!data) {
      throw wrapNotFoundError("Order", orderId, { venueId });
    }

    await this.invalidateOrderCache(venueId);

    return data as Order;
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

    if (error) {
      throw wrapSupabaseError(error, { orderId, venueId, paymentStatus });
    }

    // Invalidate cache
    await this.invalidateOrderCache(venueId);

    return data as Order;
  }

  /**
   * Mark order as served (RPC first, fallback to direct update)
   */
  async markServed(orderId: string, venueId: string): Promise<Order> {
    const supabase = await createSupabaseClient();

    const { data, error } = await supabase.rpc("orders_set_served", {
      p_order_id: orderId,
      p_venue_id: venueId,
    });

    if (!error && data) {
      const result = Array.isArray(data) ? data[0] : data;
      await this.invalidateOrderCache(venueId);
      return result as Order;
    }

    // Fallback: direct update so serve always succeeds
    const { data: updated, error: updateError } = await supabase
      .from("orders")
      .update({
        order_status: OrderStatus.SERVED,
        served_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", orderId)
      .eq("venue_id", venueId)
      .select()
      .single();

    if (updateError) {
      throw wrapSupabaseError(updateError, { orderId, venueId, action: "markServed" });
    }

    await supabase
      .from("table_sessions")
      .update({ status: OrderStatus.SERVED, updated_at: new Date().toISOString() })
      .eq("order_id", orderId)
      .eq("venue_id", venueId);

    await this.invalidateOrderCache(venueId);
    return updated as Order;
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

    // 3. Deduct inventory (best-effort: don't fail completion if RPC missing or errors)
    try {
      await supabase.rpc("deduct_stock_for_order", {
        p_order_id: orderId,
        p_venue_id: venueId,
      });
    } catch (invErr) {
      logger.info("[completeOrder] deduct_stock_for_order skipped", {
        orderId,
        venueId,
        error: invErr instanceof Error ? invErr.message : String(invErr),
      });
    }

    await this.invalidateOrderCache(venueId);
    await this.invalidateCachePattern(`tables:*:${venueId}:*`);

    return order;
  }

  /**
   * Cancel order
   */
  async cancelOrder(orderId: string, venueId: string): Promise<Order> {
    return this.updateOrderStatus(orderId, venueId, OrderStatus.CANCELLED);
  }

  // ========================================================================
  // Bulk Operations (Fixed: Uses Promise.all for parallel execution)
  // ========================================================================

  /**
   * Bulk complete orders with parallel execution
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

    // 2. Filter out already COMPLETED orders
    const ordersToComplete = orders.filter((o) => o.order_status !== OrderStatus.COMPLETED);

    if (ordersToComplete.length === 0) {
      return 0;
    }

    // 3. Execute completions in parallel for better performance
    const completionPromises = ordersToComplete.map(async (order) => {
      try {
        // Call RPC (fire and forget - we handle errors in the promise)
        await supabase.rpc("orders_complete", {
          p_order_id: order.id,
          p_venue_id: venueId,
          p_forced: true,
          p_forced_by: null,
          p_forced_reason: "Bulk complete all",
        });
      } catch (rpcErr) {
        logger.info("[bulkCompleteOrders] RPC exception", {
          orderId: order.id,
          err: String(rpcErr),
        });
      }

      // Force complete (sets COMPLETED + PAID)
      await this.forceCompleteOrder(order.id, venueId);

      // Trigger table cleanup
      const { cleanupTableOnOrderCompletion } = await import("@/lib/table-cleanup");
      await cleanupTableOnOrderCompletion({
        venueId,
        tableId: order.table_id || undefined,
        tableNumber: order.table_number?.toString() || undefined,
      });

      return order.id;
    });

    // Wait for all completions
    await Promise.all(completionPromises);

    // Invalidate caches
    await this.invalidateOrderCache(venueId);
    await this.invalidateCachePattern(`tables:*:${venueId}:*`);

    return ordersToComplete.length;
  }
}

// Export singleton instance
export const orderService = new OrderService();
