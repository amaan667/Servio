"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { NavBar } from "@/components/NavBar";
import { supabase } from "@/lib/sb-client";
import { Clock, ArrowLeft } from "lucide-react";
import { todayWindowForTZ } from "@/lib/time";

interface Order {
  id: string;
  venue_id: string;
  table_number: number | null;
  items: Array<{
    name: string;
    quantity: number;
    price: number;
  }>;
  total_amount: number;
  created_at: string;
  status: 'pending' | 'preparing' | 'served';
}

export default function LiveOrdersClient({ venueId, venueName }: { venueId: string; venueName: string }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [todayWindow, setTodayWindow] = useState<any>(null);
  const router = useRouter();

  useEffect(() => {
    // Load venue timezone and set up today window
    const loadVenueAndOrders = async () => {
      const { data: venueData } = await supabase
        .from('venues')
        .select('timezone')
        .eq('venue_id', venueId)
        .single();
      
      const window = todayWindowForTZ(venueData?.timezone);
      setTodayWindow(window);
      
      // Load initial orders for today only
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('venue_id', venueId)
        .in('status', ['pending', 'preparing'])
        .gte('created_at', window.startUtcISO)
        .lt('created_at', window.endUtcISO)
        .order('created_at', { ascending: false });

      if (!error && data) {
        setOrders(data as Order[]);
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
          console.log('Order change:', payload);
          
          // Only process orders from today
          const orderCreatedAt = payload.new?.created_at || payload.old?.created_at;
          const isInTodayWindow = orderCreatedAt >= todayWindow?.startUtcISO && orderCreatedAt < todayWindow?.endUtcISO;
          
          if (!isInTodayWindow) {
            console.log('Ignoring historical order change');
            return;
          }
          
          if (payload.eventType === 'INSERT') {
            setOrders(prev => [payload.new as Order, ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            setOrders(prev => prev.map(order => 
              order.id === payload.new.id ? payload.new as Order : order
            ));
          } else if (payload.eventType === 'DELETE') {
            setOrders(prev => prev.filter(order => order.id !== payload.old.id));
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
    }
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-GB', { 
      hour: '2-digit', 
      minute: '2-digit' 
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
      <NavBar />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <Button 
            variant="outline" 
            onClick={() => router.push(`/dashboard/${venueId}`)}
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
          <h1 className="text-3xl font-bold text-gray-900">Live Orders</h1>
          <p className="text-gray-600 mt-2">Real-time order feed for {venueName} • Today • Local time</p>
        </div>

        {/* Orders Grid */}
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
            orders.map((order) => (
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
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge className={getStatusColor(order.status)}>
                        {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                      </Badge>
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
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
