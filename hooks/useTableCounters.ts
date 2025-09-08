import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

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

  // Add real-time updates
  useEffect(() => {
    if (!venueId) return;

    const supabase = createClient();
    
    // Subscribe to table and session changes
    const subscription = supabase
      .channel('table-counters-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tables',
          filter: `venue_id=eq.${venueId}`,
        },
        () => {
          console.log('[TABLE COUNTERS] Table changed, refreshing counters');
          fetchCounters();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'table_sessions',
          filter: `venue_id=eq.${venueId}`,
        },
        () => {
          console.log('[TABLE COUNTERS] Table session changed, refreshing counters');
          fetchCounters();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [venueId, fetchCounters]);

  return {
    counters,
    loading,
    error,
    refetch: fetchCounters,
  };
}
