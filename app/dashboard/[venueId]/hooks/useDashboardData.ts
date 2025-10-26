import { useState, useEffect, useCallback } from "react";
import { supabaseBrowser as createClient } from "@/lib/supabase";
import { withSupabaseRetry } from "@/lib/retry";
import { todayWindowForTZ } from "@/lib/time";

export interface DashboardCounts {
  live_count: number;
  earlier_today_count: number;
  history_count: number;
  today_orders_count: number;
  active_tables_count: number;
  tables_set_up: number;
  tables_in_use: number;
  tables_reserved_now: number;
}

export interface DashboardStats {
  revenue: number;
  menuItems: number;
  unpaid: number;
}

export function useDashboardData(
  venueId: string,
  venueTz: string,
  initialVenue: unknown,
  initialCounts?: DashboardCounts,
  initialStats?: DashboardStats
) {
  // Cache dashboard data to prevent flicker when navigating back
  const getCachedCounts = () => {
    if (typeof window === "undefined") return null;
    const cached = sessionStorage.getItem(`dashboard_counts_${venueId}`);
    return cached ? JSON.parse(cached) : null;
  };

  const getCachedStats = () => {
    if (typeof window === "undefined") return null;
    const cached = sessionStorage.getItem(`dashboard_stats_${venueId}`);
    return cached ? JSON.parse(cached) : null;
  };

  const [venue, setVenue] = useState<unknown>(initialVenue);
  const [loading, setLoading] = useState(false); // Start with false to prevent flicker

  // If we have initial data from server, use it immediately (no 0 flicker!)
  // Otherwise use cached data, or null (will load immediately)
  const [counts, setCounts] = useState<DashboardCounts>(
    initialCounts ||
      getCachedCounts() || {
        live_count: 0,
        earlier_today_count: 0,
        history_count: 0,
        today_orders_count: 0,
        active_tables_count: 0,
        tables_set_up: 0,
        tables_in_use: 0,
        tables_reserved_now: 0,
      }
  );

  // Start with cached stats OR initial stats from server (no 0 flicker!)
  const initialStatsValue = initialStats || getCachedStats();
  const [stats, setStats] = useState<DashboardStats>(
    initialStatsValue || { revenue: 0, menuItems: 0, unpaid: 0 }
  );
  const [todayWindow, setTodayWindow] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);

  const loadStats = useCallback(
    async (venueId: string, window: { startUtcISO: string; endUtcISO: string }) => {
      try {
        const supabase = createClient();

        const { data: orders } = await supabase
          .from("orders")
          .select("total_amount, order_status")
          .eq("venue_id", venueId)
          .gte("created_at", window.startUtcISO)
          .lt("created_at", window.endUtcISO)
          .neq("order_status", "CANCELLED");

        const { data: menuItems } = await supabase
          .from("menu_items")
          .select("id")
          .eq("venue_id", venueId)
          .eq("is_available", true);

        const revenue = orders?.reduce((sum, order) => sum + (order.total_amount || 0), 0) || 0;
        const unpaid = orders?.filter((o) => o.order_status === "UNPAID").length || 0;

        const newStats = {
          revenue,
          menuItems: menuItems?.length || 0,
          unpaid,
        };
        setStats(newStats);
        // Cache the stats to prevent flicker
        if (typeof window !== "undefined") {
          sessionStorage.setItem(`dashboard_stats_${venueId}`, JSON.stringify(newStats));
        }
      } catch (err) {
        console.error("Failed to load stats:", err);
      }
    },
    []
  );

  const refreshCounts = useCallback(async () => {
    try {
      setError(null);
      const supabase = createClient();

      const { data: newCounts, error } = await withSupabaseRetry(() =>
        supabase
          .rpc("dashboard_counts", {
            p_venue_id: venueId,
            p_tz: venueTz,
            p_live_window_mins: 30,
          })
          .single()
      );

      if (error) {
        setError("Failed to refresh dashboard data");
        return;
      }

      const { data: tableCounters } = await withSupabaseRetry(() =>
        supabase.rpc("api_table_counters", {
          p_venue_id: venueId,
        })
      );

      if (newCounts && typeof newCounts === "object") {
        const counts = newCounts as DashboardCounts;

        const finalCounts =
          tableCounters && Array.isArray(tableCounters) && tableCounters.length > 0
            ? {
                ...counts,
                tables_set_up: tableCounters[0].tables_set_up || 0,
                tables_in_use: tableCounters[0].tables_in_use || 0,
                tables_reserved_now: tableCounters[0].tables_reserved_now || 0,
                active_tables_count: tableCounters[0].active_tables_count || 0,
              }
            : counts;

        setCounts(finalCounts);
        // Cache the counts to prevent flicker
        if (typeof window !== "undefined") {
          sessionStorage.setItem(`dashboard_counts_${venueId}`, JSON.stringify(finalCounts));
        }
      }
    } catch (err) {
      console.error("Failed to refresh dashboard data:", err);
      setError("Failed to refresh dashboard data");
    }
  }, [venueId, venueTz]);

  const updateRevenueIncrementally = useCallback(
    (order: { order_status: string; total_amount?: number }) => {
      if (order.order_status !== "CANCELLED" && order.total_amount) {
        setStats((prev) => ({
          ...prev,
          revenue: prev.revenue + order.total_amount,
        }));
      }
    },
    []
  );

  useEffect(() => {
    if (!venue) return;

    const window = todayWindowForTZ(venueTz);
    setTodayWindow(window);

    // NEVER fetch on initial load - ALWAYS use server-side data
    // This prevents ALL flickering
    console.info("[DASHBOARD] Using server-side initial data exclusively");
    console.info("[DASHBOARD] Has initial counts:", !!initialCounts);
    console.info("[DASHBOARD] Has initial stats:", !!initialStats);
    console.info("[DASHBOARD] Counts:", initialCounts);
    console.info("[DASHBOARD] Stats:", initialStats);

    // Only mark as loaded, never fetch
    setLoading(false);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [venue]);

  return {
    venue,
    setVenue,
    loading,
    setLoading,
    counts,
    setCounts,
    stats,
    setStats,
    todayWindow,
    error,
    setError,
    refreshCounts,
    loadStats,
    updateRevenueIncrementally,
  };
}
