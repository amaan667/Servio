import { useState, useEffect, useCallback } from "react";

import { getCachedCounts, setCachedCounts } from "@/lib/cache/count-cache";
import { normalizeVenueId } from "@/lib/utils/venueId";

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
      if (!venueId) return;

      setIsLoading(true);
      setError(null);
      const timezone = tz || "Europe/London";

      try {
        const { apiClient } = await import("@/lib/api-client");
        const res = await apiClient.get(`/api/dashboard/counts`, {
          params: { venueId, tz: timezone, live_window_mins: String(liveWindowMins) },
        });

        if (res.status === 429) {
          // Rate limited: keep cached data, clear error so UI doesn't show failure
          setError(null);
          return;
        }

        if (!res.ok) {
          setError("Failed to fetch counts");
          return;
        }

        const body = await res.json();
        const result = body?.data ?? body;
        if (result) {
          const raw = result as Record<string, unknown>;
          const counts: TabCounts = {
            live_count: Number(raw.live_count) || 0,
            earlier_today_count: Number(raw.earlier_today_count) || 0,
            history_count: Number(raw.history_count) || 0,
            today_orders_count: Number(raw.today_orders_count) || 0,
            active_tables_count: Number(raw.active_tables_count) || 0,
            tables_set_up: Number(raw.tables_set_up) || 0,
            in_use_now: Number((raw as { in_use_now?: number; tables_in_use?: number }).in_use_now ?? (raw as { tables_in_use?: number }).tables_in_use) || 0,
            reserved_now: Number((raw as { reserved_now?: number; tables_reserved_now?: number }).reserved_now ?? (raw as { tables_reserved_now?: number }).tables_reserved_now) || 0,
            reserved_later: Number(raw.reserved_later) || 0,
            waiting: Number(raw.waiting) || 0,
          };
          setData(counts);
          setCachedCounts(venueId, counts);
        }
      } catch (_err) {
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

  // Set up periodic refresh (60s to avoid 429 when multiple components poll)
  useEffect(() => {
    if (!venueId) return;

    const interval = setInterval(() => {
      fetchCounts(false);
    }, 60000); // Refresh every 60 seconds

    return () => clearInterval(interval);
  }, [venueId, fetchCounts]);

  // Refetch when any mutation invalidates counts for this venue
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

  return { data, isLoading, error, refetch: () => fetchCounts(true) };
}
