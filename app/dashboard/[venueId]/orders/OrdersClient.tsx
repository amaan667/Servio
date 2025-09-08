"use client";

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Clock } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { liveOrdersWindow } from "@/lib/dates";

type OrdersClientProps = {
  venueId: string;
  initialOrders?: Order[];
  initialStats?: {
    todayOrders: number;
    revenue: number;
  };
};

interface Order {
  id: string;
  venue_id: string;
  table_number: number | null;
  customer_name: string | null;
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

const OrdersClient: React.FC<OrdersClientProps> = ({ venueId, initialOrders = [], initialStats }) => {
  const [stats, setStats] = useState(initialStats || {
    todayOrders: 0,
    revenue: 0
  });
  const [loading, setLoading] = useState(!initialOrders.length);
  const [orders, setOrders] = useState<Order[]>(initialOrders);

  useEffect(() => {
    // Only fetch data if we don't have initial data
    if (initialOrders.length > 0) {
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        // Get time window for live orders (last 30 minutes)
        const timeWindow = liveOrdersWindow();
        
        // Fetch live orders from last 30 minutes - only paid orders
        const { data: ordersData } = await supabase
          .from('orders')
          .select('*')
          .eq('venue_id', venueId)
          .eq('payment_status', 'PAID') // Only show paid orders
          .gte('created_at', timeWindow.startUtcISO)
          .order('created_at', { ascending: false });

        if (ordersData) {
          setOrders(ordersData as Order[]);
          
          // Calculate stats with fallback to items calculation
          setStats({
            todayOrders: ordersData.length,
            revenue: ordersData.reduce((sum, order) => {
              let amount = order.total_amount;
              if (!amount || amount <= 0) {
                // Calculate from items if total_amount is 0 or missing
                amount = order.items.reduce((itemSum, item) => {
                  const quantity = Number(item.quantity) || 0;
                  const price = Number(item.price) || 0;
                  return itemSum + (quantity * price);
                }, 0);
              }
              return sum + amount;
            }, 0)
          });
        }

        setLoading(false);
      } catch (error) {
        console.error("Error fetching orders data:", error);
        setLoading(false);
      }
    };

    fetchData();
  }, [venueId, initialOrders.length]);

  if (loading) {
    return <div className="text-center py-8 text-gray-600">Loading orders...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Orders</h2>
          <p className="text-gray-600">Monitor and manage orders</p>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Live Orders (30 min)</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.todayOrders}</p>
                </div>
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Clock className="h-6 w-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Live Revenue (30 min)</p>
                  <p className="text-2xl font-bold text-gray-900">£{stats.revenue.toFixed(2)}</p>
                </div>
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Clock className="h-6 w-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Orders List */}
        <Card>
          <CardHeader>
            <h3 className="text-lg font-semibold">Recent Orders</h3>
          </CardHeader>
          <CardContent>
            {orders.length === 0 ? (
              <p>No live orders in the last 30 minutes</p>
            ) : (
              <div className="space-y-4">
                {orders.map(order => (
                  <div key={order.id} className="p-4 border rounded-lg">
                    <div className="flex justify-between">
                      <div>
                        <p className="font-medium">Table {order.table_number || 'Takeaway'}</p>
                        <p className="text-sm text-gray-500">{new Date(order.created_at).toLocaleTimeString()}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold">£{(() => {
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
                        })()}</p>
                        <p className="text-sm">{order.status}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default OrdersClient;
