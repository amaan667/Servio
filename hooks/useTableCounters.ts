import { useState, useEffect, useCallback } from 'react';

export interface TableCounters {
  tables_set_up: number;
  free_now: number;
  in_use_now: number;
  reserved_now: number;
  reserved_later: number;
  block_window_mins: number;
}

export function useTableCounters(venueId: string) {
  const [counters, setCounters] = useState<TableCounters | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCounters = useCallback(async () => {
    if (!venueId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/tables/counters?venueId=${encodeURIComponent(venueId)}`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (!data.ok) {
        throw new Error(data.error || 'Failed to fetch counters');
      }
      
      // Map the API response to our interface
      setCounters({
        tables_set_up: data.counters.total_tables,
        free_now: data.counters.available,
        in_use_now: data.counters.occupied,
        reserved_now: data.counters.reserved_now,
        reserved_later: data.counters.reserved_later,
        block_window_mins: data.counters.block_window_mins || 0
      });
    } catch (err) {
      console.error('[TABLE COUNTERS] Error fetching counters:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch counters');
    } finally {
      setLoading(false);
    }
  }, [venueId]);

  useEffect(() => {
    fetchCounters();
  }, [fetchCounters]);

  return {
    counters,
    loading,
    error,
    refetch: fetchCounters,
  };
}
