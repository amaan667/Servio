"use client";

import React, { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, ArrowLeft, User } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { liveOrdersWindow } from "@/lib/dates";
import { todayWindowForTZ } from "@/lib/time";
import { useTabCounts } from "@/hooks/use-tab-counts";

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
  customer_phone?: string | null;
  customer_email?: string | null;
  items: Array<{
    menu_item_id: string;
    item_name: string;
    quantity: number;
    price: number;
    specialInstructions?: string;
  }>;
  total_amount: number;
  created_at: string;
  order_status: 'PLACED' | 'ACCEPTED' | 'IN_PREP' | 'READY' | 'OUT_FOR_DELIVERY' | 'SERVING' | 'COMPLETED' | 'CANCELLED' | 'REFUNDED' | 'EXPIRED';
  payment_status?: string;
  notes?: string;
  scheduled_for?: string;
  prep_lead_minutes?: number;
  source?: 'qr' | 'counter'; // Order source - qr for table orders, counter for counter orders
}

interface GroupedHistoryOrders {
  [date: string]: Order[];
}

const OrdersClient: React.FC<OrdersClientProps> = ({ venueId, initialOrders = [], initialStats }) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [allTodayOrders, setAllTodayOrders] = useState<Order[]>([]);
  const [historyOrders, setHistoryOrders] = useState<Order[]>([]);
  const [groupedHistoryOrders, setGroupedHistoryOrders] = useState<GroupedHistoryOrders>({});
  const [loading, setLoading] = useState(!initialOrders.length);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [todayWindow, setTodayWindow] = useState<{ startUtcISO: string; endUtcISO: string } | null>(null);
  const [activeTab, setActiveTab] = useState("live");
  
  // Constants for order statuses
  const LIVE_STATUSES = ['PLACED', 'ACCEPTED', 'IN_PREP', 'READY', 'OUT_FOR_DELIVERY', 'SERVING'];
  const TERMINAL_STATUSES = ['COMPLETED', 'CANCELLED', 'REFUNDED', 'EXPIRED'];
  const LIVE_WINDOW_STATUSES = ['PLACED', 'ACCEPTED', 'IN_PREP', 'READY', 'OUT_FOR_DELIVERY', 'SERVING', 'COMPLETED'];
  
  // Define what constitutes a "live" order - orders placed within the last 30 minutes
  const LIVE_ORDER_WINDOW_MS = 30 * 60 * 1000; // 30 minutes
  
  // Get tab counts using the hook
  const { data: tabCounts } = useTabCounts(venueId, 'Europe/London', 30);

  // Auto-refresh functionality
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(15000); // 15 seconds

  const loadVenueAndOrders = useCallback(async () => {
    if (!venueId) return;
    
    setLoading(true);
    
    try {
      const supabase = createClient();
      const venueTz = 'Europe/London';
      
      // Get today's time window
      const todayWindowData = todayWindowForTZ(venueTz);
      const todayWindow = {
        startUtcISO: todayWindowData.startUtcISO || new Date().toISOString(),
        endUtcISO: todayWindowData.endUtcISO || new Date().toISOString()
      };
      setTodayWindow(todayWindow);
      
      // Calculate 30 minutes ago for live orders
      const thirtyMinutesAgo = new Date(Date.now() - LIVE_ORDER_WINDOW_MS).toISOString();
      
      // Use initial orders if available, otherwise fetch from database
      let allOrdersData = initialOrders;
      
      if (!allOrdersData || allOrdersData.length === 0) {
        const { data: fetchedData, error: fetchError } = await supabase
          .from('orders')
          .select('*')
          .eq('venue_id', venueId)
          .order('created_at', { ascending: false });
          
        if (fetchError) {
          console.error('Error fetching orders:', fetchError);
          setLoading(false);
          return;
        }
        
        allOrdersData = (fetchedData || []) as Order[];
      }
      
      // Categorize orders
      console.log('[ORDERS DEBUG] Processing orders:', {
        totalOrders: allOrdersData.length,
        thirtyMinutesAgo,
        todayWindow,
        sampleOrders: allOrdersData.slice(0, 3).map(o => ({
          id: o.id,
          created_at: o.created_at,
          order_status: o.order_status,
          customer_name: o.customer_name
        }))
      });
      
      const liveOrders = allOrdersData.filter((order: Order) => 
        new Date(order.created_at) >= new Date(thirtyMinutesAgo)
      );
      
      const todayOrders = allOrdersData.filter((order: Order) => {
        const orderDate = new Date(order.created_at);
        const todayStart = new Date(todayWindow.startUtcISO);
        const todayEnd = new Date(todayWindow.endUtcISO);
        return orderDate >= todayStart && orderDate < todayEnd;
      });
      
      const historyOrders = allOrdersData.filter((order: Order) => 
        new Date(order.created_at) < new Date(todayWindow.startUtcISO)
      );
      
      console.log('[ORDERS DEBUG] Categorized orders:', {
        liveOrders: liveOrders.length,
        todayOrders: todayOrders.length,
        historyOrders: historyOrders.length
      });
      
      // Set live orders
      setOrders(liveOrders);
      
      // Set today's orders (excluding live orders)
      const liveOrderIds = new Set(liveOrders.map(order => order.id));
      const todayFiltered = todayOrders.filter(order => !liveOrderIds.has(order.id));
      setAllTodayOrders(todayFiltered);
      
      // Set history orders
      setHistoryOrders(historyOrders);
      
      // Group history orders by date
      const grouped = historyOrders.reduce((acc: GroupedHistoryOrders, order) => {
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
      
      setLoading(false);
    } catch (error) {
      console.error('Error loading orders:', error);
      setLoading(false);
    }
  }, [venueId, initialOrders]);

  // Process initial orders on mount
  useEffect(() => {
    if (initialOrders.length > 0) {
      loadVenueAndOrders();
    }
  }, [loadVenueAndOrders]);

  // Load orders when component mounts or when initial orders change
  useEffect(() => {
    loadVenueAndOrders();
  }, [loadVenueAndOrders]);

  // Auto-refresh every 15 seconds
  useEffect(() => {
    if (!autoRefreshEnabled) return;
    
    const interval = setInterval(() => {
      loadVenueAndOrders();
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [autoRefreshEnabled, refreshInterval, loadVenueAndOrders]);

  // Set up real-time subscription
  useEffect(() => {
    if (!venueId) return;

    const supabase = createClient();
    const channel = supabase
      .channel('orders-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `venue_id=eq.${venueId}`,
        },
        (payload: any) => {
          console.log('Orders real-time update:', payload);
          loadVenueAndOrders();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [venueId, loadVenueAndOrders]);

  if (loading) {
    return <div className="text-center py-8 text-gray-600">Loading orders...</div>;
  }

  const renderOrderCard = (order: Order) => {
    const calculateTotal = () => {
      let amount = order.total_amount;
      if (!amount || amount <= 0) {
        amount = order.items.reduce((sum, item) => {
          const quantity = Number(item.quantity) || 0;
          const price = Number(item.price) || 0;
          return sum + (quantity * price);
        }, 0);
      }
      return amount.toFixed(2);
    };

    const getStatusColor = (status: string) => {
      switch (status) {
        case 'PLACED': return 'bg-blue-100 text-blue-800';
        case 'ACCEPTED': return 'bg-yellow-100 text-yellow-800';
        case 'IN_PREP': return 'bg-orange-100 text-orange-800';
        case 'READY': return 'bg-green-100 text-green-800';
        case 'OUT_FOR_DELIVERY': return 'bg-purple-100 text-purple-800';
        case 'SERVING': return 'bg-indigo-100 text-indigo-800';
        case 'COMPLETED': return 'bg-gray-100 text-gray-800';
        case 'CANCELLED': return 'bg-red-100 text-red-800';
        default: return 'bg-gray-100 text-gray-800';
      }
    };

    return (
      <div key={order.id} className="p-4 border rounded-lg hover:bg-gray-50 transition-colors">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <p className="font-medium">{order.source === 'counter' ? 'Counter' : 'Table'} {order.table_number || 'Takeaway'}</p>
              <Badge className={`text-xs ${getStatusColor(order.order_status)}`}>
                {order.order_status.replace('_', ' ')}
              </Badge>
            </div>
            <p className="text-sm text-gray-600 mb-1">{order.customer_name || 'Anonymous'}</p>
            <p className="text-xs text-gray-500">
              {new Date(order.created_at).toLocaleString('en-GB', {
                day: '2-digit',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </p>
          </div>
          <div className="text-right">
            <p className="font-bold text-lg">£{calculateTotal()}</p>
            <p className="text-xs text-gray-500">
              {order.payment_status === 'PAID' ? 'Paid' : 'Unpaid'}
            </p>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-4 sm:py-6 lg:py-8">
        
        {/* Tab Navigation */}
        <section className="mb-6 sm:mb-8">
          <div className="flex flex-wrap gap-2 sm:gap-3 justify-center sm:justify-start">
            {[
              { key:'live',  label:'Live Orders',    hint:'Last 30 min', count: tabCounts?.live_count || 0 },
              { key:'all', label:"Today's Orders",  hint:"Today's orders", count: tabCounts?.earlier_today_count || 0 },
              { key:'history',  label:'History',        hint:'Previous days', count: tabCounts?.history_count || 0 },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`
                  group relative grid w-[11rem] grid-rows-[1fr_auto] rounded-xl px-4 py-2 text-left transition
                  ${activeTab === tab.key ? 'bg-violet-600 text-white' : 'text-slate-700 hover:bg-slate-50'}
                `}
              >
                <span className="flex items-center justify-between">
                  <span className="font-medium">{tab.label}</span>
                  <span className={`
                    ml-2 inline-flex min-w-[1.5rem] items-center justify-center rounded-full px-2 text-xs
                    ${activeTab === tab.key ? 'bg-violet-500/70 text-white' : 'bg-slate-200 text-slate-700'}
                  `}>
                    {tab.count}
                  </span>
                </span>
                <span className={`
                  mt-0.5 text-xs
                  ${activeTab === tab.key ? 'text-violet-100' : 'text-slate-400'}
                `}>
                  {tab.hint}
                </span>
              </button>
            ))}
          </div>

          {/* Slim alert (only for Live tab) - centered below tabs */}
          {activeTab === 'live' && (
            <div className="flex justify-center">
              <div className="hidden md:flex items-center gap-2 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-rose-100">
                <span className="h-2 w-2 rounded-full bg-rose-500" />
                <span>Live Orders – last 30 minutes (including completed orders)</span>
              </div>
            </div>
          )}
        </section>

        {/* Orders Content */}
        <div className="space-y-4">
          {activeTab === 'live' && (
            <div>
              {orders.length === 0 ? (
                <Card>
                  <CardContent className="p-8 text-center">
                    <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No Live Orders</h3>
                    <p className="text-gray-500">No orders placed in the last 30 minutes</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {orders.map(renderOrderCard)}
                </div>
              )}
            </div>
          )}

          {activeTab === 'all' && (
            <div>
              {allTodayOrders.length === 0 ? (
                <Card>
                  <CardContent className="p-8 text-center">
                    <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No Earlier Orders Today</h3>
                    <p className="text-gray-500">No orders from earlier today (older than 30 minutes)</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {allTodayOrders.map(renderOrderCard)}
                </div>
              )}
            </div>
          )}

          {activeTab === 'history' && (
            <div>
              {historyOrders.length === 0 ? (
                <Card>
                  <CardContent className="p-8 text-center">
                    <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No Historical Orders</h3>
                    <p className="text-gray-500">No orders from previous days</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-6">
                  {Object.entries(groupedHistoryOrders)
                    .sort(([a], [b]) => new Date(b).getTime() - new Date(a).getTime())
                    .map(([date, dateOrders]) => (
                      <div key={date}>
                        <h3 className="text-lg font-semibold text-gray-900 mb-3 sticky top-0 bg-background py-2">
                          {date}
                        </h3>
                        <div className="space-y-3">
                          {dateOrders.map(renderOrderCard)}
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default OrdersClient;
