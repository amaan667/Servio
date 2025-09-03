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
  console.log(`[LIVE_ORDERS_DEBUG] Setting timeout for ${ms}ms`)
  return await Promise.race([
    p,
    new Promise<T>((_, rej) => setTimeout(() => {
      console.log(`[LIVE_ORDERS_DEBUG] Timeout reached after ${ms}ms`)
      rej(new Error('timeout'))
    }, ms))
  ])
}

export function useLiveOrders(venueId: string) {
  const [data, setData] = useState<Order[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isError, setIsError] = useState(false)
  const [error, setError] = useState<string | null>(null)

  console.log(`[LIVE_ORDERS_DEBUG] Hook initialized with venueId: ${venueId}`)
  console.log(`[LIVE_ORDERS_DEBUG] Current state:`, { data: data.length, isLoading, isError, error })

  const fetchOrders = useCallback(async () => {
    console.log(`[LIVE_ORDERS_DEBUG] fetchOrders called with venueId: ${venueId}`)
    
    if (!venueId) {
      console.log(`[LIVE_ORDERS_DEBUG] No venueId provided, returning early`)
      return
    }

    console.log(`[LIVE_ORDERS_DEBUG] Setting loading states...`)
    setIsLoading(true)
    setIsError(false)
    setError(null)

    try {
      console.log(`[LIVE_ORDERS_DEBUG] Creating Supabase client...`)
      const supabase = createClient()
      
      if (!supabase) {
        console.error(`[LIVE_ORDERS_DEBUG] Supabase client creation failed - client is null/undefined`)
        throw new Error('Supabase client not available')
      }
      
      console.log(`[LIVE_ORDERS_DEBUG] Supabase client created successfully`)

      // Calculate date bounds
      const startOfToday = new Date(new Date().setHours(0,0,0,0)).toISOString()
      const endOfToday = new Date(new Date().setHours(23,59,59,999)).toISOString()
      
      console.log(`[LIVE_ORDERS_DEBUG] Date bounds calculated:`, { startOfToday, endOfToday })
      console.log(`[LIVE_ORDERS_DEBUG] Live statuses:`, LIVE_STATUSES)

      console.log(`[LIVE_ORDERS_DEBUG] Building Supabase query...`)
      
      // IMPORTANT: mirror the exact filter logic used for the badge count
      const queryPromise = supabase
        .from('orders')
        .select(
          'id, venue_id, table_number, customer_name, customer_phone, customer_email, order_status, total_amount, items, created_at, updated_at',
          { count: 'exact' }
        )
        .eq('venue_id', venueId)
        .in('order_status', LIVE_STATUSES as unknown as string[])
        .gte('created_at', startOfToday) // today only
        .lte('created_at', endOfToday)
        .order('created_at', { ascending: false })
        .limit(100) // avoid accidental infinite loading
        .throwOnError()

      console.log(`[LIVE_ORDERS_DEBUG] Query built, executing with timeout...`)
      console.log(`[LIVE_ORDERS_DEBUG] Query details:`, {
        table: 'orders',
        venueId,
        statuses: LIVE_STATUSES,
        dateRange: { startOfToday, endOfToday },
        limit: 100
      })

      // Wrap with timeout to prevent infinite loading
      const { data, error } = await withTimeout(queryPromise, 5000)
      
      console.log(`[LIVE_ORDERS_DEBUG] Query completed successfully!`)
      console.log(`[LIVE_ORDERS_DEBUG] Raw response:`, { data, error })
      console.log(`[LIVE_ORDERS_DEBUG] Data type:`, typeof data)
      console.log(`[LIVE_ORDERS_DEBUG] Data is array:`, Array.isArray(data))
      console.log(`[LIVE_ORDERS_DEBUG] Data length:`, data?.length || 0)

      if (error) {
        console.error(`[LIVE_ORDERS_DEBUG] Query returned error:`, error)
        throw error
      }

      // Always return an array (even empty) so the spinner can resolve
      const ordersArray = data ?? []
      console.log(`[LIVE_ORDERS_DEBUG] Setting orders data:`, { 
        arrayLength: ordersArray.length,
        firstOrder: ordersArray[0] ? { id: ordersArray[0].id, status: ordersArray[0].order_status } : null
      })
      
      setData(ordersArray)
      console.log(`[LIVE_ORDERS_DEBUG] Orders data set successfully`)
      
    } catch (err: any) {
      console.error(`[LIVE_ORDERS_DEBUG] Error in fetchOrders:`, err)
      console.error(`[LIVE_ORDERS_DEBUG] Error details:`, {
        message: err.message,
        stack: err.stack,
        name: err.name,
        code: err.code
      })
      
      setIsError(true)
      setError(err.message || 'Failed to load orders')
      console.log(`[LIVE_ORDERS_DEBUG] Error state set:`, { isError: true, error: err.message })
    } finally {
      console.log(`[LIVE_ORDERS_DEBUG] Finally block - setting loading to false`)
      setIsLoading(false)
      console.log(`[LIVE_ORDERS_DEBUG] Loading state set to false`)
    }
  }, [venueId])

  console.log(`[LIVE_ORDERS_DEBUG] fetchOrders callback created`)

  useEffect(() => {
    console.log(`[LIVE_ORDERS_DEBUG] useEffect for fetchOrders triggered`)
    console.log(`[LIVE_ORDERS_DEBUG] Calling fetchOrders...`)
    fetchOrders()
  }, [fetchOrders])

  // Auto-refresh every 15 seconds
  useEffect(() => {
    console.log(`[LIVE_ORDERS_DEBUG] Setting up auto-refresh interval (15s)`)
    const interval = setInterval(() => {
      console.log(`[LIVE_ORDERS_DEBUG] Auto-refresh triggered`)
      fetchOrders()
    }, 15000)
    
    return () => {
      console.log(`[LIVE_ORDERS_DEBUG] Cleaning up auto-refresh interval`)
      clearInterval(interval)
    }
  }, [fetchOrders])

  console.log(`[LIVE_ORDERS_DEBUG] Hook returning state:`, { 
    dataLength: data.length, 
    isLoading, 
    isError, 
    error,
    hasData: !!data,
    dataType: typeof data
  })

  return { 
    data, 
    isLoading, 
    isError, 
    error, 
    refetch: fetchOrders 
  }
}
