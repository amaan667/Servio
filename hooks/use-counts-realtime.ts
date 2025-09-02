import { useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

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
        console.log('[COUNTS_REALTIME] Order changed, refreshing tab counts')
        if (onOrderChangeRef.current) {
          onOrderChangeRef.current()
        }
      })
      .subscribe()

    return () => { 
      console.log('[COUNTS_REALTIME] Cleaning up channel')
      supabase.removeChannel(channel) 
    }
  }, [venueId, tz])
}
