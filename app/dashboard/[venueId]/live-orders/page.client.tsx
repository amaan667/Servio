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
  const [statusFilter, setStatusFilter] = useState<'open'|'pending'|'preparing'|'served'>('open');
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // fetch initial
  useEffect(() => {
    (async () => {
      const url = `/api/live-orders?venueId=${encodeURIComponent(venueId)}${statusFilter ? `&status=${statusFilter}` : ''}`;
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
    if (statusFilter === 'open') return orders.filter(o => o.status !== 'served');
    return orders.filter(o => o.status === statusFilter);
  }, [orders, statusFilter]);

  return (
    <div className="max-w-5xl mx-auto p-6">
      <audio ref={audioRef} src="/assets/new-order.mp3" preload="auto" />
      <div className="flex items-center justify-between mb-4">
        <Link href={`/dashboard/${venueId}`} className="text-sm text-gray-600">← Back to Dashboard</Link>
        <div className="flex gap-2">
          {(['open','pending','preparing','served'] as const).map(s=> (
            <Button key={s} variant={s===statusFilter?'default':'outline'} onClick={()=>setStatusFilter(s)}>
              {s[0].toUpperCase()+s.slice(1)}
            </Button>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        {visible.map(o => (
          <div key={o.id} className="rounded-lg border bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-500">
                {new Date(o.created_at).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' })} • Table {o.table_number ?? '—'}
              </div>
              <div className="text-lg font-semibold">{toMoney(o.computed_total)}</div>
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


