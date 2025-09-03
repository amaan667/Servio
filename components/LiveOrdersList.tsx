import { useLiveOrders } from '@/hooks/useLiveOrders'
import { useEffect } from 'react'

export default function LiveOrdersList({ venueId }: { venueId: string }) {
  const { data, isLoading, isError, error } = useLiveOrders(venueId)

  console.log(`[LIVE_ORDERS_LIST_DEBUG] Component rendered with:`, {
    venueId,
    dataLength: data?.length || 0,
    isLoading,
    isError,
    error,
    hasData: !!data,
    dataType: typeof data
  })

  // Log every state change
  useEffect(() => {
    console.log(`[LIVE_ORDERS_LIST_DEBUG] State changed:`, {
      isLoading,
      isError,
      error,
      dataLength: data?.length || 0
    })
  }, [isLoading, isError, error, data])

  // Log when component mounts/unmounts
  useEffect(() => {
    console.log(`[LIVE_ORDERS_LIST_DEBUG] Component mounted with venueId: ${venueId}`)
    return () => {
      console.log(`[LIVE_ORDERS_LIST_DEBUG] Component unmounting`)
    }
  }, [venueId])

  if (isLoading) {
    console.log(`[LIVE_ORDERS_LIST_DEBUG] Rendering loading state`)
    // show a 1s skeleton then auto-fallback to empty state if still pending
    return (
      <div className="text-slate-500">
        <div className="flex items-center space-x-2">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-slate-500"></div>
          <span>Loading orders…</span>
        </div>
        <div className="text-xs text-slate-400 mt-2">
          Debug: isLoading={isLoading.toString()}, dataLength={data?.length || 0}
        </div>
      </div>
    )
  }

  if (isError) {
    console.log(`[LIVE_ORDERS_LIST_DEBUG] Rendering error state:`, error)
    return (
      <div className="text-rose-600">
        <div>Failed to load orders. {(error as any)?.message ?? 'Unknown error'}</div>
        <div className="text-xs text-rose-400 mt-1">
          Debug: isError={isError.toString()}, error={error}
        </div>
      </div>
    )
  }

  if (!data || data.length === 0) {
    console.log(`[LIVE_ORDERS_LIST_DEBUG] Rendering empty state:`, { data, dataLength: data?.length })
    return (
      <div className="text-slate-500">
        <div>No active orders at the moment.</div>
        <div className="text-xs text-slate-400 mt-1">
          Debug: data={data ? 'exists' : 'null'}, dataLength={data?.length || 0}
        </div>
      </div>
    )
  }

  console.log(`[LIVE_ORDERS_LIST_DEBUG] Rendering orders list with ${data.length} orders`)
  return (
    <div className="space-y-4">
      <div className="text-sm text-slate-600 mb-4">
        Debug: Found {data.length} orders, first order: {data[0]?.id ? `ID: ${data[0].id.slice(0, 8)}...` : 'No ID'}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {data.map(o => (
          <article key={o.id} className="rounded-xl border p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="font-semibold">£{o.total_amount.toFixed(2)}</span>
              <span className="rounded-full border px-2 py-0.5 text-xs">{o.order_status}</span>
            </div>
            <div className="mt-1 text-sm text-slate-600">
              {o.table_number ? `Table ${o.table_number}` : '—'}
            </div>
            <div className="mt-1 text-sm text-slate-600">
              {o.customer_name}
            </div>
            <div className="mt-1 text-xs text-slate-400">
              {new Date(o.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}
