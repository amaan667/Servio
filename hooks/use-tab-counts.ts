import { createClient } from '@/lib/supabase/client'
import { useQuery } from '@tanstack/react-query'

export interface TabCounts {
  live_count: number
  earlier_today_count: number
  history_count: number
}

export function useTabCounts(venueId: string, tz: string, liveWindowMins = 30) {
  const supabase = createClient()
  
  return useQuery({
    queryKey: ['tab-counts', venueId, tz, liveWindowMins],
    queryFn: async (): Promise<TabCounts> => {
      const { data, error } = await supabase
        .rpc('orders_tab_counts', { 
          p_venue_id: venueId, 
          p_tz: tz, 
          p_live_window_mins: liveWindowMins 
        })
        .single()
      
      if (error) {
        console.error('[TAB_COUNTS] RPC error:', error)
        throw error
      }
      
      console.log('[TAB_COUNTS] RPC result:', data)
      return data
    },
    refetchOnWindowFocus: false,
    staleTime: 10000, // 10 seconds
    enabled: !!venueId && !!tz,
  })
}
