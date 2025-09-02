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
  table_number: number;
  customer_name: string;
  customer_phone?: string;
  customer_email?: string;
  order_status: string;
  total_amount: number;
  notes?: string;
  payment_method?: string;
  payment_status?: string;
  items: Array<{
    menu_item_id: string;
    quantity: number;
    price: number;
    item_name: string;
    specialInstructions?: string;
  }>;
  created_at: string;
  updated_at: string;
}

export default function LiveOrdersPageClient({ venueId }: { venueId: string }) {
  console.log('[LIVE ORDERS DEBUG] Component mounted with venueId:', venueId);
  
  const { session } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  const supabase = createClient();

  useEffect(() => {
    console.log('[LIVE ORDERS DEBUG] useEffect triggered:', {
      hasSession: !!session?.user,
      venueId,
      userId: session?.user?.id
    });
    
    if (session?.user) {
      fetchOrders();
      // Set up real-time subscription
      const channel = supabase()
        .channel('orders')
        .on('postgres_changes', 
          { event: '*', schema: 'public', table: 'orders', filter: `venue_id=eq.${venueId}` },
          () => {
            console.log('[LIVE ORDERS DEBUG] Real-time change detected, refetching orders');
            fetchOrders();
          }
        )
        .subscribe();

      return () => {
        console.log('[LIVE ORDERS DEBUG] Cleaning up real-time subscription');
        supabase().removeChannel(channel);
      };
    }
  }, [session, venueId]);

  const fetchOrders = async () => {
    console.log('[LIVE ORDERS DEBUG] fetchOrders called for venueId:', venueId);
    try {
      const { data, error } = await supabase()
        .from('orders')
        .select('*')
        .eq('venue_id', venueId)
        .in('order_status', ['PLACED', 'ACCEPTED', 'IN_PREP', 'READY', 'OUT_FOR_DELIVERY', 'SERVING'])
        .order('updated_at', { ascending: false });

      if (error) {
        console.error('[LIVE ORDERS DEBUG] Error fetching orders:', error);
      } else {
        console.log('[LIVE ORDERS DEBUG] Orders fetched successfully:', {
          count: data?.length || 0,
          orders: data?.map(order => ({
            id: order.id,
            total_amount: order.total_amount,
            items_count: order.items?.length || 0,
            items: order.items?.map(item => ({
              item_name: item.item_name,
              quantity: item.quantity,
              price: item.price
            }))
          }))
        });
        setOrders(data || []);
      }
    } catch (error) {
      console.error('[LIVE ORDERS DEBUG] Error fetching orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateOrderStatus = async (orderId: string, status: string) => {
    try {
      const { error } = await supabase()
        .from('orders')
        .update({ 
          order_status: status,
          updated_at: new Date().toISOString()
        })
        .eq('id', orderId);

      if (error) {
        console.error('Error updating order status:', error);
        return;
      }
      
      // Update local state
      setOrders(prev => prev.map(order => 
        order.id === orderId ? { ...order, order_status: status } : order
      ));
      
      console.log('[LIVE ORDERS DEBUG] Order status updated successfully');
    } catch (error) {
      console.error('Error updating order status:', error);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'PLACED':
        return <Clock className="w-4 h-4 text-yellow-500" />;
      case 'ACCEPTED':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'IN_PREP':
        return <AlertCircle className="w-4 h-4 text-blue-500" />;
      case 'READY':
        return <CheckCircle className="w-4 h-4 text-orange-500" />;
      case 'OUT_FOR_DELIVERY':
        return <CheckCircle className="w-4 h-4 text-purple-500" />;
      case 'SERVING':
        return <CheckCircle className="w-4 h-4 text-indigo-500" />;
      case 'COMPLETED':
        return <CheckCircle className="w-4 h-4 text-gray-500" />;
      default:
        return <XCircle className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PLACED':
        return 'bg-yellow-100 text-yellow-800';
      case 'ACCEPTED':
        return 'bg-green-100 text-green-800';
      case 'IN_PREP':
        return 'bg-blue-100 text-blue-800';
      case 'READY':
        return 'bg-orange-100 text-orange-800';
      case 'OUT_FOR_DELIVERY':
        return 'bg-purple-100 text-purple-800';
      case 'SERVING':
        return 'bg-indigo-100 text-indigo-800';
      case 'COMPLETED':
        return 'bg-gray-100 text-gray-800';
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
        {console.log('[LIVE ORDERS DEBUG] Rendering orders:', orders.map(order => ({
          id: order.id,
          items_count: order.items?.length || 0,
          items: order.items?.map(item => item.item_name)
        })))}
        {orders.map((order) => (
          <Card key={order.id} className="border-l-4 border-l-purple-500">
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    Order #{order.id.slice(0, 8)}
                    {getStatusIcon(order.order_status)}
                  </CardTitle>
                  <p className="text-sm text-gray-600">
                    Table {order.table_number} • {order.customer_name}
                  </p>
                  <p className="text-xs text-gray-500">
                    {formatTime(order.created_at)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={getStatusColor(order.order_status)}>
                    {order.order_status.replace(/_/g, ' ')
                  </Badge>
                  <span className="font-semibold">
                    £{(() => {
                      // Calculate total from items if total_amount is 0 or missing
                      let amount = order.total_amount;
                      if (!amount || amount <= 0) {
                        amount = order.items.reduce((sum, item) => {
                          const quantity = Number(item.quantity) || 0;
                          const price = Number(item.price) || 0;
                          return sum + (quantity * price);
                        }, 0);
                      }
                      return amount.toFixed(2);
                    })()}
                  </span>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {console.log('[LIVE ORDERS DEBUG] Rendering items for order', order.id, ':', order.items)}
                {order.items && order.items.map((item, index) => {
                  console.log('[LIVE ORDERS DEBUG] Rendering item:', item);
                  return (
                    <div key={index} className="flex justify-between items-center text-sm">
                      <span>
                        {item.quantity}x {item.item_name}
                      </span>
                      <span className="text-gray-600">
                        £{(item.price * item.quantity).toFixed(2)}
                      </span>
                    </div>
                  );
                })}
              </div>
              
              <div className="flex gap-2 mt-4 pt-4 border-t">
                {order.order_status === 'PLACED' && (
                  <Button 
                    size="sm" 
                    onClick={() => updateOrderStatus(order.id, 'ACCEPTED')}
                  >
                    Accept Order
                  </Button>
                )}
                {order.order_status === 'ACCEPTED' && (
                  <Button 
                    size="sm" 
                    onClick={() => updateOrderStatus(order.id, 'IN_PREP')}
                  >
                    Start Preparing
                  </Button>
                )}
                {order.order_status === 'IN_PREP' && (
                  <Button 
                    size="sm" 
                    onClick={() => updateOrderStatus(order.id, 'READY')}
                  >
                    Mark Ready
                  </Button>
                )}
                {order.order_status === 'READY' && (
                  <Button 
                    size="sm" 
                    onClick={() => updateOrderStatus(order.id, 'OUT_FOR_DELIVERY')}
                  >
                    Out for Delivery
                  </Button>
                )}
                {order.order_status === 'OUT_FOR_DELIVERY' && (
                  <Button 
                    size="sm" 
                    onClick={() => updateOrderStatus(order.id, 'SERVING')}
                  >
                    Start Serving
                  </Button>
                )}
                {order.order_status === 'SERVING' && (
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

