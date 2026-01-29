/**
 * @fileoverview Order repository for database operations
 * @module lib/repositories/order-repository
 */

import { BaseRepository } from "./base-repository";
import { SupabaseClient } from "@supabase/supabase-js";

export interface Order {
  id: string;
  venue_id: string;
  table_number?: string;
  table_id?: string;
  customer_name?: string;
  customer_phone?: string;
  customer_email?: string;
  items: OrderItem[];
  status: "pending" | "confirmed" | "preparing" | "ready" | "served" | "completed" | "cancelled";
  payment_method: string;
  payment_status: "pending" | "paid" | "failed" | "refunded";
  total_amount: number;
  tax_amount?: number;
  tip_amount?: number;
  special_instructions?: string;
  session_id?: string;
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  menu_item_id: string;
  item_name: string;
  quantity: number;
  price: number;
  special_instructions?: string;
  modifiers?: Array<{ name: string; price: number }>;
}

export interface OrderStats {
  total: number;
  revenue: number;
  avgOrderValue: number;
  byStatus: Record<string, number>;
}

export class OrderRepository extends BaseRepository<Order> {
  protected tableName = "orders";

  constructor(supabase: SupabaseClient) {
    super(supabase);
  }

  /**
   * Find orders by venue ID
   */
  async findByVenue(venueId: string, status?: string, limit: number = 100): Promise<Order[]> {
    try {
      let query = this.supabase
        .from(this.tableName)
        .select("*")
        .eq("venue_id", venueId)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (status) {
        query = query.eq("status", status);
      }

      const { data, error } = await query;

      if (error) {
        throw error;
      }

      return (data as Order[]) || [];
    } catch (err) {
      throw err;
    }
  }

  /**
   * Find orders by table
   */
  async findByTable(venueId: string, tableId: string): Promise<Order[]> {
    return this.findAll(
      {
        venue_id: venueId,
        table_id: tableId,
      } as Partial<Order>,
      {
        orderBy: { column: "created_at", ascending: false },
      }
    );
  }

  /**
   * Find orders by session ID
   */
  async findBySession(sessionId: string): Promise<Order[]> {
    return this.findAll(
      {
        session_id: sessionId,
      } as Partial<Order>,
      {
        orderBy: { column: "created_at", ascending: false },
      }
    );
  }

  /**
   * Find recent orders
   */
  async findRecent(venueId: string, hours: number = 24, limit: number = 50): Promise<Order[]> {
    try {
      const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

      const { data, error } = await this.supabase
        .from(this.tableName)
        .select("*")
        .eq("venue_id", venueId)
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) {
        throw error;
      }

      return (data as Order[]) || [];
    } catch (_error) {
      throw _error;
    }
  }

  /**
   * Update order status
   */
  async updateStatus(
    orderId: string,
    status: Order["status"],
    _notes?: string
  ): Promise<Order | null> {
    const updateData: Partial<Order> = {
      status,
      updated_at: new Date().toISOString(),
    } as Partial<Order>;

    return this.update(orderId, updateData);
  }

  /**
   * Mark order as paid
   */
  async markAsPaid(orderId: string, paymentMethod: string): Promise<Order | null> {
    return this.update(orderId, {
      payment_status: "paid",
      payment_method: paymentMethod,
      updated_at: new Date().toISOString(),
    } as Partial<Order>);
  }

  /**
   * Get order statistics for a venue
   */
  async getStats(venueId: string, startDate?: string, endDate?: string): Promise<OrderStats> {
    try {
      let query = this.supabase
        .from(this.tableName)
        .select("status, total_amount")
        .eq("venue_id", venueId);

      if (startDate) {
        query = query.gte("created_at", startDate);
      }
      if (endDate) {
        query = query.lte("created_at", endDate);
      }

      const { data, error } = await query;

      if (error) {
        throw error;
      }

      const orders = data as Array<{ status: string; total_amount: number }>;
      const total = orders.length;
      const revenue = orders.reduce((sum, order) => sum + order.total_amount, 0);
      const avgOrderValue = total > 0 ? revenue / total : 0;
      const byStatus: Record<string, number> = {
        /* Empty */
      };

      orders.forEach((order) => {
        byStatus[order.status] = (byStatus[order.status] || 0) + 1;
      });

      return {
        total,
        revenue,
        avgOrderValue,
        byStatus,
      };
    } catch (_error) {
      throw _error;
    }
  }

  /**
   * Bulk update order statuses
   */
  async bulkUpdateStatus(orderIds: string[], status: Order["status"]): Promise<Order[]> {
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .update({
          status,
          updated_at: new Date().toISOString(),
        })
        .in("id", orderIds)
        .select();

      if (error) {
        throw error;
      }

      return (data as Order[]) || [];
    } catch (_error) {
      throw _error;
    }
  }

  /**
   * Search orders by customer info or order ID
   */
  async search(venueId: string, query: string): Promise<Order[]> {
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .select("*")
        .eq("venue_id", venueId)
        .or(`customer_name.ilike.%${query}%,customer_phone.ilike.%${query}%,id.eq.${query}`)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) {
        throw error;
      }

      return (data as Order[]) || [];
    } catch (_error) {
      throw _error;
    }
  }
}
