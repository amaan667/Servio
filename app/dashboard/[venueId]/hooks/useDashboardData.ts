import { useState, useEffect, useCallback } from "react";
import { supabaseBrowser as createClient } from "@/lib/supabase";
import { logger } from "@/lib/logger";
import { todayWindowForTZ } from "@/lib/time";
import { fetchMenuItemCount } from "@/lib/counts/unified-counts";

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
  const [venue, setVenue] = useState<unknown>(initialVenue);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [todayWindow, setTodayWindow] = useState<{ startUtcISO: string; endUtcISO: string } | null>(null);

  // Initialize with server data if available, otherwise defaults
  const [counts, setCounts] = useState<DashboardCounts>(() => {
    if (initialCounts) {
      return initialCounts;
    }
    return {
      live_count: 0,
      earlier_today_count: 0,
      history_count: 0,
      today_orders_count: 0,
      active_tables_count: 0,
      tables_set_up: 0,
      tables_in_use: 0,
      tables_reserved_now: 0,
    };
  });

  const [stats, setStats] = useState<DashboardStats>(() => {
    if (initialStats) {
      return initialStats;
    }
    return { revenue: 0, menuItems: 0, unpaid: 0 };
  });

  // Fetch all counts directly from database
  const fetchCounts = useCallback(async () => {
    try {
      setError(null);
      const supabase = createClient();
      const normalizedVenueId = venueId.startsWith("venue-") ? venueId : `venue-${venueId}`;

      // Fetch dashboard counts using RPC
      const { data: countsData, error: countsError } = await supabase
        .rpc("dashboard_counts", {
          p_venue_id: normalizedVenueId,
          p_tz: venueTz,
          p_live_window_mins: 30,
        })
        .single();

      if (countsError) {
        logger.error("[Dashboard] Error fetching counts:", countsError);
        setError("Failed to fetch dashboard counts");
        return;
      }

      // Fetch table counts directly
      const { data: allTables } = await supabase
        .from("tables")
        .select("id, is_active")
        .eq("venue_id", normalizedVenueId);

      const { data: activeSessions } = await supabase
        .from("table_sessions")
        .select("id")
        .eq("venue_id", normalizedVenueId)
        .eq("status", "OCCUPIED")
        .is("closed_at", null);

      const now = new Date();
      const { data: currentReservations } = await supabase
        .from("reservations")
        .select("id")
        .eq("venue_id", normalizedVenueId)
        .eq("status", "BOOKED")
        .lte("start_at", now.toISOString())
        .gte("end_at", now.toISOString());

      if (countsData && typeof countsData === "object") {
        const activeTables = allTables?.filter((t) => t.is_active) || [];
        const counts = countsData as Record<string, unknown>;
        const finalCounts: DashboardCounts = {
          live_count: (counts.live_count as number) || 0,
          earlier_today_count: (counts.earlier_today_count as number) || 0,
          history_count: (counts.history_count as number) || 0,
          today_orders_count: (counts.today_orders_count as number) || 0,
          active_tables_count: activeTables.length,
          tables_set_up: activeTables.length,
          tables_in_use: activeSessions?.length || 0,
          tables_reserved_now: currentReservations?.length || 0,
        };
        setCounts(finalCounts);
      }
    } catch (err) {
      logger.error("[Dashboard] Error fetching counts:", err);
      setError("Failed to fetch dashboard counts");
    }
  }, [venueId, venueTz]);

  // Fetch stats (revenue, menu items, unpaid) directly from database
  const fetchStats = useCallback(async () => {
    try {
      setError(null);
      const supabase = createClient();
      const normalizedVenueId = venueId.startsWith("venue-") ? venueId : `venue-${venueId}`;
      const window = todayWindowForTZ(venueTz);

      // Fetch menu items count
      const menuItems = await fetchMenuItemCount(venueId);

      // Fetch orders for revenue and unpaid
      const { data: orders } = await supabase
        .from("orders")
        .select("total_amount, order_status, payment_status")
        .eq("venue_id", normalizedVenueId)
        .gte("created_at", window.startUtcISO || "")
        .lt("created_at", window.endUtcISO || "")
        .neq("order_status", "CANCELLED")
        .neq("order_status", "REFUNDED");

      const revenue = orders?.reduce((sum, order) => sum + (order.total_amount || 0), 0) || 0;
      const unpaid = orders?.filter((o) => o.payment_status === "UNPAID" || o.payment_status === "PAY_LATER").length || 0;

      setStats({ revenue, menuItems, unpaid });
    } catch (err) {
      logger.error("[Dashboard] Error fetching stats:", err);
      setError("Failed to fetch dashboard stats");
    }
  }, [venueId, venueTz]);

  // Initial data fetch on mount
  useEffect(() => {
    if (!venueId) return;

    const window = todayWindowForTZ(venueTz);
    setTodayWindow({
      startUtcISO: window.startUtcISO || "",
      endUtcISO: window.endUtcISO || "",
    });

    // If we have initial data, use it and still fetch fresh data in background
    if (initialCounts && initialStats) {
      setLoading(false);
      // Still fetch fresh data to ensure it's up to date
      fetchCounts();
      fetchStats();
    } else {
      // No initial data - fetch immediately
      const loadData = async () => {
        await Promise.all([fetchCounts(), fetchStats()]);
        setLoading(false);
      };
      loadData();
    }
  }, [venueId, venueTz, initialCounts, initialStats, fetchCounts, fetchStats]);

  // Set up real-time subscriptions for live updates
  useEffect(() => {
    if (!venueId) return;

    const supabase = createClient();
    const normalizedVenueId = venueId.startsWith("venue-") ? venueId : `venue-${venueId}`;

    // Subscribe to orders changes
    const ordersChannel = supabase
      .channel(`dashboard-orders-${venueId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
          filter: `venue_id=eq.${normalizedVenueId}`,
        },
        () => {
          // Refresh counts and stats when orders change
          fetchCounts();
          fetchStats();
        }
      )
      .subscribe();

    // Subscribe to menu_items changes
    const menuChannel = supabase
      .channel(`dashboard-menu-${venueId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "menu_items",
          filter: `venue_id=eq.${normalizedVenueId}`,
        },
        () => {
          // Refresh stats when menu items change
          fetchStats();
        }
      )
      .subscribe();

    // Subscribe to tables changes
    const tablesChannel = supabase
      .channel(`dashboard-tables-${venueId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "tables",
          filter: `venue_id=eq.${normalizedVenueId}`,
        },
        () => {
          // Refresh counts when tables change
          fetchCounts();
        }
      )
      .subscribe();

    // Subscribe to table_sessions changes
    const sessionsChannel = supabase
      .channel(`dashboard-sessions-${venueId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "table_sessions",
          filter: `venue_id=eq.${normalizedVenueId}`,
        },
        () => {
          // Refresh counts when sessions change
          fetchCounts();
        }
      )
      .subscribe();

    // Subscribe to reservations changes
    const reservationsChannel = supabase
      .channel(`dashboard-reservations-${venueId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "reservations",
          filter: `venue_id=eq.${normalizedVenueId}`,
        },
        () => {
          // Refresh counts when reservations change
          fetchCounts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ordersChannel);
      supabase.removeChannel(menuChannel);
      supabase.removeChannel(tablesChannel);
      supabase.removeChannel(sessionsChannel);
      supabase.removeChannel(reservationsChannel);
    };
  }, [venueId, fetchCounts, fetchStats]);

  // Manual refresh function
  const refreshCounts = useCallback(async () => {
    await fetchCounts();
  }, [fetchCounts]);

  const loadStats = useCallback(
    async (_venueId: string, _window: { startUtcISO: string; endUtcISO: string }) => {
      await fetchStats();
    },
    [fetchStats]
  );

  const updateRevenueIncrementally = useCallback(
    (order: { order_status: string; total_amount?: number }) => {
      const totalAmount = typeof order.total_amount === "number" ? order.total_amount : 0;
      if (order.order_status !== "CANCELLED" && totalAmount > 0) {
        setStats((prev) => ({
          ...prev,
          revenue: prev.revenue + totalAmount,
        }));
      }
    },
    []
  );

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
