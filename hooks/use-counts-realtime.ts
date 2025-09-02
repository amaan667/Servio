import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useQueryClient } from '@tanstack/react-query'

export function useCountsRealtime(venueId: string, tz: string) {
  const supabase = createClient()
  const queryClient = useQueryClient()

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
        console.log('[COUNTS_REALTIME] Order changed, invalidating tab counts')
        queryClient.invalidateQueries({ 
          queryKey: ['tab-counts', venueId, tz] 
        })
      })
      .subscribe()

    return () => { 
      console.log('[COUNTS_REALTIME] Cleaning up channel')
      supabase.removeChannel(channel) 
    }
  }, [venueId, tz, queryClient])
}
