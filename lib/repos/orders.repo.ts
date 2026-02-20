/**
 * _OrderRepos Repository
 * Centralized data access for orders
 */

import { createServerSupabase } from "@/lib/supabase";
import type { Database } from "@/types/database";

type OrderInsert = Database["public"]["Tables"]["orders"]["Insert"];
type OrderUpdate = Database["public"]["Tables"]["orders"]["Update"];
type OrderStatus = NonNullable<OrderUpdate["order_status"]>;
type OrderPaymentStatus = Database["public"]["Tables"]["orders"]["Update"]["payment_status"];

export class OrdersRepo {
  /**
   * Get orders by venue
   */
  static async listByVenue(
    venueId: string,
    options?: {
      status?: string;
      limit?: number;
      offset?: number;
    }
  ) {
    const supabase = await createServerSupabase();

    let query = supabase
      .from("orders")
      .select("*")
      .eq("venue_id", venueId)
      .order("created_at", { ascending: false });

    if (options?.status) {
      query = query.eq("order_status", options.status);
    }

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    if (options?.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 10) - 1);
    }

    return query;
  }

  /**
   * Get order by ID
   */
  static async findById(orderId: string) {
    const supabase = await createServerSupabase();
    return supabase.from("orders").select("*").eq("id", orderId).single();
  }

  /**
   * Get orders by table ID
   */
  static async listByTable(tableId: string) {
    const supabase = await createServerSupabase();
    return supabase
      .from("orders")
      .select("*")
      .eq("table_id", tableId)
      .order("created_at", { ascending: false });
  }

  /**
   * Get orders by session ID
   */
  static async listBySession(sessionId: string) {
    const supabase = await createServerSupabase();
    return supabase
      .from("orders")
      .select("*")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: false });
  }

  /**
   * Create new order
   */
  static async create(order: OrderInsert) {
    const supabase = await createServerSupabase();
    return supabase.from("orders").insert(order).select().single();
  }

  /**
   * Update order
   */
  static async update(orderId: string, updates: OrderUpdate) {
    const supabase = await createServerSupabase();
    return supabase.from("orders").update(updates).eq("id", orderId).select().single();
  }

  /**
   * Update order status
   */
  static async updateStatus(orderId: string, status: OrderStatus) {
    return this.update(orderId, { order_status: status });
  }

  /**
   * Update payment status
   */
  static async updatePaymentStatus(orderId: string, paymentStatus: OrderPaymentStatus) {
    return this.update(orderId, { payment_status: paymentStatus });
  }

  /**
   * Delete order
   */
  static async delete(orderId: string) {
    const supabase = await createServerSupabase();
    return supabase.from("orders").delete().eq("id", orderId);
  }

  /**
   * Get orders count by venue
   */
  static async countByVenue(venueId: string, status?: string) {
    const supabase = await createServerSupabase();

    let query = supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("venue_id", venueId);

    if (status) {
      query = query.eq("order_status", status);
    }

    return query;
  }

  /**
   * Get today's orders by venue
   */
  static async listTodayByVenue(venueId: string, _timezone: string = "UTC") {
    const supabase = await createServerSupabase();
    const today = new Date().toISOString().split("T")[0];

    return supabase
      .from("orders")
      .select("*")
      .eq("venue_id", venueId)
      .gte("created_at", `${today}T00:00:00.000Z`)
      .lt("created_at", `${today}T23:59:59.999Z`)
      .order("created_at", { ascending: false });
  }
}
