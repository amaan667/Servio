import { errorToContext } from "@/lib/utils/error-to-context";

import { supabaseBrowser as createClient } from "@/lib/supabase";
import { useState, useEffect, useCallback } from "react";
import { logger } from "@/lib/logger";
import { getCachedCounts, setCachedCounts } from "@/lib/cache/count-cache";

export interface TabCounts {
  live_count: number;
  earlier_today_count: number;
  history_count: number;
  today_orders_count: number;
  active_tables_count: number;
  tables_set_up: number;
  in_use_now: number;
  reserved_now: number;
  reserved_later: number;
  waiting: number;
}

export function useTabCounts(venueId: string, tz: string, liveWindowMins = 30) {
  // Initialize with cached data to prevent flicker
  const [data, setData] = useState<TabCounts | null>(() => {
    const cached = getCachedCounts(venueId);
    if (cached) {
      // Ensure all required fields are present
      return {
        live_count: cached.live_count || 0,
        earlier_today_count: cached.earlier_today_count || 0,
        history_count: cached.history_count || 0,
        today_orders_count: cached.today_orders_count || 0,
        active_tables_count: cached.active_tables_count || 0,
        tables_set_up: cached.tables_set_up || 0,
        in_use_now: cached.in_use_now || 0,
        reserved_now: cached.reserved_now || 0,
        reserved_later: cached.reserved_later || 0,
        waiting: cached.waiting || 0,
      };
    }
    return null;
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCounts = useCallback(
    async (_forceRefresh = false) => {
      if (!venueId || !tz) return;

      setIsLoading(true);
      setError(null);

      try {
        const supabase = createClient();
        const { data: result, error: rpcError } = await supabase
          .rpc("dashboard_counts", {
            p_venue_id: venueId,
            p_tz: tz,
            p_live_window_mins: liveWindowMins,
          })
          .single();

        if (rpcError) {
          logger.error("[TAB_COUNTS] RPC error:", rpcError);
          setError(rpcError.message);
          // Don't clear data on error - keep showing cached data
          return;
        }

        if (result) {
          const counts = result as TabCounts;
          setData(counts);
          // Cache the result
          setCachedCounts(venueId, counts);
        }
      } catch (_err) {
        logger.error("[TAB_COUNTS] Fetch error:", errorToContext(_err));
        setError(_err instanceof Error ? _err.message : "Unknown error");
        // Don't clear data on error - keep showing cached data
      } finally {
        setIsLoading(false);
      }
    },
    [venueId, tz, liveWindowMins]
  );

  // Always fetch on mount to ensure counts are visible, regardless of cache freshness
  useEffect(() => {
    // 1) Use cached counts immediately (if present) to prevent flicker
    const cached = getCachedCounts(venueId);
    if (cached) {
      setData({
        live_count: cached.live_count || 0,
        earlier_today_count: cached.earlier_today_count || 0,
        history_count: cached.history_count || 0,
        today_orders_count: cached.today_orders_count || 0,
        active_tables_count: cached.active_tables_count || 0,
        tables_set_up: cached.tables_set_up || 0,
        in_use_now: cached.in_use_now || 0,
        reserved_now: cached.reserved_now || 0,
        reserved_later: cached.reserved_later || 0,
        waiting: cached.waiting || 0,
      });
    }

    // 2) Always force a fresh fetch on mount so counts are never stale
    void fetchCounts(true);
  }, [venueId, fetchCounts]);

  // Set up periodic refresh to keep counts updated even when tab is not active
  useEffect(() => {
    if (!venueId) return;

    const interval = setInterval(() => {
      fetchCounts(false);
    }, 30000); // Refresh every 30 seconds

    return () => clearInterval(interval);
  }, [venueId, fetchCounts]);

  return { data, isLoading, error, refetch: () => fetchCounts(true) };
}
