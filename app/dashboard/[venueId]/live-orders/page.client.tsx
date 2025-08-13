'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { toMoney } from '@/lib/money';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useTick } from '@/hooks/use-tick';
import { useToast } from '@/components/ui/use-toast';
import Link from 'next/link';

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
  const [statusFilter, setStatusFilter] = useState<'all'|'open'|'pending'|'preparing'|'served'|'paid'>('all');
  const [tableFilter, setTableFilter] = useState<string>('');
  const [search, setSearch] = useState<string>('');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [connected, setConnected] = useState<boolean>(false);
  // debug UI removed per request
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const tick = useTick();
  const { toast } = useToast();

  // fetch initial
  useEffect(() => {
    (async () => {
      const qStatus = statusFilter === 'paid' ? 'all' : statusFilter; // server filters on order.status only
      const url = `/api/dashboard/orders?venueId=${encodeURIComponent(venueId)}${qStatus ? `&status=${qStatus}` : ''}&limit=1000`;
      const res = await fetch(url, { cache:'no-store' });
      const j = await res.json();
      if (j?.ok) setOrders(j.orders);
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
      const url = `/api/dashboard/orders?venueId=${encodeURIComponent(venueId)}&status=${statusFilter}&limit=1000`;
      const res = await fetch(url, { cache: 'no-store' }).catch(()=>null);
      const j = await res?.json().catch(()=>null);
      if (j?.ok) setOrders(j.orders);
    }, 10000);
    return () => clearInterval(id);
  }, [connected, venueId, statusFilter]);

  // actions
  const updateStatus = async (orderId: string, status: Order['status']) => {
    const prev = orders;
    setOrders((p)=>p.map(o=>o.id===orderId?{...o,status}:o));
    try {
      const res = await fetch(`/api/dashboard/orders/${orderId}`, { method:'PATCH', headers:{ 'content-type':'application/json' }, body: JSON.stringify({ status }) });
      const j = await res.json();
      if (!res.ok || !j?.ok) throw new Error(j?.error || 'Update failed');
      toast({ title: 'Updated', description: `Order ${orderId.slice(0,6)} → ${status.toUpperCase()}` });
    } catch (e: any) {
      setOrders(prev);
      toast({ title: 'Failed to update', description: e?.message || 'Unknown error' });
    }
  };

  const markPaid = async (orderId: string) => {
    const prev = orders;
    setOrders((p)=>p.map(o=>o.id===orderId?{...o, status: o.status === 'served' ? 'served' : o.status}:o));
    try {
      const res = await fetch('/api/orders/mark-paid', { method:'POST', headers:{ 'content-type':'application/json' }, body: JSON.stringify({ orderId }) });
      if (!res.ok) throw new Error('Mark paid failed');
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

  const visible = useMemo(() => {
    let list = statusFilter === 'all'
      ? orders
      : statusFilter === 'open'
        ? orders.filter(o => o.status !== 'served')
        : statusFilter === 'paid'
          ? orders.filter(o => (o.payment_status ?? 'unpaid') === 'paid')
          : orders.filter(o => o.status === statusFilter);
    // sort by created_at ascending (oldest first) for historical view
    list = [...list].sort((a,b)=> new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
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
    return list;
  }, [orders, statusFilter, tableFilter, search]);

  const activeTables = useMemo(()=>{
    const today = new Date(); today.setHours(0,0,0,0);
    const sameDay = (iso:string)=>{ const d = new Date(iso); return d.getFullYear()===today.getFullYear() && d.getMonth()===today.getMonth() && d.getDate()===today.getDate(); };
    const openToday = orders.filter(o => sameDay(o.created_at) && o.status !== 'served');
    return new Set(openToday.map(o=>o.table_number).filter(v=>v!=null));
  }, [orders]);

  return (
    <div className="max-w-5xl mx-auto p-6">
      <audio ref={audioRef} src="/assets/new-order.mp3" preload="auto" />
      <div className="flex items-center justify-between mb-4">
        <Link href={`/dashboard/${venueId}`} className="text-sm text-gray-600">← Back to Dashboard</Link>
        <div className="flex items-center gap-2">
          <div className="flex items-center text-sm text-gray-600 mr-3">
            <span className={`inline-block h-2 w-2 rounded-full mr-1 ${connected ? 'bg-green-500' : 'bg-gray-300'}`}></span>
            Live
          </div>
          <div className="text-sm text-gray-600 mr-3">Active Tables: {activeTables.size}</div>
          <input
            value={search}
            onChange={e=>setSearch(e.target.value)}
            placeholder="Search orders, table, customer"
            className="border rounded px-2 py-1 text-sm w-56"
          />
          <input
            value={tableFilter}
            onChange={e=>setTableFilter(e.target.value)}
            placeholder="Filter by table #"
            className="border rounded px-2 py-1 text-sm"
          />
          {(['all','open','pending','preparing','served','paid'] as const).map(s=> (
            <Button key={s} variant={s===statusFilter?'default':'outline'} onClick={()=>setStatusFilter(s)}>
              {s[0].toUpperCase()+s.slice(1)}
            </Button>
          ))}
        </div>
      </div>


      {/* Group by table for clearer view */}
      <div className="space-y-4">
        {Object.entries(
          visible.reduce<Record<string, Order[]>>((acc, o) => {
            const key = String(o.table_number ?? '—');
            (acc[key] ||= []).push(o);
            return acc;
          }, {})
        ).map(([table, list]) => (
          <div key={table} className="rounded-lg border bg-white">
            <div className="px-4 py-2 border-b bg-gray-50 text-sm font-medium">Table {table}</div>
            <div className="p-4 space-y-4">
              {list.map(o => (
          <div key={o.id} className="rounded-lg border bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-600 flex items-center gap-2">
                <span className="font-mono">#{o.id.slice(0,6)}</span>
                <span>• Table {o.table_number ?? '—'}</span>
                <span>• {new Date(o.created_at).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' })}</span>
                <StatusChip status={o.status} />
                <RowTimer nowTick={tick} createdAt={o.created_at} />
              </div>
              <div className="text-right">
                <div className="text-lg font-semibold">{toMoney(o.computed_total)}</div>
                {(o.payment_status ?? 'unpaid') !== 'paid' && (
                  <Badge className="mt-1 bg-amber-100 text-amber-700">Unpaid</Badge>
                )}
              </div>
            </div>
            <div className="mt-1 text-xs">
              
            </div>
             <div className="mt-2 text-sm text-gray-700">
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
                          {it.special_instructions ? <span className="text-gray-500"> — {it.special_instructions}</span> : null}
                        </div>
                        <div>{toMoney(it.line_total)}</div>
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
              {o.notes ? <div className="mt-2 text-gray-600 italic">Notes: {o.notes}</div> : null}
              {!o.items?.length && (
                <div className="text-xs text-gray-500">No items found for this order.</div>
              )}
            </div>
            <div className="mt-3 flex gap-2">
              {nextAction(o.status)?.label ? (
                <Button onClick={()=>{
                  const next = nextAction(o.status)!;
                  if (next.to === 'paid') { markPaid(o.id); }
                  else { updateStatus(o.id, next.to as any); }
                }}>{nextAction(o.status)!.label}</Button>
              ) : null}
              <Button variant="outline" onClick={()=>updateStatus(o.id,'served')}>Mark Served</Button>
              <Button variant="outline" onClick={()=>markPaid(o.id)}>Mark Paid</Button>
              <Button variant="destructive" onClick={()=>{ if (confirm('Delete this order?')) deleteOrder(o.id); }}>Delete</Button>
            </div>
          </div>
              ))}
            </div>
          </div>
        ))}
        {!visible.length && (
          <div className="text-center text-gray-500 py-16">No orders yet.</div>
        )}
      </div>
    </div>
  );
}

function RowTimer({ createdAt, nowTick }: { createdAt: string; nowTick: number }) {
  const elapsed = Math.max(0, Math.floor((Date.now() - new Date(createdAt).getTime()) / 1000));
  const minutes = Math.floor(elapsed / 60);
  const label = `${minutes}m`;
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

function nextAction(status: Order['status']): { label: string; to: Order['status'] } | null {
  if (status === 'pending') return { label: 'Start Preparing', to: 'preparing' } as any;
  if (status === 'preparing') return { label: 'Mark Served', to: 'served' } as any;
  if (status === 'served') return { label: 'Mark Paid', to: 'paid' } as any;
  return null;
}

