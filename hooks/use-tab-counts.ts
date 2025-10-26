import { errorToContext } from "@/lib/utils/error-to-context";

import { supabaseBrowser as createClient } from "@/lib/supabase";
import { useState, useEffect, useCallback, useMemo } from "react";
import { logger } from "@/lib/logger";

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
  const [data, setData] = useState<TabCounts | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCounts = useCallback(async () => {
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
        return;
      }

      setData(result);
    } catch (_err) {
      logger.error("[TAB_COUNTS] Fetch error:", errorToContext(_err));
      setError(_err instanceof Error ? _err.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  }, [venueId, tz, liveWindowMins]);

  useEffect(() => {
    fetchCounts();
  }, [fetchCounts]);

  return { data, isLoading, error, refetch: fetchCounts };
}
