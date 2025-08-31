"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/lib/supabase/client";
import { Clock, ArrowLeft, User } from "lucide-react";
import { todayWindowForTZ } from "@/lib/dates";


interface Order {
  id: string;
  venue_id: string;
  table_number: number | null;
  customer_name: string | null;
  customer_phone?: string | null;
  items: Array<{
    name: string;
    quantity: number;
    price: number;
  }>;
  total_amount: number;
  created_at: string;
  status: 'pending' | 'preparing' | 'served';
  payment_status?: string;
}

interface LiveOrdersClientProps {
  venueId: string;
  venueName?: string;
}

interface GroupedHistoryOrders {
  [date: string]: Order[];
}



export default function LiveOrdersClient({ venueId, venueName: venueNameProp }: LiveOrdersClientProps) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [allOrders, setAllOrders] = useState<Order[]>([]);
  const [historyOrders, setHistoryOrders] = useState<Order[]>([]);
  const [groupedHistoryOrders, setGroupedHistoryOrders] = useState<GroupedHistoryOrders>({});
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [todayWindow, setTodayWindow] = useState<{ startUtcISO: string; endUtcISO: string } | null>(null);
  const [activeTab, setActiveTab] = useState("live");
  // State to hold the venue name for display in the UI
  const [venueName, setVenueName] = useState<string>(venueNameProp || '');

  useEffect(() => {
    const loadVenueAndOrders = async () => {
      let venueTimezone;
      if (!venueNameProp) {
        const { data: venueData } = await supabase
          .from('venues')
          .select('name')
          .eq('venue_id', venueId)
          .single();
        setVenueName(venueData?.name || '');
        venueTimezone = 'Europe/London'; // Default timezone
      }
      const window = todayWindowForTZ(venueTimezone);
      setTodayWindow(window);
      
      // Load live orders (pending/preparing from today)
      // Load live orders (pending/preparing from today)
      const { data: liveData, error: liveError } = await supabase
        .from('orders')
        .select('*')
        .eq('venue_id', venueId)
        .in('status', ['pending', 'preparing'])
        .gte('created_at', window.startUtcISO)
        .lt('created_at', window.endUtcISO)
        .order('created_at', { ascending: false });

      // Load all orders from today
      const { data: allData, error: allError } = await supabase
        .from('orders')
        .select('*')
        .eq('venue_id', venueId)
        .gte('created_at', window.startUtcISO)
        .lt('created_at', window.endUtcISO)
        .order('created_at', { ascending: false });

      // Load history orders (not from today)
      const { data: historyData, error: historyError } = await supabase
        .from('orders')
        .select('*')
        .eq('venue_id', venueId)
        .lt('created_at', window.startUtcISO)
        .order('created_at', { ascending: false })
        .limit(100); // Limit to last 100 orders

      if (!liveError && liveData) {
        setOrders(liveData as Order[]);
      }
      if (!allError && allData) {
        setAllOrders(allData as Order[]);
      }
      if (!historyError && historyData) {
        const history = historyData as Order[];
        setHistoryOrders(history);
        
        // Group history orders by date
        const grouped = history.reduce((acc: GroupedHistoryOrders, order) => {
          const date = new Date(order.created_at).toLocaleDateString('en-GB', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
          });
          if (!acc[date]) {
            acc[date] = [];
          }
          acc[date].push(order);
          return acc;
        }, {});
        setGroupedHistoryOrders(grouped);
      }
      setLoading(false);
    };

    loadVenueAndOrders();

    // Set up real-time subscription
    const channel = supabase
      .channel('orders')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'orders',
          filter: `venue_id=eq.${venueId}`
        }, 
        (payload) => {
          const orderCreatedAt = (payload.new as Order)?.created_at || (payload.old as Order)?.created_at;
          const isInTodayWindow = orderCreatedAt && todayWindow && orderCreatedAt >= todayWindow.startUtcISO && orderCreatedAt < todayWindow.endUtcISO;
          
          if (payload.eventType === 'INSERT') {
            const newOrder = payload.new as Order;
            if (isInTodayWindow) {
              setOrders(prev => [newOrder, ...prev]);
              setAllOrders(prev => [newOrder, ...prev]);
            } else {
              setHistoryOrders(prev => [newOrder, ...prev]);
              // Update grouped history
              const date = new Date(newOrder.created_at).toLocaleDateString('en-GB', {
                day: '2-digit',
                month: 'short',
                year: 'numeric'
              });
              setGroupedHistoryOrders(prev => ({
                ...prev,
                [date]: [newOrder, ...(prev[date] || [])]
              }));
            }
          } else if (payload.eventType === 'UPDATE') {
            const updatedOrder = payload.new as Order;
            if (isInTodayWindow) {
              setOrders(prev => prev.map(order => 
                order.id === updatedOrder.id ? updatedOrder : order
              ));
              setAllOrders(prev => prev.map(order => 
                order.id === updatedOrder.id ? updatedOrder : order
              ));
            } else {
              setHistoryOrders(prev => prev.map(order => 
                order.id === updatedOrder.id ? updatedOrder : order
              ));
            }
          } else if (payload.eventType === 'DELETE') {
            const deletedOrder = payload.old as Order;
            if (isInTodayWindow) {
              setOrders(prev => prev.filter(order => order.id !== deletedOrder.id));
              setAllOrders(prev => prev.filter(order => order.id !== deletedOrder.id));
            } else {
              setHistoryOrders(prev => prev.filter(order => order.id !== deletedOrder.id));
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [venueId]);

  const updateOrderStatus = async (orderId: string, status: 'preparing' | 'served') => {
    const { error } = await supabase
      .from('orders')
      .update({ status })
      .eq('id', orderId)
      .eq('venue_id', venueId);

    if (!error) {
      setOrders(prev => prev.map(order => 
        order.id === orderId ? { ...order, status } : order
      ));
      setAllOrders(prev => prev.map(order => 
        order.id === orderId ? { ...order, status } : order
      ));
    }
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-GB', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'preparing': return 'bg-blue-100 text-blue-800';
      case 'served': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPaymentStatusColor = (paymentStatus: string) => {
    switch (paymentStatus) {
      case 'paid': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const renderOrderCard = (order: Order, showActions: boolean = true) => (
    <Card key={order.id} className="hover:shadow-md transition-shadow">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-4">
            <div className="text-sm text-gray-500">
              {formatTime(order.created_at)}
            </div>
            <div className="font-medium">
              Table {order.table_number || 'Takeaway'}
            </div>
            {order.customer_name && (
              <div className="flex items-center text-sm text-gray-600">
                <User className="h-4 w-4 mr-1" />
                {order.customer_name}
              </div>
            )}
            {!order.customer_name && (
              <div className="flex items-center text-sm text-gray-500">
                <User className="h-4 w-4 mr-1" />
                Guest
              </div>
            )}
          </div>
          <div className="flex items-center space-x-2">
            <Badge className={getStatusColor(order.status)}>
              {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
            </Badge>
            {order.payment_status && (
              <Badge className={getPaymentStatusColor(order.payment_status)}>
                {order.payment_status.toUpperCase()}
              </Badge>
            )}
            <div className="text-lg font-bold">
              £{order.total_amount.toFixed(2)}
            </div>
          </div>
        </div>

        {/* Order Items */}
        <div className="space-y-2 mb-4">
          {order.items.map((item, index) => (
            <div key={index} className="flex justify-between text-sm">
              <span>{item.quantity}x {item.name}</span>
              <span>£{(item.quantity * item.price).toFixed(2)}</span>
            </div>
          ))}
        </div>

        {/* Action Buttons */}
        {showActions && (
          <div className="flex space-x-2">
            {order.status === 'pending' && (
              <Button 
                size="sm"
                onClick={() => updateOrderStatus(order.id, 'preparing')}
              >
                Start Preparing
              </Button>
            )}
            {order.status === 'preparing' && (
              <Button 
                size="sm"
                onClick={() => updateOrderStatus(order.id, 'served')}
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
  {/* NavBar is rendered by the server component */}
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
  {/* NavBar is rendered by the server component */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Live Orders</h1>
          <p className="text-gray-600 mt-2">Real-time order feed for {venueName} • Today • Local time</p>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="live">Live Orders ({orders.length})</TabsTrigger>
            <TabsTrigger value="all">All Today ({allOrders.length})</TabsTrigger>
            <TabsTrigger value="history">History ({historyOrders.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="live" className="mt-6">
            <div className="grid gap-6">
              {orders.length === 0 ? (
                <Card>
                  <CardContent className="p-8 text-center">
                    <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No Active Orders</h3>
                    <p className="text-gray-500">New orders will appear here in real-time</p>
                  </CardContent>
                </Card>
              ) : (
                orders.map((order) => renderOrderCard(order, true))
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
                    <p className="text-gray-500">All orders from today will appear here</p>
                  </CardContent>
                </Card>
              ) : (
                allOrders.map((order) => renderOrderCard(order, false))
              )}
            </div>
          </TabsContent>

          <TabsContent value="history" className="mt-6">
            <div className="space-y-8">
              {Object.keys(groupedHistoryOrders).length === 0 ? (
                <Card>
                  <CardContent className="p-8 text-center">
                    <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No Historical Orders</h3>
                    <p className="text-gray-500">Previous orders will appear here</p>
                  </CardContent>
                </Card>
              ) : (
                Object.entries(groupedHistoryOrders).map(([date, orders]) => (
                  <div key={date}>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">{date}</h3>
                    <div className="grid gap-6">
                      {orders.map((order) => renderOrderCard(order, false))}
                    </div>
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