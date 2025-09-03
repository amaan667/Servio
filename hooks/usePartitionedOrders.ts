import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { timeWindows } from '@/lib/time-windows'

const baseCols = 'id, venue_id, status, total_amount, table_label, created_at, updated_at'

export function useLiveOrders(venueId: string, venueTz: string) {
  const [data, setData] = useState<{ rows: any[], count: number }>({ rows: [], count: 0 })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchOrders = useCallback(async () => {
    if (!venueId || !venueTz) return
    
    setIsLoading(true)
    setError(null)
    
    try {
      const { thirtyMinAgoUtc } = timeWindows(venueTz)
      const supabase = createClient()
      
      const { data: result, error: queryError, count } = await supabase
        .from('orders')
        .select(baseCols, { count: 'exact' })
        .eq('venue_id', venueId)
        .gte('created_at', thirtyMinAgoUtc.toISOString())
        .order('created_at', { ascending: false })
        .throwOnError()
      
      if (queryError) {
        console.error('[LIVE_ORDERS] Query error:', queryError)
        setError(queryError.message)
        return
      }
      
      setData({ rows: result ?? [], count: count ?? 0 })
    } catch (err) {
      console.error('[LIVE_ORDERS] Fetch error:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setIsLoading(false)
    }
  }, [venueId, venueTz])

  useEffect(() => {
    fetchOrders()
  }, [fetchOrders])

  return { data, isLoading, error, refetch: fetchOrders }
}

export function useTodayOrders(venueId: string, venueTz: string) {
  const [data, setData] = useState<{ rows: any[], count: number }>({ rows: [], count: 0 })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchOrders = useCallback(async () => {
    if (!venueId || !venueTz) return
    
    setIsLoading(true)
    setError(null)
    
    try {
      const { startOfTodayUtc, thirtyMinAgoUtc } = timeWindows(venueTz)
      const supabase = createClient()
      
      const { data: result, error: queryError, count } = await supabase
        .from('orders')
        .select(baseCols, { count: 'exact' })
        .eq('venue_id', venueId)
        .gte('created_at', startOfTodayUtc.toISOString())
        .lt('created_at', thirtyMinAgoUtc.toISOString())   // exclude Live window
        .order('created_at', { ascending: false })
        .throwOnError()
      
      if (queryError) {
        console.error('[TODAY_ORDERS] Query error:', queryError)
        setError(queryError.message)
        return
      }
      
      setData({ rows: result ?? [], count: count ?? 0 })
    } catch (err) {
      console.error('[TODAY_ORDERS] Fetch error:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setIsLoading(false)
    }
  }, [venueId, venueTz])

  useEffect(() => {
    fetchOrders()
  }, [fetchOrders])

  return { data, isLoading, error, refetch: fetchOrders }
}

export function useHistoryOrders(venueId: string, venueTz: string) {
  const [data, setData] = useState<{ rows: any[], count: number }>({ rows: [], count: 0 })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchOrders = useCallback(async () => {
    if (!venueId || !venueTz) return
    
    setIsLoading(true)
    setError(null)
    
    try {
      const { startOfTodayUtc } = timeWindows(venueTz)
      const supabase = createClient()
      
      const { data: result, error: queryError, count } = await supabase
        .from('orders')
        .select(baseCols, { count: 'exact' })
        .eq('venue_id', venueId)
        .lt('created_at', startOfTodayUtc.toISOString())   // strictly before today
        .order('created_at', { ascending: false })
        .throwOnError()
      
      if (queryError) {
        console.error('[HISTORY_ORDERS] Query error:', queryError)
        setError(queryError.message)
        return
      }
      
      setData({ rows: result ?? [], count: count ?? 0 })
    } catch (err) {
      console.error('[HISTORY_ORDERS] Fetch error:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setIsLoading(false)
    }
  }, [venueId, venueTz])

  useEffect(() => {
    fetchOrders()
  }, [fetchOrders])

  return { data, isLoading, error, refetch: fetchOrders }
}
