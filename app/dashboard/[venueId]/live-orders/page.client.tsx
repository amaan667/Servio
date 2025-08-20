'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { toMoney } from '@/lib/money';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useTick } from '@/hooks/use-tick';
import { useToast } from '@/components/ui/use-toast';
import Link from 'next/link';
import NavigationBreadcrumb from '@/components/navigation-breadcrumb';
import ClientNavBar from '@/components/ClientNavBar';
import { useAuth } from "@/app/authenticated-client-provider";

type Item = {
  id: string;
  item_name: string;
  price: number;
  quantity: number;
  special_instructions?: string | null;
  line_total: number;
};
type Order = {
  id: string;
  table_number: number | null;
  customer_name: string | null;
  computed_total: number;
  status: 'pending'|'preparing'|'served'|'paid';
  payment_status?: 'paid'|'unpaid'|string | null;
  notes?: string | null;
  created_at: string;
  items: Item[];
};

export default function LiveOrdersClient({ venueId }: { venueId: string }) {
  const supabase = createClientComponentClient();
  const [orders, setOrders] = useState<Order[]>([]);
  const [statusFilter, setStatusFilter] = useState<'all'|'preparing'|'served'|'paid'>('preparing');
  const cacheRef = useRef<Record<string, { orders: Order[]; meta?: any }>>({});
  const controllerRef = useRef<AbortController | null>(null);
  const [activeTablesToday, setActiveTablesToday] = useState<number>(0);
  const [tableFilter, setTableFilter] = useState<string>('');
  const [search, setSearch] = useState<string>('');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [connected, setConnected] = useState<boolean>(false);
  // debug UI removed per request
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const tick = useTick();
  const { toast } = useToast();
  const { user } = useAuth();

  // fetch with cache for seamless tab switching
  useEffect(() => {
    (async () => {
      const scope = statusFilter === 'all' ? 'all' : 'today';
      const key = `${statusFilter}:${scope}`;
      const cached = cacheRef.current[key];
      if (cached) {
        setOrders(cached.orders);
        setActiveTablesToday(cached?.meta?.activeTablesToday ?? 0);
      }
      controllerRef.current?.abort();
      const ac = new AbortController();
      controllerRef.current = ac;
      const url = `/api/dashboard/orders?venueId=${encodeURIComponent(venueId)}&status=${statusFilter}&limit=1000&scope=${scope}`;
      try {
        const res = await fetch(url, { cache:'no-store', signal: ac.signal });
        const j = await res.json();
        if (j?.ok) {
          cacheRef.current[key] = { orders: j.orders, meta: j.meta };
          setOrders(j.orders);
          setActiveTablesToday(j?.meta?.activeTablesToday ?? 0);
        }
      } catch {}
    })();
  }, [venueId, statusFilter]);

  // realtime
  useEffect(() => {
    const ch = supabase
      .channel(`orders-${venueId}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'orders', filter: `venue_id=eq.${venueId}` },
        (payload) => {
          setOrders((prev) => {
            let next = [...prev];
            if (payload.eventType === 'INSERT') {
              if (audioRef.current) audioRef.current.play().catch(()=>{});
              next = [payload.new as any, ...next];
            } else if (payload.eventType === 'UPDATE') {
              next = next.map(o => o.id === (payload.new as any).id ? { ...o, ...payload.new } as any : o);
            } else if (payload.eventType === 'DELETE') {
              next = next.filter(o => o.id !== (payload.old as any).id);
            }
            return next;
          });
        })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') setConnected(true);
      });
    return () => { setConnected(false); supabase.removeChannel(ch); };
  }, [supabase, venueId]);

  // Fallback poll if realtime drops
  useEffect(() => {
    if (connected) return;
    const id = setInterval(async () => {
      const scope = statusFilter === 'all' ? 'all' : 'today';
      const url = `/api/dashboard/orders?venueId=${encodeURIComponent(venueId)}&status=${statusFilter}&limit=1000&scope=${scope}`;
      const res = await fetch(url, { cache: 'no-store' }).catch(()=>null);
      const j = await res?.json().catch(()=>null);
      if (j?.ok) {
        setOrders(j.orders);
        setActiveTablesToday(j?.meta?.activeTablesToday ?? 0);
      }
    }, 10000);
    return () => clearInterval(id);
  }, [connected, venueId, statusFilter]);

  // actions
  const updateStatus = async (orderId: string, status: Order['status']) => {
    const prev = orders;
    setOrders((p)=>p.map(o=>o.id===orderId?{...o,status}:o));
    try {
      // Legacy endpoint first (works with existing RLS/policies)
      let ok = false; let msg = '';
      try {
        const r1 = await fetch('/api/orders/update-status', { method:'POST', headers:{ 'content-type':'application/json' }, body: JSON.stringify({ orderId, status }) });
        const j1 = await r1.json().catch(()=>({}));
        const serverStatus = j1?.order?.status;
        // Accept delivered as served equivalence
        const matches = (status === 'served' && serverStatus === 'delivered') || serverStatus === status;
        ok = r1.ok && (j1?.ok === true) && !!j1?.order && matches;
        msg = j1?.error || '';
      } catch {}
      if (!ok) {
        const r2 = await fetch(`/api/dashboard/orders/${orderId}`, { method:'PATCH', headers:{ 'content-type':'application/json' }, body: JSON.stringify({ status }) });
        const j2 = await r2.json().catch(()=>({}));
        const serverStatus = j2?.order?.status;
        const matches = (status === 'served' && serverStatus === 'delivered') || serverStatus === status;
        ok = r2.ok && (j2?.ok === true) && !!j2?.order && matches;
        msg = j2?.error || msg || '';
      }
      if (!ok) throw new Error(msg || 'Update failed');
      toast({ title: 'Updated', description: `Order ${orderId.slice(0,6)} → ${status.toUpperCase()}` });
    } catch (e: any) {
      setOrders(prev);
      toast({ title: 'Failed to update', description: e?.message || 'Unknown error' });
    }
  };

  const markPaid = async (orderId: string) => {
    const prev = orders;
    setOrders((p)=>p.map(o=>o.id===orderId?{...o, payment_status: 'paid'}:o));
    try {
      // Try service-role endpoint first via dashboard PATCH (sets payment_status)
      let ok = false; let msg = '';
      try {
        const r1 = await fetch(`/api/dashboard/orders/${orderId}`, { method:'PATCH', headers:{ 'content-type':'application/json' }, body: JSON.stringify({ payment_status: 'paid' }) });
        const j1 = await r1.json().catch(()=>({}));
        ok = r1.ok && (j1?.ok === true);
        msg = j1?.error || '';
      } catch {}
      if (!ok) {
        const res = await fetch('/api/orders/mark-paid', { method:'POST', headers:{ 'content-type':'application/json' }, body: JSON.stringify({ orderId }) });
        const j = await res.json().catch(()=>({}));
        ok = res.ok && (j?.ok === true);
        msg = j?.error || msg || '';
      }
      if (!ok) throw new Error(msg || 'Mark paid failed');
      toast({ title: 'Marked Paid', description: `Order ${orderId.slice(0,6)} paid` });
    } catch (e:any) {
      setOrders(prev);
      toast({ title: 'Failed to mark paid', description: e?.message || 'Unknown error' });
    }
  };

  const deleteOrder = async (orderId: string) => {
    const prev = orders;
    setOrders(prev=>prev.filter(o=>o.id!==orderId));
    try {
      const res = await fetch(`/api/dashboard/orders/${orderId}`, { method:'DELETE' });
      const j = await res.json().catch(()=>({}));
      if (!res.ok || !j?.ok) throw new Error(j?.error || 'Delete failed');
      toast({ title: 'Deleted', description: `Order ${orderId.slice(0,6)} removed` });
    } catch (e:any) {
      setOrders(prev);
      toast({ title: 'Failed to delete', description: e?.message || 'Unknown error' });
    }
  };

  const visibleByDay = useMemo(() => {
    // Helper: get day key in local time (YYYY-MM-DD)
    const dayKey = (iso: string) => {
      const d = new Date(iso);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${dd}`;
    };

    // Apply status/search/table filters on all orders
    let list = [...orders];
    if (statusFilter === 'paid') list = list.filter(o => (o.payment_status ?? 'unpaid') === 'paid');
    else if (statusFilter === 'served') list = list.filter(o => o.status === 'served' || (o as any).status === 'delivered');
    else if (statusFilter === 'preparing') list = list.filter(o => !(o.status === 'served' || (o as any).status === 'delivered'));
    if (tableFilter.trim()) {
      const needle = tableFilter.trim().toLowerCase();
      list = list.filter(o => String(o.table_number ?? '').toLowerCase().includes(needle));
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(o =>
        o.id.toLowerCase().includes(q) ||
        String(o.table_number ?? '').includes(q) ||
        String(o.customer_name ?? '').toLowerCase().includes(q)
      );
    }

    // Group by day
    const groups = list.reduce<Record<string, Order[]>>((acc, o) => {
      const key = dayKey(o.created_at);
      (acc[key] ||= []).push(o);
      return acc;
    }, {});

    // Sort each day by time ascending
    Object.values(groups).forEach(arr => arr.sort((a,b)=> new Date(a.created_at).getTime() - new Date(b.created_at).getTime()));

    // Sort day keys descending (newest day first)
    const sortedKeys = Object.keys(groups).sort((a,b)=> new Date(b).getTime() - new Date(a).getTime());
    return sortedKeys.map(k => ({ key: k, orders: groups[k] }));
  }, [orders, statusFilter, tableFilter, search]);

  const activeTables = useMemo(()=>{
    const since = Date.now() - 24*60*60*1000; // last 24h to match dashboard card logic
    const isRecent = (iso: string) => new Date(iso).getTime() >= since;
    const openRecent = orders.filter(o => isRecent(o.created_at) && !(o.status === 'served' || (o as any).status === 'delivered'));
    return new Set(openRecent.map(o=>o.table_number).filter(v=>v!=null));
  }, [orders]);

             return (
       <div className="min-h-screen bg-gray-50">
         <ClientNavBar venueId={venueId} />
         <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <NavigationBreadcrumb customBackPath={`/dashboard/${venueId}`} customBackLabel="Dashboard" venueId={venueId} />
        <audio ref={audioRef} src="/assets/new-order.mp3" preload="auto" />
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-4">
          {/* Breadcrumb already renders elsewhere; avoid duplicating back link */}
          <div className="flex items-center gap-2 pb-1 flex-wrap">
            <div className="flex items-center text-xs sm:text-sm text-muted-foreground mr-3 flex-shrink-0">
              <span className={`inline-block h-2 w-2 rounded-full mr-1 ${connected ? 'bg-green-500' : 'bg-gray-300'}`}></span>
              Live
            </div>
            <div className="text-xs sm:text-sm text-muted-foreground mr-3 flex-shrink-0">Active Tables: {activeTablesToday}</div>
          <input
            value={search}
            onChange={e=>setSearch(e.target.value)}
            placeholder="Search orders, table, customer"
            className="border rounded px-2 py-1 text-xs sm:text-sm w-48 sm:w-56 flex-shrink-0"
          />
          <input
            value={tableFilter}
            onChange={e=>setTableFilter(e.target.value)}
            placeholder="Filter by table #"
            className="border rounded px-2 py-1 text-xs sm:text-sm flex-shrink-0"
          />
          <div className="flex gap-2 flex-shrink-0 flex-wrap">
          {(['all','preparing','served','paid'] as const).map(s=> (
            <Button key={s} size="sm" className="flex-shrink-0" variant={s===statusFilter?'default':'outline'} onClick={()=>setStatusFilter(s)}>
              {s[0].toUpperCase()+s.slice(1)}
            </Button>
          ))}
          </div>
        </div>
      </div>


      {/* Group by day, then by table for clearer view */}
      <div className="space-y-6">
        {visibleByDay.map(({ key, orders: dayOrders }) => {
          const dateLabel = new Date(key).toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
          // group by table within day
          const byTable = dayOrders.reduce<Record<string, Order[]>>((acc, o) => {
            const t = String(o.table_number ?? '—');
            (acc[t] ||= []).push(o);
            return acc;
          }, {});
          return (
            <div key={key}>
              <div className="text-xs sm:text-sm font-semibold text-muted-foreground mb-2">{dateLabel}</div>
              {Object.entries(byTable).map(([table, list]) => (
                <div key={table} className="rounded-lg border bg-card mb-3">
                  <div className="px-4 py-2 border-b bg-muted text-xs sm:text-sm font-medium sticky top-0 z-10">Table {table}</div>
                  <div className="p-4 space-y-4">
                    {list.map(o => (
          <div key={o.id} className="rounded-lg border bg-card p-3 sm:p-4 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div className="text-xs sm:text-sm text-muted-foreground flex flex-wrap items-center gap-2">
                <span className="font-mono">#{o.id.slice(0,6)}</span>
                <span className="text-foreground">• Table {o.table_number ?? '—'}</span>
                <span className="text-foreground">• {new Date(o.created_at).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' })}</span>
                <StatusChip status={o.status} />
                <PaidChip paid={(o.payment_status ?? 'unpaid') === 'paid'} />
                <RowTimer nowTick={tick} createdAt={o.created_at} />
              </div>
              <div className="text-right sm:min-w-[100px] text-foreground">
                <div className="text-base sm:text-lg font-semibold text-foreground">{toMoney(o.computed_total)}</div>
                 {(o.payment_status ?? 'unpaid') !== 'paid' && !(o.status === 'served' || (o as any).status === 'delivered') && (
                   <Badge className="mt-1 bg-amber-100 text-amber-700">Unpaid</Badge>
                 )}
              </div>
            </div>
            <div className="mt-1 text-[11px] sm:text-xs" />
             <div className="mt-2 text-sm sm:text-[13px] text-foreground">
              {(() => {
                const items = o.items ?? [];
                const isOpen = !!expanded[o.id];
                const toShow = isOpen ? items : items.slice(0, 1);
                return (
                  <>
                    {toShow.map(it => (
                      <div key={it.id} className="flex justify-between py-1">
                        <div>
                          <span className="font-medium">{it.quantity}× {it.item_name}</span>
                          {it.special_instructions ? <span className="text-muted-foreground"> — {it.special_instructions}</span> : null}
                        </div>
                        <div className="ml-2 sm:ml-4">{toMoney(it.line_total)}</div>
                      </div>
                    ))}
                    {items.length > 1 && (
                      <button
                        className="text-xs text-blue-600 mt-1"
                        onClick={() => setExpanded((e) => ({ ...e, [o.id]: !isOpen }))}
                      >
                        {isOpen ? 'Collapse' : `+${items.length - 1} more`}
                      </button>
                    )}
                  </>
                );
              })()}
              {o.notes ? <div className="mt-2 text-muted-foreground italic">Notes: {o.notes}</div> : null}
              {!o.items?.length && (
                <div className="text-xs text-muted-foreground">No items found for this order.</div>
              )}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  const isServed = o.status === 'served' || (o as any).status === 'delivered';
                  updateStatus(o.id, isServed ? 'preparing' : 'served');
                }}
              >
                {(o.status === 'served' || (o as any).status === 'delivered') ? 'Unmark Served' : 'Mark Served'}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  const isPaid = (o.payment_status ?? 'unpaid') === 'paid';
                  if (isPaid) {
                    const prevPaid = o.payment_status;
                    setOrders((p)=>p.map(or=>or.id===o.id?{...or, payment_status: 'pending' as any}:or));
                    fetch(`/api/dashboard/orders/${o.id}`, { method:'PATCH', headers:{ 'content-type':'application/json' }, body: JSON.stringify({ payment_status: 'pending' }) })
                      .then(async r=>{ if(!r.ok){ throw new Error((await r.json().catch(()=>({})))?.error||'Unmark paid failed'); } })
                      .catch(()=> setOrders((p)=>p.map(or=>or.id===o.id?{...or, payment_status: prevPaid }:or)));
                  } else {
                    markPaid(o.id);
                  }
                }}
              >
                {(o.payment_status ?? 'unpaid') === 'paid' ? 'Unmark Paid' : 'Mark Paid'}
              </Button>
              <Button size="sm" variant="destructive" onClick={()=>{ if (confirm('Delete this order?')) deleteOrder(o.id); }}>Delete</Button>
            </div>
           </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          );
        })}
        {visibleByDay.reduce((n,g)=>n+g.orders.length,0) === 0 && (
          <div className="text-center text-gray-500 py-16">No orders yet.</div>
        )}
      </div>
      </div>
    </div>
  );
}

function RowTimer({ createdAt, nowTick }: { createdAt: string; nowTick: number }) {
  const elapsed = Math.max(0, Math.floor((Date.now() - new Date(createdAt).getTime()) / 1000));
  const minutesTotal = Math.floor(elapsed / 60);
  const hours = Math.floor(minutesTotal / 60);
  const mins = minutesTotal % 60;
  const label = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  const color = elapsed > 1200 ? 'text-red-600' : elapsed > 600 ? 'text-orange-500' : 'text-gray-500';
  return <span className={`text-xs ${color}`}>{label}</span>;
}

function StatusChip({ status }: { status: Order['status'] }) {
  const map: Record<Order['status'], string> = {
    pending: 'bg-[#F7C948] text-black',
    preparing: 'bg-[#60A5FA] text-white',
    served: 'bg-[#34D399] text-white',
    paid: 'bg-[#9CA3AF] text-white',
  } as any;
  const text = String(status).toUpperCase();
  return <span className={`text-[10px] rounded px-2 py-0.5 ${map[status] || 'bg-gray-200 text-gray-800'}`}>{text}</span>;
}

function PaidChip({ paid }: { paid: boolean }) {
  if (!paid) return null;
  return <span className="text-[10px] rounded px-2 py-0.5 bg-[#9CA3AF] text-white">PAID</span>;
}

function nextAction(status: Order['status']): { label: string; to: Order['status'] } | null {
  if (status === 'pending') return { label: 'Start Preparing', to: 'preparing' } as any;
  if (status === 'preparing') return { label: 'Mark Served', to: 'served' } as any;
  if (status === 'served') return { label: 'Mark Paid', to: 'paid' } as any;
  return null;
}

