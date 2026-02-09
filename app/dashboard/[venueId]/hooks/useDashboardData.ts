import { useState, useEffect, useCallback } from "react";
import { supabaseBrowser as createClient } from "@/lib/supabase";
import { todayWindowForTZ } from "@/lib/time";
import { fetchMenuItemCount } from "@/lib/counts/unified-counts";
import { normalizeVenueId } from "@/lib/utils/venueId";

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
  const [todayWindow, setTodayWindow] = useState<{ startUtcISO: string; endUtcISO: string } | null>(
    null
  );

  // Initialize with server data if available, otherwise defaults
  // CRITICAL: Use server data immediately to prevent showing 0 on first load
  const [counts, setCounts] = useState<DashboardCounts>(() => {
    if (initialCounts) {
      // Initialize from server data (no logging - removed in production)
      return initialCounts;
    }
    // Default to zeros if no initial data
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
      // Initialize from server data (no logging - removed in production)
      return initialStats;
    }
    // Default to zeros if no initial data
    return { revenue: 0, menuItems: 0, unpaid: 0 };
  });

  // CRITICAL: Update state immediately when server props change
  // This ensures we always use the latest server data
  // Run synchronously on mount if initialCounts exists to prevent showing 0
  useEffect(() => {
    if (initialCounts) {
      // Update counts from server data (no logging - removed in production)
      setCounts(initialCounts);
      setLoading(false);
    }
  }, [initialCounts]);

  useEffect(() => {
    if (initialStats) {
      setStats(initialStats);
      setLoading(false);
    }
  }, [initialStats]);

  // Fetch all counts directly from database
  const fetchCounts = useCallback(
    async (force = false) => {
      // Always fetch when force=true to ensure fresh data
      // This ensures real-time updates and correct initial state
      if (!force) {
        return;
      }

      try {
        setError(null);
        const supabase = createClient();
        const normalizedVenueId = normalizeVenueId(venueId) ?? venueId;

        // Fetch dashboard counts from API (no RPC dependency)
        const params = new URLSearchParams({
          venueId: normalizedVenueId,
          tz: venueTz,
          live_window_mins: "30",
        });
        const { apiClient } = await import("@/lib/api-client");
        const res = await apiClient.get(`/api/dashboard/counts`, {
          params: { venueId: normalizedVenueId, tz: venueTz, live_window_mins: "30" },
        });
        if (!res.ok) {
          setError("Failed to fetch dashboard counts");
          return;
        }
        const countsData = await res.json().then((b) => b?.data ?? b);

        // Batch fetch table-related data in parallel for better performance
        const now = new Date();
        const [tablesResult, sessionsResult, reservationsResult] = await Promise.all([
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
        ]);

        const allTables = tablesResult.data;
        const activeSessions = sessionsResult.data;
        const currentReservations = reservationsResult.data;

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
        setError("Failed to fetch dashboard counts");
      }
    },
    [venueId, venueTz, initialCounts]
  );

  // Fetch stats (revenue, menu items, unpaid) directly from database
  const fetchStats = useCallback(
    async (force = false) => {
      // Always fetch when force=true to ensure fresh data
      // This ensures real-time updates and correct initial state
      if (!force) {
        return;
      }

      try {
        setError(null);
        const supabase = createClient();
        const normalizedVenueId = normalizeVenueId(venueId) ?? venueId;
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
        const unpaid =
          orders?.filter((o) => o.payment_status === "UNPAID" || o.payment_status === "PAY_LATER")
            .length || 0;

        const freshStats = { revenue, menuItems, unpaid };
        setStats(freshStats);
      } catch (err) {
        setError("Failed to fetch dashboard stats");
      }
    },
    [venueId, venueTz, initialStats]
  );

  // Initial data fetch on mount
  useEffect(() => {
    if (!venueId) return;

    const window = todayWindowForTZ(venueTz);
    setTodayWindow({
      startUtcISO: window.startUtcISO || "",
      endUtcISO: window.endUtcISO || "",
    });

    // Always use initial data immediately to prevent showing 0 values
    if (initialCounts) {
      setCounts(initialCounts);
    }
    if (initialStats) {
      setStats(initialStats);
    }
    setLoading(false);

    // Always refetch counts and stats shortly after mount so navigation from other
    // pages (e.g. after deleting a table) shows up-to-date numbers
    const t = setTimeout(() => {
      void fetchCounts(true);
      void fetchStats(true);
    }, 150);
    return () => clearTimeout(t);
  }, [venueId, venueTz, initialCounts, initialStats, fetchCounts, fetchStats]);

  // Set up real-time subscriptions for live updates
  // Only set up after initial load is complete to prevent overwriting server data
  useEffect(() => {
    if (!venueId || loading) return;

    const supabase = createClient();
    if (!supabase || typeof (supabase as unknown as { channel?: unknown }).channel !== "function") {
      return;
    }
    const normalizedVenueId = normalizeVenueId(venueId) ?? venueId;

    // Separate debounce timeouts for counts and stats to prevent conflicts
    let countsDebounceTimeout: NodeJS.Timeout | null = null;
    let statsDebounceTimeout: NodeJS.Timeout | null = null;

    const debouncedFetchCounts = () => {
      if (countsDebounceTimeout) clearTimeout(countsDebounceTimeout);
      // Reduced debounce for table changes to ensure immediate updates
      countsDebounceTimeout = setTimeout(() => {
        fetchCounts(true);
      }, 100);
    };

    const debouncedFetchStats = () => {
      if (statsDebounceTimeout) clearTimeout(statsDebounceTimeout);
      statsDebounceTimeout = setTimeout(() => {
        fetchStats(true);
      }, 300);
    };

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
          debouncedFetchCounts();
          debouncedFetchStats();
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
          debouncedFetchStats();
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
          debouncedFetchCounts();
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
          debouncedFetchCounts();
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
          debouncedFetchCounts();
        }
      )
      .subscribe();

    return () => {
      if (countsDebounceTimeout) clearTimeout(countsDebounceTimeout);
      if (statsDebounceTimeout) clearTimeout(statsDebounceTimeout);
      supabase.removeChannel(ordersChannel);
      supabase.removeChannel(menuChannel);
      supabase.removeChannel(tablesChannel);
      supabase.removeChannel(sessionsChannel);
      supabase.removeChannel(reservationsChannel);
    };
  }, [venueId, loading, fetchCounts, fetchStats]);

  // Refetch counts when any mutation invalidates counts for this venue
  useEffect(() => {
    if (!venueId) return;

    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ venueId: string }>).detail;
      if (!detail?.venueId) return;
      const n = normalizeVenueId(venueId) ?? venueId;
      const d = normalizeVenueId(detail.venueId) ?? detail.venueId;
      if (n === d) void fetchCounts(true);
    };

    window.addEventListener("countsInvalidated", handler);
    return () => window.removeEventListener("countsInvalidated", handler);
  }, [venueId, fetchCounts]);

  // Manual refresh function
  const refreshCounts = useCallback(async () => {
    await fetchCounts(true);
  }, [fetchCounts]);

  const loadStats = useCallback(
    async (_venueId: string, _window: { startUtcISO: string; endUtcISO: string }) => {
      await fetchStats(true);
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
