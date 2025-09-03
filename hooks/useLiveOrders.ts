import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

export type Order = {
  id: string
  venue_id: string
  table_number: number
  customer_name: string
  customer_phone?: string
  customer_email?: string
  order_status: string
  total_amount: number
  items: Array<{
    menu_item_id: string
    quantity: number
    price: number
    item_name: string
    specialInstructions?: string
  }>
  created_at: string
  updated_at: string
}

const LIVE_STATUSES = ['PLACED', 'ACCEPTED', 'IN_PREP', 'READY', 'OUT_FOR_DELIVERY', 'SERVING'] as const

// Optional: add a 4s safety timeout (never spin forever)
async function withTimeout<T>(p: Promise<T>, ms = 4000): Promise<T> {
  return await Promise.race([
    p,
    new Promise<T>((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))
  ])
}

export function useLiveOrders(venueId: string) {
  const [data, setData] = useState<Order[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isError, setIsError] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchOrders = useCallback(async () => {
    if (!venueId) return

    setIsLoading(true)
    setIsError(false)
    setError(null)

    try {
      const supabase = createClient()
      if (!supabase) {
        throw new Error('Supabase client not available')
      }

      // IMPORTANT: mirror the exact filter logic used for the badge count
      const queryPromise = supabase
        .from('orders')
        .select(
          'id, venue_id, table_number, customer_name, customer_phone, customer_email, order_status, total_amount, items, created_at, updated_at',
          { count: 'exact' }
        )
        .eq('venue_id', venueId)
        .in('order_status', LIVE_STATUSES as unknown as string[])
        .gte('created_at', new Date(new Date().setHours(0,0,0,0)).toISOString()) // today only
        .lte('created_at', new Date(new Date().setHours(23,59,59,999)).toISOString())
        .order('created_at', { ascending: false })
        .limit(100) // avoid accidental infinite loading
        .throwOnError()

      // Wrap with timeout to prevent infinite loading
      const { data, error } = await withTimeout(queryPromise, 5000)

      // Always return an array (even empty) so the spinner can resolve
      setData(data ?? [])
    } catch (err: any) {
      console.error('[AUTH DEBUG] Failed to fetch live orders:', err)
      setIsError(true)
      setError(err.message || 'Failed to load orders')
    } finally {
      setIsLoading(false)
    }
  }, [venueId])

  useEffect(() => {
    fetchOrders()
  }, [fetchOrders])

  // Auto-refresh every 15 seconds
  useEffect(() => {
    const interval = setInterval(fetchOrders, 15000)
    return () => clearInterval(interval)
  }, [fetchOrders])

  return { 
    data, 
    isLoading, 
    isError, 
    error, 
    refetch: fetchOrders 
  }
}
