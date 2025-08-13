'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { toMoney } from '@/lib/money';
import { Button } from '@/components/ui/button';
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
  status: 'pending'|'preparing'|'served';
  notes?: string | null;
  created_at: string;
  items: Item[];
};

export default function LiveOrdersClient({ venueId }: { venueId: string }) {
  const supabase = createClientComponentClient();
  const [orders, setOrders] = useState<Order[]>([]);
  const [statusFilter, setStatusFilter] = useState<'all'|'open'|'pending'|'preparing'|'served'>('all');
  const [tableFilter, setTableFilter] = useState<string>('');
  const [debugOpen, setDebugOpen] = useState(false);
  const [debugLoading, setDebugLoading] = useState(false);
  const [debugError, setDebugError] = useState<string | null>(null);
  const [debugData, setDebugData] = useState<any>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // fetch initial
  useEffect(() => {
    (async () => {
      const url = `/api/dashboard/orders?venueId=${encodeURIComponent(venueId)}${statusFilter ? `&status=${statusFilter}` : ''}&limit=1000`;
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
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [supabase, venueId]);

  // actions
  const updateStatus = async (orderId: string, status: 'pending'|'preparing'|'served') => {
    const prev = orders;
    setOrders((p)=>p.map(o=>o.id===orderId?{...o,status}:o));
    const res = await fetch('/api/orders/update-status', {
      method:'POST', headers:{ 'content-type':'application/json' }, body: JSON.stringify({ orderId, status })
    });
    if (!res.ok) setOrders(prev); // revert
  };

  const visible = useMemo(() => {
    let list = statusFilter === 'all'
      ? orders
      : statusFilter === 'open'
        ? orders.filter(o => o.status !== 'served')
        : orders.filter(o => o.status === statusFilter);
    // sort by created_at ascending (oldest first) for historical view
    list = [...list].sort((a,b)=> new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    if (tableFilter.trim()) {
      const needle = tableFilter.trim().toLowerCase();
      list = list.filter(o => String(o.table_number ?? '').toLowerCase().includes(needle));
    }
    return list;
  }, [orders, statusFilter, tableFilter]);

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
          <div className="text-sm text-gray-600 mr-3">Active Tables: {activeTables.size}</div>
          <input
            value={tableFilter}
            onChange={e=>setTableFilter(e.target.value)}
            placeholder="Filter by table #"
            className="border rounded px-2 py-1 text-sm"
          />
          {(['all','open','pending','preparing','served'] as const).map(s=> (
            <Button key={s} variant={s===statusFilter?'default':'outline'} onClick={()=>setStatusFilter(s)}>
              {s[0].toUpperCase()+s.slice(1)}
            </Button>
          ))}
          <Button
            variant={debugOpen ? 'default' : 'outline'}
            onClick={async ()=>{
              if (!debugOpen) {
                setDebugLoading(true); setDebugError(null);
                try {
                  const url = `/api/dashboard/orders?venueId=${encodeURIComponent(venueId)}&status=all&limit=1000`;
                  const res = await fetch(url, { cache:'no-store' });
                  const j = await res.json().catch(()=>({}));
                  if (!res.ok) throw new Error(j?.error || 'Request failed');
                  setDebugData(j);
                } catch (e:any) {
                  setDebugError(e?.message || 'Failed to load');
                } finally {
                  setDebugLoading(false);
                }
              }
              setDebugOpen(v=>!v);
            }}
          >
            {debugOpen ? 'Hide Debug' : 'Show Debug'}
          </Button>
        </div>
      </div>

      {debugOpen && (
        <div className="mb-4 rounded border bg-gray-50 p-3">
          {debugLoading && <div className="text-xs text-gray-600">Loading…</div>}
          {debugError && <div className="text-xs text-red-600">{debugError}</div>}
          {!debugLoading && !debugError && (
            <pre className="text-[11px] whitespace-pre-wrap break-words max-h-96 overflow-auto">{JSON.stringify(debugData, null, 2)}</pre>
          )}
        </div>
      )}

      <div className="space-y-4">
        {visible.map(o => (
          <div key={o.id} className="rounded-lg border bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-500">
                {new Date(o.created_at).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' })} • Table {o.table_number ?? '—'}
              </div>
              <div className="text-lg font-semibold">{toMoney(o.computed_total)}</div>
            </div>
            <div className="mt-1 text-xs text-gray-500">
              Timer: <OrderTimer createdAt={o.created_at} />
            </div>
            <div className="mt-2 text-sm text-gray-700">
              {o.items?.map(it => (
                <div key={it.id} className="flex justify-between py-1">
                  <div>
                    <span className="font-medium">{it.quantity}× {it.item_name}</span>
                    {it.special_instructions ? <span className="text-gray-500"> — {it.special_instructions}</span> : null}
                  </div>
                  <div>{toMoney(it.line_total)}</div>
                </div>
              ))}
              {o.notes ? <div className="mt-2 text-gray-600 italic">Notes: {o.notes}</div> : null}
              {!o.items?.length && (
                <div className="text-xs text-gray-500">No items found for this order.</div>
              )}
            </div>
            <div className="mt-3 flex gap-2">
              {o.status !== 'preparing' && o.status !== 'served' ? (
                <Button onClick={()=>updateStatus(o.id,'preparing')}>Start Preparing</Button>
              ) : null}
              {o.status === 'preparing' ? (
                <Button variant="secondary" onClick={()=>updateStatus(o.id,'pending')}>Mark Pending</Button>
              ) : null}
              {o.status !== 'served' ? (
                <Button variant="outline" onClick={()=>updateStatus(o.id,'served')}>Mark Served</Button>
              ) : (
                <Button variant="outline" onClick={()=>updateStatus(o.id,'preparing')}>Undo Served</Button>
              )}
              <Button variant="outline" onClick={async ()=>{ await fetch('/api/orders/mark-paid',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({orderId:o.id})});}}>Mark Paid</Button>
              <Button variant="destructive" onClick={async ()=>{
                if (!confirm('Delete this order?')) return;
                const res = await fetch('/api/orders/delete', { method:'POST', headers:{ 'content-type':'application/json' }, body: JSON.stringify({ orderId:o.id, venue_id: venueId }) });
                const j = await res.json().catch(()=>({}));
                if (!res.ok || j?.error) { alert(j?.error || 'Failed to delete'); return; }
                setOrders(prev=>prev.filter(or=>or.id!==o.id));
              }}>Delete</Button>
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

function OrderTimer({ createdAt }: { createdAt: string }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const start = new Date(createdAt).getTime();
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 1000);
    return () => clearInterval(id);
  }, [createdAt]);
  const mm = String(Math.floor(elapsed / 60)).padStart(2, '0');
  const ss = String(elapsed % 60).padStart(2, '0');
  return <span>{mm}:{ss}</span>;
}


