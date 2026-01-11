import { errorToContext } from "@/lib/utils/error-to-context";

import { supabaseBrowser as createClient } from "@/lib/supabase";
import { useState, useEffect, useCallback } from "react";
import { getCachedCounts, setCachedCounts } from "@/lib/cache/count-cache";

export interface TabCounts {

}

export function useTabCounts(venueId: string, tz: string, liveWindowMins = 30) {
  // Initialize with cached data to prevent flicker
  const [data, setData] = useState<TabCounts | null>(() => {
    const cached = getCachedCounts(venueId);
    if (cached) {
      // Ensure all required fields are present
      return {

      };
    }
    return null;

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

          .single();

        if (rpcError) {
          
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
        );
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
