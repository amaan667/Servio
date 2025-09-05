"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, CheckCircle, XCircle, RefreshCw, Truck, User, Hash } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface OrderItem {
  menu_item_id: string;
  quantity: number;
  price: number;
  item_name: string;
  specialInstructions?: string;
}

interface Order {
  id: string;
  venue_id: string;
  table_number: number;
  customer_name: string;
  customer_phone: string;
  customer_email?: string;
  order_status: string;
  payment_status: string;
  total_amount: number;
  notes?: string;
  items: OrderItem[];
  created_at: string;
  updated_at: string;
}

const ORDER_STATUSES = [
  { key: 'PLACED', label: 'Order Placed', icon: Clock, color: 'bg-yellow-100 text-yellow-800', description: 'Your order has been received and is being prepared' },
  { key: 'ACCEPTED', label: 'Order Accepted', icon: CheckCircle, color: 'bg-blue-100 text-blue-800', description: 'Your order has been accepted by the kitchen' },
  { key: 'IN_PREP', label: 'In Preparation', icon: RefreshCw, color: 'bg-orange-100 text-orange-800', description: 'Your food is being prepared in the kitchen' },
  { key: 'READY', label: 'Ready for Pickup', icon: CheckCircle, color: 'bg-green-100 text-green-800', description: 'Your order is ready! Please collect from the counter' },
  { key: 'OUT_FOR_DELIVERY', label: 'Out for Delivery', icon: Truck, color: 'bg-purple-100 text-purple-800', description: 'Your order is on its way to you' },
  { key: 'SERVING', label: 'Being Served', icon: CheckCircle, color: 'bg-green-100 text-green-800', description: 'Your order is being served to your table' },
  { key: 'COMPLETED', label: 'Order Completed', icon: CheckCircle, color: 'bg-green-100 text-green-800', description: 'Thank you for your order!' },
  { key: 'CANCELLED', label: 'Order Cancelled', icon: XCircle, color: 'bg-red-100 text-red-800', description: 'Your order has been cancelled' },
  { key: 'REFUNDED', label: 'Order Refunded', icon: XCircle, color: 'bg-red-100 text-red-800', description: 'Your order has been refunded' },
  { key: 'EXPIRED', label: 'Order Expired', icon: XCircle, color: 'bg-gray-100 text-gray-800', description: 'Your order has expired' }
];

export default function OrderTrackingPage() {
  const params = useParams();
  const orderId = params.orderId as string;
  
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  const supabase = createClient();

  const fetchOrder = async () => {
    if (!orderId) return;

    try {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .single();

      if (error) {
        console.error('Failed to fetch order:', error);
        setError('Order not found or access denied');
        return;
      }

      setOrder(data);
      setLastUpdate(new Date());
    } catch (err) {
      console.error('Error fetching order:', err);
      setError('Failed to load order details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrder();

    // Set up real-time subscription for order updates
    if (supabase && orderId) {
      console.log('Setting up real-time subscription for order:', orderId);
      
      const channel = supabase
        .channel(`order-tracking-${orderId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'orders',
            filter: `id=eq.${orderId}`,
          },
          (payload) => {
            console.log('Order update detected:', payload);
            
            if (payload.eventType === 'UPDATE') {
              console.log('Order status updated:', {
                oldStatus: payload.old?.order_status,
                newStatus: payload.new?.order_status,
                orderId: payload.new?.id
              });
              
              // Update the order with new data
              setOrder(prevOrder => {
                if (!prevOrder) return null;
                
                const updatedOrder = { ...prevOrder, ...payload.new };
                console.log('Updated order:', updatedOrder);
                return updatedOrder;
              });
              
              setLastUpdate(new Date());
            } else if (payload.eventType === 'DELETE') {
              console.log('Order deleted:', payload.old);
              setError('This order has been cancelled or deleted');
            }
          }
        )
        .subscribe((status) => {
          console.log('Real-time subscription status:', status);
          
          if (status === 'SUBSCRIBED') {
            console.log('Successfully subscribed to order updates');
          } else if (status === 'CHANNEL_ERROR') {
            console.error('Real-time subscription error');
          }
        });

      return () => {
        console.log('Cleaning up real-time subscription');
        supabase.removeChannel(channel);
      };
    }
  }, [orderId, supabase]);

  const getStatusInfo = (status: string) => {
    return ORDER_STATUSES.find(s => s.key === status) || ORDER_STATUSES[0];
  };

  const getCurrentStatusIndex = () => {
    if (!order) return -1;
    return ORDER_STATUSES.findIndex(s => s.key === order.order_status);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
    }).format(amount);
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-servio-purple mx-auto mb-4"></div>
          <p className="text-gray-600">Loading order details...</p>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <XCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Order Not Found</h1>
          <p className="text-gray-600 mb-4">{error || 'The order you are looking for could not be found.'}</p>
          <Button onClick={() => window.history.back()}>Go Back</Button>
        </div>
      </div>
    );
  }

  const currentStatusIndex = getCurrentStatusIndex();

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-2xl mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Order Tracking</h1>
          <p className="text-gray-600 text-sm sm:text-base">Track your order in real-time</p>
        </div>

        {/* Order Summary Card */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Order #{order.id.slice(0, 8).toUpperCase()}</span>
              <Badge variant="outline" className="text-sm">
                Table {order.table_number}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium text-gray-500">Customer:</span>
                <p className="text-gray-900">{order.customer_name}</p>
              </div>
              <div>
                <span className="font-medium text-gray-500">Total:</span>
                <p className="text-gray-900 font-semibold">{formatCurrency(order.total_amount)}</p>
              </div>
              <div>
                <span className="font-medium text-gray-500">Placed:</span>
                <p className="text-gray-900">{formatTime(order.created_at)}</p>
              </div>
              <div>
                <span className="font-medium text-gray-500">Last Updated:</span>
                <p className="text-gray-900">{formatTime(order.updated_at)}</p>
              </div>
            </div>
            
            {order.notes && (
              <div>
                <span className="font-medium text-gray-500">Special Instructions:</span>
                <p className="text-gray-900 mt-1">{order.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Order Status Timeline */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-2 sm:space-y-0">
              <span>Order Progress</span>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={fetchOrder}
                className="flex items-center gap-2 w-full sm:w-auto"
              >
                <RefreshCw className="h-4 w-4" />
                Refresh
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {ORDER_STATUSES.map((status, index) => {
                const isCompleted = index <= currentStatusIndex;
                const isCurrent = index === currentStatusIndex;
                const Icon = status.icon;
                
                return (
                  <div key={status.key} className="flex items-start space-x-4">
                    <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                      isCompleted 
                        ? 'bg-servio-purple text-white' 
                        : 'bg-gray-200 text-gray-400'
                    }`}>
                      {isCompleted ? (
                        <CheckCircle className="h-5 w-5" />
                      ) : (
                        <Icon className="h-5 w-5" />
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2">
                        <h3 className={`text-sm font-medium ${
                          isCurrent ? 'text-servio-purple' : 'text-gray-900'
                        }`}>
                          {status.label}
                        </h3>
                        {isCurrent && (
                          <Badge className={status.color}>
                            Current
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 mt-1">
                        {status.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Order Items */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Order Items</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {order.items.map((item, index) => (
                <div key={index} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-b-0">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <span className="font-medium text-gray-900">{item.item_name}</span>
                      <span className="text-sm text-gray-500">×{item.quantity}</span>
                    </div>
                    {item.specialInstructions && (
                      <p className="text-sm text-gray-600 mt-1 italic">
                        "{item.specialInstructions}"
                      </p>
                    )}
                  </div>
                  <span className="font-medium text-gray-900">
                    {formatCurrency(item.price * item.quantity)}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center text-sm text-gray-500">
          <p>Last updated: {lastUpdate.toLocaleTimeString()}</p>
          <p className="mt-1">This page updates automatically</p>
        </div>
      </div>
    </div>
  );
}
