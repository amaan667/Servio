'use client';

import { useState, useEffect } from 'react';
import { useAuth } from "@/app/auth/AuthProvider";
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react';

interface Order {
  id: string;
  order_number: number;
  table_number: number;
  customer_name: string;
  status: string;
  total_amount: number;
  created_at: string;
  order_items: OrderItem[];
}

interface OrderItem {
  id: string;
  item_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

export default function LiveOrdersPageClient({ venueId }: { venueId: string }) {
  const { session } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  const supabase = createClient();

  useEffect(() => {
    if (session?.user) {
      fetchOrders();
      // Set up real-time subscription
      const channel = supabase()
        .channel('orders')
        .on('postgres_changes', 
          { event: '*', schema: 'public', table: 'orders', filter: `venue_id=eq.${venueId}` },
          () => {
            fetchOrders();
          }
        )
        .subscribe();

      return () => {
        supabase().removeChannel(channel);
      };
    }
  }, [session, venueId]);

  const fetchOrders = async () => {
    try {
      const { data, error } = await supabase()
        .from('orders')
        .select(`
          *,
          order_items (*)
        `)
        .eq('venue_id', venueId)
        .in('status', ['pending', 'preparing', 'ready'])
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching orders:', error);
      } else {
        setOrders(data || []);
      }
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateOrderStatus = async (orderId: string, status: string) => {
    try {
      const { error } = await supabase()
        .from('orders')
        .update({ status })
        .eq('id', orderId);

      if (error) {
        console.error('Error updating order status:', error);
      } else {
        // Update local state
        setOrders(prev => prev.map(order => 
          order.id === orderId ? { ...order, status } : order
        ));
      }
    } catch (error) {
      console.error('Error updating order status:', error);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="w-4 h-4 text-yellow-500" />;
      case 'preparing':
        return <AlertCircle className="w-4 h-4 text-blue-500" />;
      case 'ready':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      default:
        return <XCircle className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'preparing':
        return 'bg-blue-100 text-blue-800';
      case 'ready':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Live Orders</h1>
        <Badge variant="outline" className="text-sm">
          {orders.length} active orders
        </Badge>
      </div>

      <div className="grid gap-4">
        {orders.map((order) => (
          <Card key={order.id} className="border-l-4 border-l-purple-500">
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    Order #{order.order_number}
                    {getStatusIcon(order.status)}
                  </CardTitle>
                  <p className="text-sm text-gray-600">
                    Table {order.table_number} • {order.customer_name}
                  </p>
                  <p className="text-xs text-gray-500">
                    {formatTime(order.created_at)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={getStatusColor(order.status)}>
                    {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                  </Badge>
                  <span className="font-semibold">
                    £{(order.total_amount / 100).toFixed(2)}
                  </span>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {order.order_items.map((item) => (
                  <div key={item.id} className="flex justify-between items-center text-sm">
                    <span>
                      {item.quantity}x {item.item_name}
                    </span>
                    <span className="text-gray-600">
                      £{(item.total_price / 100).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
              
              <div className="flex gap-2 mt-4 pt-4 border-t">
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
                    onClick={() => updateOrderStatus(order.id, 'ready')}
                  >
                    Mark Ready
                  </Button>
                )}
                {order.status === 'ready' && (
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => updateOrderStatus(order.id, 'completed')}
                  >
                    Complete Order
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {orders.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center">
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">All caught up!</h3>
            <p className="text-gray-600">No active orders at the moment.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

