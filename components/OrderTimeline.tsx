"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, CheckCircle, XCircle, RefreshCw, Truck, ChefHat, Utensils } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface OrderTimelineProps {
  orderId: string;
  venueId: string;
  className?: string;
}

interface Order {
  id: string;
  order_status: string;
  updated_at: string;
  created_at: string;
}

const ORDER_STATUSES = [
  { 
    key: 'PLACED', 
    label: 'Order Placed', 
    icon: Clock, 
    color: 'bg-yellow-100 text-yellow-800',
    dotColor: 'bg-yellow-500',
    description: 'Your order has been received and is being prepared' 
  },
  { 
    key: 'ACCEPTED', 
    label: 'Order Accepted', 
    icon: CheckCircle, 
    color: 'bg-blue-100 text-blue-800',
    dotColor: 'bg-blue-500',
    description: 'Your order has been accepted by the kitchen' 
  },
  { 
    key: 'IN_PREP', 
    label: 'In Preparation', 
    icon: ChefHat, 
    color: 'bg-orange-100 text-orange-800',
    dotColor: 'bg-orange-500',
    description: 'Your food is being prepared in the kitchen' 
  },
  { 
    key: 'READY', 
    label: 'Ready for Pickup', 
    icon: Utensils, 
    color: 'bg-green-100 text-green-800',
    dotColor: 'bg-green-500',
    description: 'Your order is ready! Please collect from the counter' 
  },
  { 
    key: 'OUT_FOR_DELIVERY', 
    label: 'Out for Delivery', 
    icon: Truck, 
    color: 'bg-purple-100 text-purple-800',
    dotColor: 'bg-purple-500',
    description: 'Your order is on its way to you' 
  },
  { 
    key: 'SERVING', 
    label: 'Being Served', 
    icon: CheckCircle, 
    color: 'bg-green-100 text-green-800',
    dotColor: 'bg-green-500',
    description: 'Your order is being served to your table' 
  },
  { 
    key: 'COMPLETED', 
    label: 'Order Completed', 
    icon: CheckCircle, 
    color: 'bg-green-100 text-green-800',
    dotColor: 'bg-green-500',
    description: 'Thank you for your order!' 
  },
  { 
    key: 'CANCELLED', 
    label: 'Order Cancelled', 
    icon: XCircle, 
    color: 'bg-red-100 text-red-800',
    dotColor: 'bg-red-500',
    description: 'Your order has been cancelled' 
  },
  { 
    key: 'REFUNDED', 
    label: 'Order Refunded', 
    icon: XCircle, 
    color: 'bg-red-100 text-red-800',
    dotColor: 'bg-red-500',
    description: 'Your order has been refunded' 
  },
  { 
    key: 'EXPIRED', 
    label: 'Order Expired', 
    icon: XCircle, 
    color: 'bg-gray-100 text-gray-800',
    dotColor: 'bg-gray-500',
    description: 'Your order has expired' 
  }
];

export default function OrderTimeline({ orderId, venueId, className = "" }: OrderTimelineProps) {
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

      console.log('[ORDER TIMELINE] Fetching order:', orderId);

      const { data, error } = await supabase
        .from('orders')
        .select('id, order_status, updated_at, created_at')
        .eq('id', orderId)
        .single();

      if (error) {
        console.error('[ORDER TIMELINE] Failed to fetch order:', error);
        setError('Order not found or access denied');
        return;
      }

      console.log('[ORDER TIMELINE] Order fetched successfully:', data);
      setOrder(data);
      setLastUpdate(new Date());
    } catch (err) {
      console.error('[ORDER TIMELINE] Error fetching order:', err);
      setError('Failed to load order details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrder();

    // Set up real-time subscription for order updates
    console.log('[ORDER TIMELINE] Setting up real-time subscription for order:', orderId);
    
    const channel = supabase
      .channel(`order-timeline-${orderId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `id=eq.${orderId}`,
        },
        (payload: any) => {
          console.log('[ORDER TIMELINE] Real-time update received:', payload);
          if (payload.new) {
            setOrder(payload.new);
            setLastUpdate(new Date());
          }
        }
      )
      .subscribe();

    return () => {
      console.log('[ORDER TIMELINE] Cleaning up real-time subscription');
      supabase.removeChannel(channel);
    };
  }, [orderId, supabase]);

  const getCurrentStatusIndex = () => {
    if (!order) return -1;
    return ORDER_STATUSES.findIndex(status => status.key === order.order_status);
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-GB', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Clock className="w-5 h-5 mr-2" />
            Order Timeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-600 mx-auto mb-2"></div>
            <p className="text-sm text-gray-600">Loading order status...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !order) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Clock className="w-5 h-5 mr-2" />
            Order Timeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">
            <XCircle className="w-8 h-8 text-red-500 mx-auto mb-2" />
            <p className="text-sm text-red-600">{error || 'Order not found'}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const currentStatusIndex = getCurrentStatusIndex();
  const currentStatus = ORDER_STATUSES[currentStatusIndex];

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center">
            <Clock className="w-5 h-5 mr-2" />
            Order Timeline
          </div>
          <Badge variant="outline" className="text-sm">
            Live Updates
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Current Status */}
          <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
            <div className={`w-3 h-3 ${currentStatus?.dotColor || 'bg-gray-500'} rounded-full animate-pulse`}></div>
            <div className="flex-1">
              <p className={`font-medium ${currentStatus?.color || 'text-gray-600'}`}>
                {currentStatus?.label || 'Unknown Status'}
              </p>
              <p className="text-sm text-gray-500">
                {currentStatus?.description || 'Status update pending'}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500">
                {formatTime(order.updated_at)}
              </p>
            </div>
          </div>

          {/* Timeline Steps */}
          <div className="space-y-3">
            {ORDER_STATUSES.map((status, index) => {
              const isCompleted = index <= currentStatusIndex;
              const isCurrent = index === currentStatusIndex;
              const StatusIcon = status.icon;

              return (
                <div key={status.key} className="flex items-center space-x-3">
                  <div className="flex flex-col items-center">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      isCompleted 
                        ? status.dotColor 
                        : 'bg-gray-200'
                    }`}>
                      <StatusIcon className={`w-4 h-4 ${
                        isCompleted ? 'text-white' : 'text-gray-400'
                      }`} />
                    </div>
                    {index < ORDER_STATUSES.length - 1 && (
                      <div className={`w-0.5 h-8 ${
                        isCompleted ? 'bg-gray-300' : 'bg-gray-200'
                      }`}></div>
                    )}
                  </div>
                  <div className="flex-1">
                    <p className={`font-medium ${
                      isCurrent 
                        ? status.color.replace('bg-', 'text-').replace('-100', '-600')
                        : isCompleted 
                          ? 'text-gray-600' 
                          : 'text-gray-400'
                    }`}>
                      {status.label}
                    </p>
                    <p className="text-sm text-gray-500">
                      {status.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Live Update Indicator */}
          <div className="mt-6 p-4 bg-blue-50 rounded-lg">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
              <p className="text-sm text-blue-700">
                This timeline updates automatically as your order progresses
              </p>
            </div>
            <p className="text-xs text-blue-600 mt-1">
              Last updated: {formatTime(lastUpdate.toISOString())}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
