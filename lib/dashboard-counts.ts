/**
 * Server-side dashboard counts. Use this instead of the Supabase RPC dashboard_counts
 * so the app works even when the RPC is missing (e.g. after Security Advisor script runs).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { todayWindowForTZ } from "@/lib/time";
import { normalizeVenueId } from "@/lib/utils/venueId";

export interface DashboardCountsResult {
  live_count: number;
  earlier_today_count: number;
  history_count: number;
  today_orders_count: number;
  active_tables_count: number;
  tables_set_up: number;
  tables_in_use: number;
  tables_reserved_now: number;
}

export async function getDashboardCounts(
  supabase: SupabaseClient,
  options: {
    venueId: string;
    tz?: string;
    liveWindowMins?: number;
  }
): Promise<DashboardCountsResult> {
  const normalizedVenueId = normalizeVenueId(options.venueId) ?? options.venueId;
  const tz = options.tz ?? "Europe/London";
  const liveWindowMins = options.liveWindowMins ?? 30;

  const window = todayWindowForTZ(tz);
  const now = new Date();
  const liveStart = new Date(now.getTime() - liveWindowMins * 60 * 1000);

  const [tablesRes, sessionsRes, reservationsRes, ordersTodayRes, ordersLiveRes, ordersHistoryRes] =
    await Promise.all([
      supabase.from("tables").select("id, is_active").eq("venue_id", normalizedVenueId),
      supabase
        .from("table_sessions")
        .select("id")
        .eq("venue_id", normalizedVenueId)
        .eq("status", "OCCUPIED")
        .is("closed_at", null),
      supabase
        .from("reservations")
        .select("id")
        .eq("venue_id", normalizedVenueId)
        .eq("status", "BOOKED")
        .lte("start_at", now.toISOString())
        .gte("end_at", now.toISOString()),
      supabase
        .from("orders")
        .select("id, created_at")
        .eq("venue_id", normalizedVenueId)
        .gte("created_at", window.startUtcISO)
        .lt("created_at", window.endUtcISO)
        .neq("order_status", "CANCELLED")
        .neq("order_status", "REFUNDED"),
      supabase
        .from("orders")
        .select("id")
        .eq("venue_id", normalizedVenueId)
        .gte("created_at", liveStart.toISOString())
        .lte("created_at", now.toISOString())
        .neq("order_status", "CANCELLED")
        .neq("order_status", "REFUNDED"),
      supabase
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("venue_id", normalizedVenueId)
        .lt("created_at", window.startUtcISO)
        .neq("order_status", "CANCELLED")
        .neq("order_status", "REFUNDED"),
    ]);

  const allTables = tablesRes.data ?? [];
  const activeTables = allTables.filter((t) => t.is_active === true);
  const todayOrders = ordersTodayRes.data ?? [];
  const liveOrders = ordersLiveRes.data ?? [];
  const earlierTodayCount = Math.max(0, todayOrders.length - liveOrders.length);
  const historyCount = ordersHistoryRes.count ?? 0;

  return {
    live_count: liveOrders.length,
    earlier_today_count: earlierTodayCount,
    history_count: historyCount,
    today_orders_count: todayOrders.length,
    active_tables_count: activeTables.length,
    tables_set_up: activeTables.length,
    tables_in_use: (sessionsRes.data ?? []).length,
    tables_reserved_now: (reservationsRes.data ?? []).length,
  };
}
