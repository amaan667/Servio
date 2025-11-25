import { useState, useEffect, useCallback } from "react";
import { supabaseBrowser as createClient } from "@/lib/supabase";
import { logger } from "@/lib/logger";
import { withSupabaseRetry } from "@/lib/retry";
import { todayWindowForTZ } from "@/lib/time";
import {
  getCachedCounts,
  setCachedCounts,
  isCacheFresh,
  type CachedCounts,
} from "@/lib/cache/count-cache";

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
  // Use shared cache utility for counts

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
    const cached = getCachedCounts(venueId);
    if (cached) {
      return {
        live_count: cached.live_count || 0,
        earlier_today_count: cached.earlier_today_count || 0,
        history_count: cached.history_count || 0,
        today_orders_count: cached.today_orders_count || 0,
        active_tables_count: cached.active_tables_count || 0,
        tables_set_up: cached.tables_set_up || 0,
        tables_in_use: cached.tables_in_use || 0,
        tables_reserved_now: cached.tables_reserved_now || 0,
      };
    }
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
      return initialStats;
    }
    const cached = getCachedStats();
    if (cached) {
      return cached;
    }
    return { revenue: 0, menuItems: 0, unpaid: 0 };
  });
  const [todayWindow, setTodayWindow] = useState<{ startUtcISO: string; endUtcISO: string } | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);

  // Cache initial data immediately on mount to prevent future flicker
  useEffect(() => {
    if (initialCounts) {
      setCachedCounts(venueId, initialCounts);
    }
    if (initialStats && typeof window !== "undefined") {
      sessionStorage.setItem(`dashboard_stats_${venueId}`, JSON.stringify(initialStats));
    }
  }, [venueId, initialCounts, initialStats]); // Run when initial data changes

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

        setStats(newStats);

        // Cache the stats to prevent flicker - IMPORTANT: Key includes venueId
        if (typeof window !== "undefined") {
          sessionStorage.setItem(`dashboard_stats_${venueId}`, JSON.stringify(newStats));
        }
      } catch (_error) {
        // Error handled silently
      }
    },
    []
  );

  const refreshCounts = useCallback(async () => {
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
        logger.error("[Dashboard] Error fetching counts:", error);
        setError("Failed to refresh dashboard data");
        return;
      }

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

        setCounts(finalCounts);
        // Cache the counts using shared cache utility
        setCachedCounts(venueId, finalCounts);
      } else {
        logger.warn("[Dashboard] No counts data received from RPC");
      }
    } catch (_err) {
      logger.error("[Dashboard] Error refreshing counts:", _err);
      setError("Failed to refresh dashboard data");
    }
  }, [venueId, venueTz]);

  // Only refresh on mount if cache is stale or missing
  // DON'T refresh on every navigation - use cached data instead
  useEffect(() => {
    if (venueId) {
      // If we have fresh cache, use it and skip refresh
      if (isCacheFresh(venueId)) {
        const cached = getCachedCounts(venueId);
        if (cached) {
          setCounts({
            live_count: cached.live_count || 0,
            earlier_today_count: cached.earlier_today_count || 0,
            history_count: cached.history_count || 0,
            today_orders_count: cached.today_orders_count || 0,
            active_tables_count: cached.active_tables_count || 0,
            tables_set_up: cached.tables_set_up || 0,
            tables_in_use: cached.tables_in_use || 0,
            tables_reserved_now: cached.tables_reserved_now || 0,
          });
        }
        return;
      }

      // Only clear old venue's cache when switching venues (not on navigation)
      // This prevents clearing cache when just navigating between pages
      if (typeof window !== "undefined") {
        const allKeys = Object.keys(sessionStorage);
        allKeys.forEach((key) => {
          if (key.startsWith("dashboard_stats_")) {
            const cachedVenueId = key.split("_")[key.split("_").length - 1];
            if (cachedVenueId !== venueId) {
              sessionStorage.removeItem(key);
            }
          }
        });
      }

      // Only refresh if cache is stale or missing
      // This prevents unnecessary refreshes when navigating between pages
      refreshCounts();
    }
  }, [venueId]); // Only depend on venueId - don't include refreshCounts to prevent re-runs

  // Refresh data when page becomes visible (only if cache is stale)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && venueId) {
        // Only refresh if cache is stale - prevents unnecessary refreshes
        if (!isCacheFresh(venueId)) {
          refreshCounts();
        }
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
