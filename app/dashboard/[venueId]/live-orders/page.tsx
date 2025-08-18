// app/dashboard/[venueId]/live-orders/page.client.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import NavBar from '@/components/NavBar';
import { supabase } from '@/lib/sb-client';
import { Clock, ArrowLeft, User } from 'lucide-react';
import { todayWindowForTZ } from '@/lib/time';
import NavigationBreadcrumb from '@/components/navigation-breadcrumb';
import Link from 'next/link';

type Order = {
  id: string;
  venue_id: string;
  table_number: number | null;
  customer_name: string | null;
  total_amount: number;
  status: 'pending' | 'preparing' | 'served';
  payment_status?: string | null;
  created_at: string;
  items: Array<{ name: string; quantity: number; price: number }>;
};

type Scope = 'live' | 'all' | 'history';

export default function LiveOrdersClient({
  venueId,
  venueName,
  timezone,
}: {
  venueId: string;
  venueName: string;
  timezone?: string;
}) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Scope>('live');
  const [liveOrders, setLiveOrders] = useState<Order[]>([]);
  const [allOrders, setAllOrders] = useState<Order[]>([]);
  const [historyOrders, setHistoryOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  const todayWin = useMemo(() => todayWindowForTZ(timezone || 'Europe/London'), [timezone]);

  async function fetchScope(scope: Scope) {
    const res = await fetch(`/api/dashboard/orders?venueId=${venueId}&scope=${scope}`, {
      headers: { accept: 'application/json' },
      cache: 'no-store',
    });
    const json = await res.json();
    if (!json?.ok) throw new Error(json?.error || 'Failed to load orders');
    const orders: Order[] = json.orders;
    if (scope === 'live') setLiveOrders(orders);
    if (scope === 'all') setAllOrders(orders);
    if (scope === 'history') setHistoryOrders(orders);
  }

  useEffect(() => {
    (async () => {
      try {
        await Promise.all([fetchScope('live'), fetchScope('all'), fetchScope('history')]);
      } catch (e) {
        console.error('[LIVE_ORDERS_CLIENT] initial load failed', e);
      } finally {
        setLoading(false);
      }
    })();

    // realtime: refetch the currently visible scope + all scopes that might be impacted
    const ch = supabase
      .channel('orders-live-dashboard')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders', filter: `venue_id=eq.${venueId}` },
        async () => {
          try {
            // all tabs depend on today's window and older ones; simplest is to refresh all
            await Promise.all([fetchScope('live'), fetchScope('all'), fetchScope('history')]);
          } catch (e) {
            console.error('[LIVE_ORDERS_CLIENT] realtime refresh failed', e);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [venueId]);

  const groupedHistory = useMemo(() => {
    // group by local date string
    const fmt = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    return historyOrders.reduce<Record<string, Order[]>>((acc, o) => {
      const d = fmt.format(new Date(o.created_at));
      (acc[d] ||= []).push(o);
      return acc;
    }, {});
  }, [historyOrders]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'preparing':
        return 'bg-blue-100 text-blue-800';
      case 'served':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getPaymentStatusColor = (paymentStatus?: string | null) => {
    switch (paymentStatus) {
      case 'paid':
        return 'bg-green-100 text-green-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatTime = (dateString: string) =>
    new Date(dateString).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

  const renderOrderCard = (order: Order, showActions = true) => (
    <Card key={order.id} className="hover:shadow-md transition-shadow">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center flex-wrap gap-3">
            <div className="text-sm text-gray-500">{formatTime(order.created_at)}</div>
            <div className="font-medium">Table {order.table_number ?? 'Takeaway'}</div>
            <div className="flex items-center text-sm text-gray-600">
              <User className="h-4 w-4 mr-1" />
              {order.customer_name?.trim() || 'Guest'}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge className={getStatusColor(order.status)}>
              {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
            </Badge>
            {order.payment_status ? (
              <Badge className={getPaymentStatusColor(order.payment_status)}>
                {order.payment_status.toUpperCase()}
              </Badge>
            ) : null}
            <div className="text-lg font-bold">£{order.total_amount.toFixed(2)}</div>
          </div>
        </div>

        <div className="space-y-2 mb-4">
          {order.items.map((it, idx) => (
            <div key={idx} className="flex justify-between text-sm">
              <span>
                {it.quantity}x {it.name}
              </span>
              <span>£{(it.quantity * it.price).toFixed(2)}</span>
            </div>
          ))}
        </div>

        {showActions && (
          <div className="flex gap-2">
            {order.status === 'pending' && (
              <Button
                size="sm"
                onClick={async () => {
                  await supabase.from('orders').update({ status: 'preparing' }).eq('id', order.id).eq('venue_id', venueId);
                  await fetchScope('live');
                  await fetchScope('all');
                }}
              >
                Start Preparing
              </Button>
            )}
            {order.status === 'preparing' && (
              <Button
                size="sm"
                onClick={async () => {
                  await supabase.from('orders').update({ status: 'served' }).eq('id', order.id).eq('venue_id', venueId);
                  await fetchScope('live');
                  await fetchScope('all');
                }}
              >
                Mark Served
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <NavBar />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <NavBar venueId={venueId} />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <NavigationBreadcrumb customBackPath={`/dashboard/${venueId}`} customBackLabel="Dashboard" />
        <h1 className="text-3xl font-bold text-gray-900">Live Orders</h1>
        <p className="text-gray-600 mt-2">
          Real-time order feed for {venueName} • <span className="font-medium">Today</span> • Local time
        </p>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as Scope)} className="w-full mt-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="live">Live ({liveOrders.length})</TabsTrigger>
            <TabsTrigger value="all">All Today ({allOrders.length})</TabsTrigger>
            <TabsTrigger value="history">History ({historyOrders.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="live" className="mt-6">
            <div className="grid gap-6">
              {liveOrders.length === 0 ? (
                <Card>
                  <CardContent className="p-8 text-center">
                    <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No Active Orders</h3>
                    <p className="text-gray-500">New orders will appear here in real-time.</p>
                  </CardContent>
                </Card>
              ) : (
                liveOrders.map((o) => renderOrderCard(o, true))
              )}
            </div>
          </TabsContent>

          <TabsContent value="all" className="mt-6">
            <div className="grid gap-6">
              {allOrders.length === 0 ? (
                <Card>
                  <CardContent className="p-8 text-center">
                    <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No Orders Today</h3>
                    <p className="text-gray-500">All orders from today will appear here.</p>
                  </CardContent>
                </Card>
              ) : (
                allOrders.map((o) => renderOrderCard(o, false))
              )}
            </div>
          </TabsContent>

          <TabsContent value="history" className="mt-6">
            <div className="space-y-8">
              {Object.keys(groupedHistory).length === 0 ? (
                <Card>
                  <CardContent className="p-8 text-center">
                    <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No Historical Orders</h3>
                    <p className="text-gray-500">Previous orders will appear here.</p>
                  </CardContent>
                </Card>
              ) : (
                Object.entries(groupedHistory).map(([date, orders]) => (
                  <div key={date}>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">{date}</h3>
                    <div className="grid gap-6">{orders.map((o) => renderOrderCard(o, false))}</div>
                  </div>
                ))
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}