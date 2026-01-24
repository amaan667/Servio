/**
 * Table Service
 * Handles all table and session-related business logic
 */

import { BaseService } from "./BaseService";
import { createSupabaseClient } from "@/lib/supabase";

export interface Table {
  id: string;
  venue_id: string;
  table_number: number;
  label: string;
  section?: string | null;
  seat_count: number;
  status: string;
  is_active: boolean;
  qr_code_url?: string | null;
  created_at: string;
  updated_at: string;
}

export interface TableSession {
  id: string;
  venue_id: string;
  table_id: string;
  status: string;
  opened_at: string;
  closed_at?: string | null;
  order_id?: string | null;
}

export class TableService extends BaseService {
  /**
   * Get all tables for a venue
   */
  async getTables(venueId: string): Promise<Table[]> {
    const cacheKey = this.getCacheKey("tables:list", venueId);

    return this.withCache(
      cacheKey,
      async () => {
        const supabase = await createSupabaseClient();
        const { data, error } = await supabase
          .from("tables")
          .select("*")
          .eq("venue_id", venueId)
          .eq("is_active", true)
          .order("table_number", { ascending: true });

        if (error) throw error;
        return data || [];
      },
      300
    );
  }

  /**
   * Get a single table by ID
   */
  async getTable(tableId: string, venueId: string): Promise<Table | null> {
    const cacheKey = this.getCacheKey("tables:item", venueId, tableId);

    return this.withCache(
      cacheKey,
      async () => {
        const supabase = await createSupabaseClient();
        const { data, error } = await supabase
          .from("tables")
          .select("*")
          .eq("id", tableId)
          .eq("venue_id", venueId)
          .single();

        if (error) throw error;
        return data;
      },
      300
    );
  }

  /**
   * Create a new table
   */
  async createTable(
    venueId: string,
    tableData: Omit<Table, "id" | "venue_id" | "created_at" | "updated_at" | "status" | "is_active">
  ): Promise<Table> {
    const supabase = await createSupabaseClient();
    const { data, error } = await supabase
      .from("tables")
      .insert({
        ...tableData,
        venue_id: venueId,
        status: "available",
        is_active: true,
      })
      .select()
      .single();

    if (error) throw error;

    await this.invalidateCachePattern(`tables:*:${venueId}:*`);
    return data;
  }

  /**
   * Update table details
   */
  async updateTable(
    tableId: string,
    venueId: string,
    updates: Partial<Omit<Table, "id" | "venue_id" | "created_at">>
  ): Promise<Table> {
    const supabase = await createSupabaseClient();
    const { data, error } = await supabase
      .from("tables")
      .update(updates)
      .eq("id", tableId)
      .eq("venue_id", venueId)
      .select()
      .single();

    if (error) throw error;

    await this.invalidateCachePattern(`tables:*:${venueId}:*`);
    return data;
  }

  /**
   * Close a table (atomic via RPC)
   */
  async closeTable(tableId: string, venueId: string): Promise<void> {
    const supabase = await createSupabaseClient();
    const { error } = await supabase.rpc("api_close_table", {
      p_table_id: tableId,
      p_venue_id: venueId,
    });

    if (error) throw error;
    await this.invalidateCachePattern(`tables:*:${venueId}:*`);
  }

  /**
   * Seat a party at a table (atomic via RPC)
   */
  async seatTable(
    tableId: string, 
    venueId: string, 
    partySize: number, 
    customerName?: string
  ): Promise<void> {
    const supabase = await createSupabaseClient();
    const { error } = await supabase.rpc("api_seat_party", {
      p_table_id: tableId,
      p_venue_id: venueId,
      p_party_size: partySize,
      p_customer_name: customerName || null,
    });

    if (error) throw error;
    await this.invalidateCachePattern(`tables:*:${venueId}:*`);
  }

  /**
   * Get tables with their current active sessions and order status
   */
  async getTablesWithState(venueId: string): Promise<(Table & {
    table_id: string;
    session_id: string | null;
    order_id: string | null;
    order_status: string | null;
    completion_status: string | null;
    opened_at: string | null;
  })[]> {
    const supabase = await createSupabaseClient();

    // 1. Fetch all active tables
    const { data: tables, error: tablesError } = await supabase
      .from("tables")
      .select("*")
      .eq("venue_id", venueId)
      .eq("is_active", true)
      .order("label", { ascending: true });

    if (tablesError) throw tablesError;
    if (!tables || tables.length === 0) return [];

    // 2. Get active sessions
    const { data: sessions, error: sessionsError } = await supabase
      .from("table_sessions")
      .select("*")
      .eq("venue_id", venueId)
      .in("table_id", tables.map((t) => t.id))
      .is("closed_at", null);

    if (sessionsError) throw sessionsError;

    // 3. Get order statuses for active sessions
    const sessionOrderIds = (sessions || [])
      .map((s) => s.order_id)
      .filter((id): id is string => !!id);

    let orderMap: Record<string, Record<string, unknown>> = {};
    if (sessionOrderIds.length > 0) {
      const { data: orders } = await supabase
        .from("orders")
        .select("id, completion_status, order_status")
        .in("id", sessionOrderIds)
        .eq("venue_id", venueId);

      if (orders) {
        orderMap = orders.reduce((acc, order) => {
          acc[order.id] = order as Record<string, unknown>;
          return acc;
        }, {} as Record<string, Record<string, unknown>>);
      }
    }

    // 4. Combine and Cleanup
    const result = tables.map((table) => {
      const session = sessions?.find((s) => s.table_id === table.id);
      const order = session?.order_id ? orderMap[session.order_id] : null;
      
      const isOrderCompleted = 
        order?.completion_status?.toUpperCase() === "COMPLETED" ||
        ["COMPLETED", "CANCELLED", "REFUNDED", "EXPIRED"].includes(order?.order_status?.toUpperCase());

      // If order is completed, table is effectively FREE
      const status = isOrderCompleted ? "FREE" : (session?.status || "FREE");

      return {
        ...table,
        table_id: table.id,
        session_id: isOrderCompleted ? null : (session?.id || null),
        status,
        order_id: isOrderCompleted ? null : (session?.order_id || null),
        order_status: isOrderCompleted ? null : (order?.order_status || null),
        completion_status: order?.completion_status || null,
        opened_at: isOrderCompleted ? null : (session?.opened_at || null),
      };
    });

    return result;
  }
}

export const tableService = new TableService();
