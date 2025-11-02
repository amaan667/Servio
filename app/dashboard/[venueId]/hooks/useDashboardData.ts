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
    // IMPORTANT: Cache key MUST include venueId to prevent cross-venue data leaks
    const cached = sessionStorage.getItem(`dashboard_stats_${venueId}`);
    if (!cached) return null;

    try {
      const parsed = JSON.parse(cached);
      // Verify cache is for correct venue (extra safety)
      return parsed;
    } catch {
      return null;
    }
  };

  const [venue, setVenue] = useState<unknown>(initialVenue);
  const [loading, setLoading] = useState(false); // Start with false - we have initial data

  // Priority: initialCounts from server → cached → default 0
  // NEVER show 0 if we have cached data - this prevents flicker
  const [counts, setCounts] = useState<DashboardCounts>(() => {
    const cached = getCachedCounts();
    if (cached) return cached;
    if (initialCounts) return initialCounts;
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

  // Priority: initialStats from server → cached → default 0
  // IMPORTANT: Server data (initialStats) takes priority over cache for freshness
  const [stats, setStats] = useState<DashboardStats>(() => {
    if (initialStats) {
      console.log(
        `[DASHBOARD CLIENT] Using initialStats from server for venue ${venueId}:`,
        initialStats
      );
      return initialStats;
    }
    const cached = getCachedStats();
    if (cached) {
      console.log(`[DASHBOARD CLIENT] Using cached stats for venue ${venueId}:`, cached);
      return cached;
    }
    console.log(`[DASHBOARD CLIENT] Using default stats for venue ${venueId}`);
    return { revenue: 0, menuItems: 0, unpaid: 0 };
  });
  const [todayWindow, setTodayWindow] = useState<{ startUtcISO: string; endUtcISO: string } | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);

  // Cache initial data immediately on mount to prevent future flicker
  useEffect(() => {
    if (typeof window !== "undefined") {
      if (initialCounts) {
        sessionStorage.setItem(`dashboard_counts_${venueId}`, JSON.stringify(initialCounts));
        sessionStorage.setItem(`dashboard_counts_time_${venueId}`, Date.now().toString());
      }
      if (initialStats) {
        sessionStorage.setItem(`dashboard_stats_${venueId}`, JSON.stringify(initialStats));
      }
    }
  }, []); // Run once on mount

  const loadStats = useCallback(
    async (venueId: string, window: { startUtcISO: string; endUtcISO: string }) => {
      try {
        const supabase = createClient();

        const { data: orders } = await supabase
          .from("orders")
          .select("total_amount, order_status, payment_status")
          .eq("venue_id", venueId)
          .gte("created_at", window.startUtcISO)
          .lt("created_at", window.endUtcISO)
          .neq("order_status", "CANCELLED")
          .neq("order_status", "REFUNDED");

        const { data: menuItems, error: menuError } = await supabase
          .from("menu_items")
          .select("id")
          .eq("venue_id", venueId)
          .eq("is_available", true);

        console.log(`[DASHBOARD CLIENT] Menu items query result for venue ${venueId}:`, {
          count: menuItems?.length || 0,
          hasError: !!menuError,
          errorMessage: menuError?.message || null,
          timestamp: new Date().toISOString(),
        });

        // Calculate revenue from all non-cancelled orders (regardless of payment status)
        const revenue = orders?.reduce((sum, order) => sum + (order.total_amount || 0), 0) || 0;
        // Count unpaid orders based on payment_status, not order_status
        const unpaid =
          orders?.filter((o) => o.payment_status === "UNPAID" || o.payment_status === "PAY_LATER")
            .length || 0;

        const newStats = {
          revenue,
          menuItems: menuItems?.length || 0,
          unpaid,
        };

        console.log(`[DASHBOARD CLIENT] Updating stats for venue ${venueId}:`, newStats);
        setStats(newStats);

        // Cache the stats to prevent flicker - IMPORTANT: Key includes venueId
        if (typeof window !== "undefined") {
          sessionStorage.setItem(`dashboard_stats_${venueId}`, JSON.stringify(newStats));
        }
        console.log(`[DASHBOARD CLIENT] Stats cached for venue ${venueId}:`, newStats);
      } catch (_error) {
        // Error handled silently
      }
    },
    []
  );

  const refreshCounts = useCallback(async () => {
    console.log("[Dashboard] refreshCounts called for venue:", venueId);
    try {
      setError(null);
      const supabase = createClient();

      const { data: newCounts, error } = await withSupabaseRetry(
        async () =>
          await supabase
            .rpc("dashboard_counts", {
              p_venue_id: venueId,
              p_tz: venueTz,
              p_live_window_mins: 30,
            })
            .single()
      );

      if (error) {
        console.error("[Dashboard] Error fetching counts:", error);
        setError("Failed to refresh dashboard data");
        return;
      }

      console.log("[Dashboard] Counts fetched:", newCounts);

      // Fetch REAL table counts directly (no RPC, no caching)
      const { data: allTables } = await withSupabaseRetry(
        async () => await supabase.from("tables").select("id, is_active").eq("venue_id", venueId)
      );

      const { data: activeSessions } = await withSupabaseRetry(
        async () =>
          await supabase
            .from("table_sessions")
            .select("id")
            .eq("venue_id", venueId)
            .eq("status", "OCCUPIED")
            .is("closed_at", null)
      );

      const now = new Date();
      const { data: currentReservations } = await withSupabaseRetry(
        async () =>
          await supabase
            .from("reservations")
            .select("id")
            .eq("venue_id", venueId)
            .eq("status", "BOOKED")
            .lte("start_at", now.toISOString())
            .gte("end_at", now.toISOString())
      );

      if (newCounts && typeof newCounts === "object") {
        const counts = newCounts as DashboardCounts;

        // Merge real table counts
        const activeTables = allTables?.filter((t) => t.is_active) || [];
        const finalCounts = {
          ...counts,
          tables_set_up: activeTables.length, // Real count from tables table
          tables_in_use: activeSessions?.length || 0, // Real count from table_sessions
          tables_reserved_now: currentReservations?.length || 0, // Real count from reservations
          active_tables_count: activeTables.length, // Same as tables_set_up
        };

        console.log("[Dashboard] Setting counts:", finalCounts);
        setCounts(finalCounts);
        // Cache the counts to prevent flicker (but allow refresh)
        if (typeof window !== "undefined") {
          sessionStorage.setItem(`dashboard_counts_${venueId}`, JSON.stringify(finalCounts));
          sessionStorage.setItem(`dashboard_counts_time_${venueId}`, Date.now().toString());
        }
      } else {
        console.warn("[Dashboard] No counts data received from RPC");
      }
    } catch (_err) {
      console.error("[Dashboard] Error refreshing counts:", _err);
      setError("Failed to refresh dashboard data");
    }
  }, [venueId, venueTz]);

  // Force refresh on mount AND when venueId changes
  useEffect(() => {
    if (venueId) {
      // Check if we have fresh cached data (less than 30 seconds old)
      const hasFreshCache = (() => {
        if (typeof window === "undefined") return false;
        const cached = sessionStorage.getItem(`dashboard_counts_${venueId}`);
        const cacheTime = sessionStorage.getItem(`dashboard_counts_time_${venueId}`);
        if (!cached || !cacheTime) return false;
        const age = Date.now() - parseInt(cacheTime);
        return age < 30000; // 30 seconds
      })();

      if (hasFreshCache) {
        console.log("[Dashboard] Using fresh cached data, skipping refresh");
        return;
      }

      console.log("[Dashboard] Mount/VenueChange: refreshing counts for venue:", venueId);

      // Clear old venue's cache when switching to ensure fresh data
      if (typeof window !== "undefined") {
        const allKeys = Object.keys(sessionStorage);
        allKeys.forEach((key) => {
          if (key.startsWith("dashboard_stats_") || key.startsWith("dashboard_counts_")) {
            const cachedVenueId = key.split("_")[key.split("_").length - 1];
            if (cachedVenueId !== venueId) {
              sessionStorage.removeItem(key);
            }
          }
        });
      }
      refreshCounts();
    }
  }, [venueId, refreshCounts]); // Re-run when venueId changes

  // Refresh data when page becomes visible (DON'T clear cache to prevent flicker)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && venueId) {
        console.log("[Dashboard] Page visible - background refresh (cache preserved)");
        // Refresh data WITHOUT clearing cache first
        // Old data shows instantly, new data updates smoothly
        refreshCounts();
        const timeWindow = todayWindowForTZ(venueTz);
        if (timeWindow.startUtcISO && timeWindow.endUtcISO) {
          loadStats(venueId, {
            startUtcISO: timeWindow.startUtcISO,
            endUtcISO: timeWindow.endUtcISO,
          });
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [venueId, venueTz, refreshCounts, loadStats]);

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

  useEffect(() => {
    if (!venue) return;

    const window = todayWindowForTZ(venueTz);
    setTodayWindow({
      startUtcISO: window.startUtcISO || "",
      endUtcISO: window.endUtcISO || "",
    });

    // If we have initial data from server, use it and DON'T fetch
    if (initialCounts && initialStats) {
      setLoading(false);
      return;
    }

    // No initial data - fetch immediately
    const fetchData = async () => {
      await refreshCounts();
      const venue_id =
        venue && typeof venue === "object" && "venue_id" in venue
          ? (venue as { venue_id: string }).venue_id
          : venueId;
      if (window.startUtcISO && window.endUtcISO) {
        await loadStats(venue_id, { startUtcISO: window.startUtcISO, endUtcISO: window.endUtcISO });
      }
      setLoading(false);
    };

    fetchData();
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
