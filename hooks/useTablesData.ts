import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

export interface TableWithSession {
  id: string;
  venue_id: string;
  label: string;
  seat_count: number;
  is_active: boolean;
  table_created_at: string;
  session_id: string | null;
  status: 'FREE' | 'ORDERING' | 'IN_PREP' | 'READY' | 'SERVED' | 'AWAITING_BILL' | 'RESERVED' | 'CLOSED';
  order_id: string | null;
  opened_at: string | null;
  closed_at: string | null;
  total_amount: number | null;
  customer_name: string | null;
  order_status: string | null;
  payment_status: string | null;
  order_updated_at: string | null;
}

export function useTablesData(venueId: string) {
  const [tables, setTables] = useState<TableWithSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTables = useCallback(async () => {
    if (!venueId) return;

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/tables?venue_id=${encodeURIComponent(venueId)}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch tables');
      }

      setTables(data.tables || []);
    } catch (err) {
      console.error('[TABLES HOOK] Error fetching tables:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch tables');
    } finally {
      setLoading(false);
    }
  }, [venueId]);

  useEffect(() => {
    fetchTables();
  }, [fetchTables]);

  // Set up realtime subscription
  useEffect(() => {
    if (!venueId) return;

    const supabase = createClient();

    // Subscribe to table_sessions changes
    const subscription = supabase
      .channel('table-sessions-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'table_sessions',
          filter: `venue_id=eq.${venueId}`,
        },
        (payload) => {
          console.log('[TABLES HOOK] Realtime table_sessions update received:', payload);
          // Refetch tables when sessions change
          fetchTables();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `venue_id=eq.${venueId}`,
        },
        (payload) => {
          console.log('[TABLES HOOK] Realtime orders update received:', payload);
          // Refetch tables when orders change
          fetchTables();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tables',
          filter: `venue_id=eq.${venueId}`,
        },
        (payload) => {
          console.log('[TABLES HOOK] Realtime tables update received:', payload);
          // Refetch tables when tables change
          fetchTables();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [venueId, fetchTables]);

  return {
    tables,
    loading,
    error,
    refetch: fetchTables,
  };
}
