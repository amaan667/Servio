import { useEffect, useRef } from "react";
import { supabaseBrowser as createClient } from "@/lib/supabase";

export function useTableRealtime(venueId: string, onTableChange?: () => void) {
  const supabase = createClient();
  const onTableChangeRef = useRef(onTableChange);

  useEffect(() => {
    onTableChangeRef.current = onTableChange;
  }, [onTableChange]);

  useEffect(() => {
    if (!venueId) return;

    const channel = supabase
      .channel(`tables-${venueId}`)
      .on(
        "postgres_changes",
        {

          filter: `venue_id=eq.${venueId}`,
        },
        (_payload: unknown) => {
          if (onTableChangeRef.current) {
            onTableChangeRef.current();
          }
        }
      )
      .on(
        "postgres_changes",
        {

          filter: `venue_id=eq.${venueId}`,
        },
        (_payload: unknown) => {
          if (onTableChangeRef.current) {
            onTableChangeRef.current();
          }
        }
      )
      .on(
        "postgres_changes",
        {

          filter: `venue_id=eq.${venueId}`,
        },
        (_payload: unknown) => {
          if (onTableChangeRef.current) {
            onTableChangeRef.current();
          }
        }
      )
      .subscribe((_status: unknown) => {
        /* Empty */

    return () => {
      supabase.removeChannel(channel);
    };
  }, [venueId]);
}
