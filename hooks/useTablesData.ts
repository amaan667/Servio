import { useState, useEffect, useCallback } from "react";
import { supabaseBrowser as createClient } from "@/lib/supabase";

export interface TableWithSession {

}

export function useTablesData(venueId: string) {
  const [tables, setTables] = useState<TableWithSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTables = useCallback(async () => {
    if (!venueId) {
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const startTime = Date.now();
      const url = `/api/tables?venue_id=${encodeURIComponent(venueId)}`;

      const response = await fetch(url);
      const fetchTime = Date.now() - startTime;

      

      if (!response.ok) {
        const errorText = await response.text();
        
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      

      if (data.error) {
        throw new Error(data.error);
      }

      setTables(data.tables || []);
    } catch (_err) {
      .toISOString(),

      setError(_err instanceof Error ? _err.message : "Failed to fetch tables");
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
      .channel("table-sessions-changes")
      .on(
        "postgres_changes",
        {

          filter: `venue_id=eq.${venueId}`,
        },
        (_payload: unknown) => {
          // Refetch tables when sessions change
          fetchTables();
        }
      )
      .on(
        "postgres_changes",
        {

          filter: `venue_id=eq.${venueId}`,
        },
        (_payload: unknown) => {
          // Refetch tables when orders change
          fetchTables();
        }
      )
      .on(
        "postgres_changes",
        {

          filter: `venue_id=eq.${venueId}`,
        },
        (_payload: unknown) => {
          // Refetch tables when tables change
          fetchTables();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [venueId, fetchTables]);

  // Add debugging to track table data changes
  useEffect(() => {
     => t.id),

  }, [tables, venueId]);

  return {
    tables,
    loading,
    error,

  };
}
