import { createClient } from '@/lib/supabase/client'
import { useState, useEffect, useCallback } from 'react'

export interface TabCounts {
  live_count: number
  earlier_today_count: number
  history_count: number
}

export function useTabCounts(venueId: string, tz: string, liveWindowMins = 30) {
  const [data, setData] = useState<TabCounts | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchCounts = useCallback(async () => {
    if (!venueId || !tz) return
    
    setIsLoading(true)
    setError(null)
    
    try {
      const supabase = createClient()
      const { data: result, error: rpcError } = await supabase
        .rpc('orders_tab_counts', { 
          p_venue_id: venueId, 
          p_tz: tz, 
          p_live_window_mins: liveWindowMins 
        })
        .single()
      
      if (rpcError) {
        console.error('[TAB_COUNTS] RPC error:', rpcError)
        setError(rpcError.message)
        return
      }
      
      console.log('[TAB_COUNTS] RPC result:', result)
      setData(result)
    } catch (err) {
      console.error('[TAB_COUNTS] Fetch error:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setIsLoading(false)
    }
  }, [venueId, tz, liveWindowMins])

  useEffect(() => {
    fetchCounts()
  }, [fetchCounts])

  return { data, isLoading, error, refetch: fetchCounts }
}
