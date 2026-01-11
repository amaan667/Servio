import { useEffect, useRef } from "react";
import { supabaseBrowser as createClient } from "@/lib/supabase";

export function useCountsRealtime(venueId: string, tz: string, onOrderChange?: () => void) {
  const supabase = createClient();
  const onOrderChangeRef = useRef(onOrderChange);

  useEffect(() => {
    onOrderChangeRef.current = onOrderChange;
  }, [onOrderChange]);

  useEffect(() => {
    if (!venueId || !tz) return;

    const channel = supabase
      .channel(`orders-${venueId}`)
      .on(
        "postgres_changes",
        {

          filter: `venue_id=eq.${venueId}`,
        },
        () => {
          if (onOrderChangeRef.current) {
            onOrderChangeRef.current();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [venueId, tz]);
}
