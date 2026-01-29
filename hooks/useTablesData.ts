import { useState, useEffect, useCallback } from "react";
import { supabaseBrowser as createClient } from "@/lib/supabase";

export interface TableWithSession {
  id: string;
  venue_id: string;
  label: string;
  seat_count: number;
  is_active: boolean;
  table_created_at: string;
  merged_with_table_id: string | null;
  session_id: string | null;
  status:
    | "FREE"
    | "ORDERING"
    | "IN_PREP"
    | "READY"
    | "SERVED"
    | "AWAITING_BILL"
    | "RESERVED"
    | "CLOSED";
  order_id: string | null;
  opened_at: string | null;
  closed_at: string | null;
  total_amount: number | null;
  customer_name: string | null;
  order_status: string | null;
  payment_status: string | null;
  order_updated_at: string | null;
  reservation_time: string | null;
  reservation_duration_minutes: number | null;
  reservation_end_time: string | null;
  reservation_created_at: string | null;
  most_recent_activity: string;
  // New reservation fields
  reserved_now_id: string | null;
  reserved_now_start: string | null;
  reserved_now_end: string | null;
  reserved_now_name: string | null;
  reserved_now_phone: string | null;
  reserved_later_id: string | null;
  reserved_later_start: string | null;
  reserved_later_end: string | null;
  reserved_later_name: string | null;
  reserved_later_phone: string | null;
  block_window_mins: number;
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
          event: "*",
          schema: "public",
          table: "table_sessions",
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
          event: "*",
          schema: "public",
          table: "orders",
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
          event: "*",
          schema: "public",
          table: "tables",
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
    /* Intentionally empty */
  }, [tables, venueId]);

  return {
    tables,
    loading,
    error,
    refetch: fetchTables,
  };
}
