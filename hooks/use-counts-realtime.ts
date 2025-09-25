import { useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { logInfo } from "@/lib/logger";

export function useCountsRealtime(venueId: string, tz: string, onOrderChange?: () => void) {
  const supabase = createClient()
  const onOrderChangeRef = useRef(onOrderChange)

  useEffect(() => {
    onOrderChangeRef.current = onOrderChange
  }, [onOrderChange])

  useEffect(() => {
    if (!venueId || !tz) return

    const channel = supabase
      .channel(`orders-${venueId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'orders',
        filter: `venue_id=eq.${venueId}`,
      }, () => {
        logInfo('[COUNTS_REALTIME] Order changed, refreshing tab counts')
        if (onOrderChangeRef.current) {
          onOrderChangeRef.current()
        }
      })
      .subscribe()

    return () => { 
      logInfo('[COUNTS_REALTIME] Cleaning up channel')
      supabase.removeChannel(channel) 
    }
  }, [venueId, tz])
}
