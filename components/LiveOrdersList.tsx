import { useLiveOrders } from '@/hooks/useLiveOrders'

export default function LiveOrdersList({ venueId }: { venueId: string }) {
  const { data, isLoading, isError, error } = useLiveOrders(venueId)

  if (isLoading) {
    // show a 1s skeleton then auto-fallback to empty state if still pending
    return <div className="text-slate-500">Loading orders…</div>
  }

  if (isError) {
    return (
      <div className="text-rose-600">
        Failed to load orders. {(error as any)?.message ?? 'Unknown error'}
      </div>
    )
  }

  if (!data || data.length === 0) {
    return <div className="text-slate-500">No active orders at the moment.</div>
  }

  return (
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
  )
}
