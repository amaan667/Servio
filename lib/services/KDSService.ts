/**
 * KDS Service
 * Handles all Kitchen Display System business logic, tickets, and stations
 */

import { BaseService } from "./BaseService";
import { createSupabaseClient, createClient } from "@/lib/supabase";
import { createKDSTicketsWithAI } from "@/lib/orders/kds-tickets-unified";
import { trackOrderError } from "@/lib/monitoring/error-tracking";

export interface KDSTicket {
  id: string;
  venue_id: string;
  order_id: string;
  station_id: string;
  status: "new" | "in_progress" | "preparing" | "ready" | "bumped" | "served" | "cancelled";
  items: Record<string, unknown>[];
  created_at: string;
  started_at?: string | null;
  ready_at?: string | null;
  bumped_at?: string | null;
}

export class KDSService extends BaseService {
  /**
   * Get KDS tickets with their associated station and order info
   */
  async getTickets(
    venueId: string,
    filters?: { station_id?: string; status?: string }
  ): Promise<Record<string, unknown>[]> {
    const supabase = await createSupabaseClient();

    // CRITICAL: Don't filter by completion_status - tickets should show regardless of order completion status
    // Only filter by bumped status (handled in client-side filtering)
    let query = supabase
      .from("kds_tickets")
      .select(
        `
        *,
        kds_stations (id, station_name, station_type, color_code),
        orders (id, customer_name, order_status, kitchen_status, service_status, completion_status, payment_method, payment_status)
      `
      )
      .eq("venue_id", venueId)
      .neq("status", "bumped") // Exclude bumped tickets - they move to Live Orders
      .order("created_at", { ascending: false });

    if (filters?.station_id) query = query.eq("station_id", filters.station_id);
    if (filters?.status) query = query.eq("status", filters.status);

    const { data, error } = await query;
    if (error) throw error;
    return (data as unknown as Record<string, unknown>[]) || [];
  }

  /**
   * Update ticket status and handle order coordination.
   * Returns full ticket so clients can update UI without refetch.
   */
  async updateTicketStatus(
    ticketId: string,
    venueId: string,
    status: string
  ): Promise<Record<string, unknown> & { order_id: string }> {
    const supabase = await createSupabaseClient();
    const now = new Date().toISOString();

    const updateData: Record<string, unknown> = {
      status,
      updated_at: now,
    };

    if (status === "ready") updateData.ready_at = now;
    else if (status === "preparing" || status === "in_progress") updateData.started_at = now;
    else if (status === "bumped") updateData.bumped_at = now;

    // 1. Update the ticket and return full row for UI
    const { data: ticket, error: updateError } = await supabase
      .from("kds_tickets")
      .update(updateData)
      .eq("id", ticketId)
      .eq("venue_id", venueId)
      .select("*")
      .single();

    if (updateError) throw updateError;

    // 2. Coordinate with order if bumped
    if (status === "bumped" && ticket?.order_id) {
      const { data: allTickets } = await supabase
        .from("kds_tickets")
        .select("status")
        .eq("order_id", ticket.order_id);

      const allBumped = allTickets?.every((t) => t.status === "bumped");
      if (allBumped) {
        await supabase.rpc("orders_set_kitchen_bumped", {
          p_order_id: ticket.order_id,
          p_venue_id: venueId,
        });
      }
    }

    return ticket as Record<string, unknown> & { order_id: string };
  }

  /**
   * Auto-backfill missing KDS tickets for open orders
   */
  async autoBackfill(venueId: string): Promise<number> {
    const adminSupabase = await createClient();

    // 1. Get open orders
    const { data: openOrders } = await adminSupabase
      .from("orders")
      .select("id, payment_method, payment_status, items, customer_name, table_number, table_id")
      .eq("venue_id", venueId)
      .eq("completion_status", "OPEN");

    if (!openOrders || openOrders.length === 0) return 0;

    // 2. Get existing ticket IDs
    const { data: existingTickets } = await adminSupabase
      .from("kds_tickets")
      .select("order_id")
      .eq("venue_id", venueId);

    const existingOrderIds = new Set(existingTickets?.map((t) => t.order_id));

    // 3. Create missing tickets
    let createdCount = 0;
    for (const order of openOrders) {
      if (existingOrderIds.has(order.id)) continue;

      // Skip unpaid PAY_NOW
      if (order.payment_method === "PAY_NOW" && order.payment_status !== "PAID") continue;

      try {
        await createKDSTicketsWithAI(adminSupabase, {
          id: order.id,
          venue_id: venueId,
          items: order.items as Record<string, unknown>[],
          customer_name: order.customer_name || "",
          table_number: order.table_number,
          table_id: order.table_id,
        });
        createdCount++;
      } catch (err) {
        trackOrderError(err, { venueId, orderId: order.id, action: "autoBackfill" });
      }
    }

    return createdCount;
  }
}

export const kdsService = new KDSService();
