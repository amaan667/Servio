"use client";

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Clock } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";


type OrdersClientProps = {
  venueId: string;
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

const OrdersClient: React.FC<OrdersClientProps> = ({ venueId }) => {
  const [stats, setStats] = useState({
    todayOrders: 0,
    revenue: 0
  });
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<Order[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Use simple date-based window instead of timezone-aware
        const now = new Date();
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);
        const window = {
          startUtcISO: startOfDay.toISOString(),
          endUtcISO: endOfDay.toISOString(),
        };
        
        // Fetch today's orders
        const { data: ordersData } = await supabase
          .from('orders')
          .select('*')
          .eq('venue_id', venueId)
          .gte('created_at', window.startUtcISO)
          .lt('created_at', window.endUtcISO)
          .order('created_at', { ascending: false });

        if (ordersData) {
          setOrders(ordersData as Order[]);
          
          // Calculate stats
          setStats({
            todayOrders: ordersData.length,
            revenue: ordersData.reduce((sum, order) => sum + (order.total_amount || 0), 0)
          });
        }

        setLoading(false);
      } catch (error) {
        console.error("Error fetching orders data:", error);
        setLoading(false);
      }
    };

    fetchData();
  }, [venueId]);

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div>
      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Today's Orders</p>
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
                <p className="text-sm font-medium text-gray-600">Today's Revenue</p>
                <p className="text-2xl font-bold text-gray-900">£{stats.revenue.toFixed(2)}</p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <Clock className="h-6 w-6 text-green-600" />
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
            <p>No orders for today</p>
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
                      <p className="font-bold">£{order.total_amount.toFixed(2)}</p>
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
  );
};

export default OrdersClient;
