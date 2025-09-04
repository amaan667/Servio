"use client";

/**
 * LiveOrdersClient - Order Management Component
 * 
 * Tab Logic:
 * - Live Orders: Orders placed within the last 30 minutes with active statuses
 * - Earlier Today: Orders from today that are not in live orders (orders from earlier today)
 * - History: Orders from previous days
 * 
 * Orders automatically move from "Live Orders" to "Earlier Today" after 30 minutes
 * 
 * FIXED: Now uses authoritative dashboard_counts function to ensure proper date filtering
 * and prevent orders from yesterday appearing in "Earlier Today" tab
 */

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { createClient } from "@/lib/supabase/client";
import { Clock, ArrowLeft, User } from "lucide-react";
import { todayWindowForTZ } from "@/lib/time";
import { useTabCounts } from "@/hooks/use-tab-counts";


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
}

interface LiveOrdersClientProps {
  venueId: string;
  venueName?: string;
}

interface GroupedHistoryOrders {
  [date: string]: Order[];
}



export default function LiveOrdersClient({ venueId, venueName: venueNameProp }: LiveOrdersClientProps) {
  console.log('[LIVE ORDERS DEBUG] LiveOrdersClient mounted with venueId:', venueId);
  console.log('[LIVE ORDERS DEBUG] Props received:', { venueId, venueNameProp });
  
  const [orders, setOrders] = useState<Order[]>([]);
  const [allTodayOrders, setAllTodayOrders] = useState<Order[]>([]);
  const [historyOrders, setHistoryOrders] = useState<Order[]>([]);
  const [groupedHistoryOrders, setGroupedHistoryOrders] = useState<GroupedHistoryOrders>({});
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [todayWindow, setTodayWindow] = useState<{ startUtcISO: string; endUtcISO: string } | null>(null);
  const [activeTab, setActiveTab] = useState("live");
  // State to hold the venue name for display in the UI
  const [venueName, setVenueName] = useState<string>(venueNameProp || '');
  
  // Constants for order statuses
  const LIVE_STATUSES = ['PLACED', 'ACCEPTED', 'IN_PREP', 'READY', 'OUT_FOR_DELIVERY', 'SERVING'];
  const TERMINAL_STATUSES = ['COMPLETED', 'CANCELLED', 'REFUNDED', 'EXPIRED'];
  const prepLeadMs = 30 * 60 * 1000; // 30 minutes default
  
  // Define what constitutes a "live" order - orders placed within the last 30 minutes
  const LIVE_ORDER_WINDOW_MS = 30 * 60 * 1000; // 30 minutes

  // Auto-refresh functionality
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(15000); // 15 seconds
  const autoRefreshRef = useRef<NodeJS.Timeout | null>(null);

  // Use the authoritative tab counts hook
  const { data: tabCounts, refetch: refetchCounts } = useTabCounts(venueId, 'Europe/London', 30);

  // Refresh counts when component mounts or venue changes
  useEffect(() => {
    if (venueId) {
      refetchCounts();
    }
  }, [venueId, refetchCounts]);

  // Debug log when tab counts change
  useEffect(() => {
    if (tabCounts) {
      console.log('[LIVE ORDERS DEBUG] Tab counts updated:', tabCounts);
    }
  }, [tabCounts]);

  // Auto-refresh effect
  useEffect(() => {
    if (!autoRefreshEnabled) {
      if (autoRefreshRef.current) {
        clearInterval(autoRefreshRef.current);
        autoRefreshRef.current = null;
      }
      return;
    }

    autoRefreshRef.current = setInterval(() => {
      console.log('[LIVE ORDERS DEBUG] Auto-refreshing orders');
      loadVenueAndOrders();
      // Also refresh the authoritative counts
      refetchCounts();
    }, refreshInterval);

    return () => {
      if (autoRefreshRef.current) {
        clearInterval(autoRefreshRef.current);
        autoRefreshRef.current = null;
      }
    };
  }, [autoRefreshEnabled, refreshInterval]);

  const toggleAutoRefresh = () => {
    setAutoRefreshEnabled(!autoRefreshEnabled);
  };

  const changeRefreshInterval = (interval: number) => {
    setRefreshInterval(interval * 1000);
  };

  useEffect(() => {
    const loadVenueAndOrders = async () => {
      console.log('[LIVE_ORDERS_CLIENT] ===== LOADING VENUE AND ORDERS =====');
      console.log('[LIVE_ORDERS_CLIENT] Venue ID:', venueId);
      console.log('[LIVE_ORDERS_CLIENT] Active Tab:', activeTab);
      console.log('[LIVE_ORDERS_CLIENT] Current Orders Count:', orders.length);
      let venueTimezone;
      if (!venueNameProp) {
        const { data: venueData } = await createClient()
          .from('venues')
          .select('name')
          .eq('venue_id', venueId)
          .single();
        setVenueName(venueData?.name || '');
        venueTimezone = 'Europe/London'; // Default timezone
      }
      const window = todayWindowForTZ(venueTimezone);
      if (window.startUtcISO && window.endUtcISO) {
        setTodayWindow({
          startUtcISO: window.startUtcISO,
          endUtcISO: window.endUtcISO
        });
      }
      console.log('[LIVE ORDERS DEBUG] Today window set:', window);
      console.log('[LIVE ORDERS DEBUG] Window start:', window.startUtcISO);
      console.log('[LIVE ORDERS DEBUG] Window end:', window.endUtcISO);
      
      // Load live orders - orders placed within the last 30 minutes with ACTIVE statuses only (never completed orders)
      console.log('[LIVE ORDERS DEBUG] Fetching live orders for venueId:', venueId);
      console.log('[LIVE ORDERS DEBUG] LIVE_STATUSES:', LIVE_STATUSES);
      console.log('[LIVE ORDERS DEBUG] Current time:', new Date().toISOString());
      
      const liveOrdersCutoff = new Date(Date.now() - LIVE_ORDER_WINDOW_MS).toISOString();
      console.log('[LIVE ORDERS DEBUG] Live orders cutoff time:', liveOrdersCutoff);
      
      const { data: liveData, error: liveError } = await createClient()
        .from('orders')
        .select('*')
        .eq('venue_id', venueId)
        .in('order_status', LIVE_STATUSES)
        .gte('created_at', liveOrdersCutoff)
        .order('created_at', { ascending: false });

      // Load all orders from today (venue timezone aware)
      console.log('[LIVE ORDERS DEBUG] Fetching all today orders with window:', window);
      const { data: allData, error: allError } = await createClient()
        .from('orders')
        .select('*')
        .eq('venue_id', venueId)
        .gte('created_at', window.startUtcISO)
        .lt('created_at', window.endUtcISO)
        .order('created_at', { ascending: false });

      // Load history orders (all orders before today, not just terminal statuses)
      const { data: historyData, error: historyError } = await createClient()
        .from('orders')
        .select('*')
        .eq('venue_id', venueId)
        .lt('created_at', window.startUtcISO)
        .order('created_at', { ascending: false })
        .limit(100); // Limit to last 100 orders

      // Debug all responses
      console.log('[LIVE ORDERS DEBUG] === FETCH RESULTS ===');
      console.log('Live orders response:', { data: liveData, error: liveError, count: liveData?.length || 0 });
      console.log('All today orders response:', { data: allData, error: allError, count: allData?.length || 0 });
      console.log('History orders response:', { data: historyData, error: historyError, count: historyData?.length || 0 });
      
      // Also check if there are any orders at all for this venue
      const { data: allVenueOrders, error: allVenueError } = await createClient()
        .from('orders')
        .select('id, venue_id, order_status, created_at')
        .eq('venue_id', venueId)
        .limit(5);
      
      console.log('[LIVE ORDERS DEBUG] All venue orders check:', { 
        data: allVenueOrders, 
        error: allVenueError, 
        count: allVenueOrders?.length || 0,
        venueId: venueId
      });
      
      if (liveError) {
        console.error('[LIVE ORDERS DEBUG] Live orders error:', liveError);
      }
      if (allError) {
        console.error('[LIVE ORDERS DEBUG] All today orders error:', allError);
      }
      if (historyError) {
        console.error('[LIVE ORDERS DEBUG] History orders error:', historyError);
      }

      if (!liveError && liveData) {
        console.log('[LIVE ORDERS DEBUG] Live orders fetched successfully:', {
          count: liveData.length,
          orders: liveData.map((order: any) => ({
            id: order.id,
            total_amount: order.total_amount,
            items_count: order.items?.length || 0,
            items: order.items?.map((item: any) => ({
              item_name: item.item_name,
              quantity: item.quantity,
              price: item.price
            }))
          }))
        });
        setOrders(liveData as Order[]);
      }
      if (!allError && allData) {
        console.log('[LIVE ORDERS DEBUG] All today orders fetched:', {
          count: allData.length,
          orders: allData.map((order: any) => ({
            id: order.id,
            created_at: order.created_at,
            status: order.order_status,
            total_amount: order.total_amount
          }))
        });
        
        // Filter out live orders from all today orders
        // All Today should show orders from today that are NOT in live orders
        // Also exclude completed orders from the last 30 minutes (they stay in live)
        const liveOrderIds = new Set((liveData || []).map((order: any) => order.id));
        const thirtyMinutesAgo = new Date(Date.now() - LIVE_ORDER_WINDOW_MS);
        
        const allTodayFiltered = allData.filter((order: any) => {
          // Don't show orders that are already in live orders
          if (liveOrderIds.has(order.id)) {
            return false;
          }
          
          // Don't show completed orders from the last 30 minutes (they stay in live)
          if (order.order_status === 'COMPLETED') {
            const orderCreatedAt = new Date(order.created_at);
            if (orderCreatedAt >= thirtyMinutesAgo) {
              return false;
            }
          }
          
          return true;
        });
        
        console.log('[LIVE ORDERS DEBUG] Filtered all today orders (excluding live orders):', {
          originalCount: allData.length,
          filteredCount: allTodayFiltered.length,
          liveOrderIds: Array.from(liveOrderIds)
        });
        
        setAllTodayOrders(allTodayFiltered as Order[]);
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
      
      // Debug state after setting
      console.log('[LIVE ORDERS DEBUG] === STATE AFTER SETTING ===');
      console.log('Orders state set to:', liveData?.length || 0, 'orders');
      console.log('AllTodayOrders state set to:', allData?.length || 0, 'orders');
      console.log('HistoryOrders state set to:', historyData?.length || 0, 'orders');
      
      console.log('[LIVE_ORDERS_CLIENT] ===== END LOADING VENUE AND ORDERS =====');
      console.log('[LIVE_ORDERS_CLIENT] Final State:', {
        liveOrders: liveData?.length || 0,
        allTodayOrders: allData?.length || 0,
        historyOrders: historyData?.length || 0,
        activeTab: activeTab,
        venueId: venueId
      });
    };

    loadVenueAndOrders();

    // Set up real-time subscription
    const channel = createClient()
      .channel('orders')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'orders',
          filter: `venue_id=eq.${venueId}`
        }, 
        (payload: any) => {
          console.log('[LIVE ORDERS DEBUG] Real-time change detected:', {
            eventType: payload.eventType,
            orderId: payload.new?.id || payload.old?.id,
            payload: payload
          });
          
          const newOrder = payload.new as Order;
          const oldOrder = payload.old as Order;
          
          if (payload.eventType === 'INSERT') {
            console.log('[LIVE ORDERS DEBUG] New order inserted:', {
              orderId: newOrder.id,
              orderStatus: newOrder.order_status,
              orderData: newOrder
            });
            
            // Check if order should appear in live orders
            const isLiveOrder = LIVE_STATUSES.includes(newOrder.order_status);
            const orderCreatedAt = new Date(newOrder.created_at);
            const isRecentOrder = orderCreatedAt > new Date(Date.now() - LIVE_ORDER_WINDOW_MS);
            const isCompletedRecent = newOrder.order_status === 'COMPLETED' && isRecentOrder;
            
            if ((isLiveOrder && isRecentOrder) || isCompletedRecent) {
              console.log('[LIVE ORDERS DEBUG] Adding to live orders - recent order with live status or recent completed');
              setOrders(prev => [newOrder, ...prev]);
            }
            
            // Check if order should appear in all today orders
            const isInTodayWindow = orderCreatedAt && todayWindow && 
              orderCreatedAt >= new Date(todayWindow.startUtcISO) && 
              orderCreatedAt < new Date(todayWindow.endUtcISO);
            
                      if (isInTodayWindow) {
            // Only add to all today if it's NOT already in live orders
            if (!((isLiveOrder && isRecentOrder) || isCompletedRecent)) {
              console.log('[LIVE ORDERS DEBUG] Adding to all today orders - not a live order');
              setAllTodayOrders(prev => [newOrder, ...prev]);
            }
          } else {
            console.log('[LIVE ORDERS DEBUG] Adding to history orders - not from today');
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
          
          // Refresh the authoritative counts
          refetchCounts();
          } else if (payload.eventType === 'UPDATE') {
            console.log('[LIVE ORDERS DEBUG] Order updated:', {
              orderId: newOrder.id,
              oldStatus: oldOrder?.order_status,
              newStatus: newOrder.order_status
            });
            
            // Check if order should be in live orders
            const isLiveOrder = LIVE_STATUSES.includes(newOrder.order_status);
            const orderCreatedAt = new Date(newOrder.created_at);
            const isRecentOrder = orderCreatedAt > new Date(Date.now() - LIVE_ORDER_WINDOW_MS);
            
            // CRITICAL: Completed orders should NEVER be in live orders
            if (isLiveOrder && isRecentOrder) {
              // Add to live orders if not already there
              setOrders(prev => {
                const exists = prev.find(order => order.id === newOrder.id);
                if (!exists) {
                  return [newOrder, ...prev];
                }
                return prev.map(order => order.id === newOrder.id ? newOrder : order);
              });
              
              // Remove from all today orders if it was there
              setAllTodayOrders(prev => prev.filter(order => order.id !== newOrder.id));
            } else {
              // Remove from live orders if status changed to terminal or not recent
              setOrders(prev => prev.filter(order => order.id !== newOrder.id));
              
              // Add to all today orders if it's from today and not recent
              if (todayWindow && orderCreatedAt >= new Date(todayWindow.startUtcISO) && orderCreatedAt < new Date(todayWindow.endUtcISO)) {
                setAllTodayOrders(prev => {
                  const exists = prev.find(order => order.id === newOrder.id);
                  if (!exists) {
                    return [newOrder, ...prev];
                  }
                  return prev.map(order => order.id === newOrder.id ? newOrder : order);
                });
              }
            }
            
            // Update in history orders
            setHistoryOrders(prev => prev.map(order => 
              order.id === newOrder.id ? newOrder : order
            ));
            
            // Refresh the authoritative counts
            refetchCounts();
          } else if (payload.eventType === 'DELETE') {
            const deletedOrder = payload.old as Order;
            console.log('[LIVE ORDERS DEBUG] Order deleted:', {
              orderId: deletedOrder.id
            });
            
            // Remove from all lists
            setOrders(prev => prev.filter(order => order.id !== deletedOrder.id));
            setAllTodayOrders(prev => prev.filter(order => order.id !== deletedOrder.id));
            setHistoryOrders(prev => prev.filter(order => order.id !== deletedOrder.id));
            
            // Refresh the authoritative counts
            refetchCounts();
          }
        }
      )
      .subscribe();

    return () => {
      createClient().removeChannel(channel);
    };
  }, [venueId]);

  // Periodically check if orders need to be moved from live to all today
  useEffect(() => {
    if (!todayWindow) return;

    const interval = setInterval(() => {
      const now = new Date();
      const cutoff = new Date(now.getTime() - LIVE_ORDER_WINDOW_MS);
      
      setOrders(prevOrders => {
        const stillLive = prevOrders.filter(order => {
          const orderCreatedAt = new Date(order.created_at);
          // Keep order in live if it's both recent AND active
          return orderCreatedAt > cutoff && LIVE_STATUSES.includes(order.order_status);
        });
        
        const movedToAllToday = prevOrders.filter(order => {
          const orderCreatedAt = new Date(order.created_at);
          // Move order if it's either old OR completed
          return orderCreatedAt <= cutoff || !LIVE_STATUSES.includes(order.order_status);
        });
        
        // Move aged-out or completed orders to all today
        if (movedToAllToday.length > 0) {
          console.log('[LIVE ORDERS DEBUG] Moving orders from live to all today:', movedToAllToday.length);
          setAllTodayOrders(prev => [...movedToAllToday, ...prev]);
          
          // Refresh the authoritative counts after moving orders
          refetchCounts();
        }
        
        return stillLive;
      });
    }, 60000); // Check every minute

    return () => clearInterval(interval);
  }, [todayWindow, LIVE_ORDER_WINDOW_MS]);

  const updateOrderStatus = async (orderId: string, orderStatus: 'PLACED' | 'ACCEPTED' | 'IN_PREP' | 'READY' | 'OUT_FOR_DELIVERY' | 'SERVING' | 'COMPLETED' | 'CANCELLED' | 'REFUNDED' | 'EXPIRED') => {
    const { error } = await createClient()
      .from('orders')
      .update({ 
        order_status: orderStatus,
        updated_at: new Date().toISOString()
      })
      .eq('id', orderId)
      .eq('venue_id', venueId);

    if (!error) {
      setOrders(prev => prev.map(order => 
        order.id === orderId ? { ...order, order_status: orderStatus } : order
      ));
      setAllTodayOrders(prev => prev.map(order => 
        order.id === orderId ? { ...order, order_status: orderStatus } : order
      ));
      
      // Refresh the authoritative counts after status update
      refetchCounts();
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
      case 'PLACED': return 'bg-yellow-100 text-yellow-800';
      case 'IN_PREP': return 'bg-blue-100 text-blue-800';
      case 'READY': return 'bg-green-100 text-green-800';
      case 'COMPLETED': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPaymentStatusColor = (paymentStatus: string) => {
    switch (paymentStatus) {
      case 'PAID': return 'bg-green-100 text-green-800';
      case 'UNPAID': return 'bg-yellow-100 text-yellow-800';
      case 'IN_PROGRESS': return 'bg-blue-100 text-blue-800';
      case 'REFUNDED': return 'bg-red-100 text-red-800';
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
            <Badge className={getStatusColor(order.order_status)}>
              {order.order_status.replace('_', ' ').toLowerCase()}
            </Badge>
            {order.payment_status && (
              <Badge className={getPaymentStatusColor(order.payment_status)}>
                {order.payment_status.toUpperCase()}
              </Badge>
            )}
            <div className="text-lg font-bold">
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
            </div>
          </div>
        </div>

        {/* Order Items */}
        <div className="space-y-2 mb-4">
          {order.items.map((item, index) => {
            console.log('[LIVE ORDERS DEBUG] Rendering item:', item);
            return (
              <div key={index} className="flex justify-between text-sm">
                <span>{item.quantity}x {item.item_name}</span>
                <span>£{(item.quantity * item.price).toFixed(2)}</span>
              </div>
            );
          })}
        </div>

        {/* Action Buttons */}
        {showActions && (
          <div className="flex space-x-2">
            {order.order_status === 'PLACED' && (
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
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Status Summary */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-sm text-muted-foreground">Real-time monitoring active</span>
            </div>
            <span className="text-sm text-muted-foreground">•</span>
            <span className="text-sm text-muted-foreground">
              {new Date().toLocaleDateString('en-GB', { 
                day: 'numeric', 
                month: 'long' 
              })} (today)
            </span>
            <span className="text-sm text-muted-foreground">•</span>
            <span className="text-sm text-muted-foreground">
              Current time: {new Date().toLocaleTimeString('en-GB', { 
                hour: '2-digit', 
                minute: '2-digit' 
              })}
            </span>
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <span className="text-sm text-muted-foreground">Auto-refresh:</span>
              <select
                value={refreshInterval / 1000}
                onChange={(e) => changeRefreshInterval(Number(e.target.value))}
                className="text-sm border rounded px-2 py-1"
                disabled={!autoRefreshEnabled}
              >
                <option value={5}>5s</option>
                <option value={10}>10s</option>
                <option value={15}>15s</option>
                <option value={30}>30s</option>
              </select>
              <Button
                variant={autoRefreshEnabled ? "default" : "outline"}
                size="sm"
                onClick={toggleAutoRefresh}
                className="text-xs"
              >
                {autoRefreshEnabled ? 'ON' : 'OFF'}
              </Button>
            </div>
            <div className="text-xs text-muted-foreground">
              Live orders: last 30 min
            </div>
          </div>
        </div>

        {/* Tab Description */}
        <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-start space-x-3">
            <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
            <div className="text-sm text-blue-800">
              <p className="font-medium mb-1">Order Categorization:</p>
              <ul className="space-y-1 text-xs">
                <li><strong>Live Orders:</strong> Orders placed within the last 30 minutes with ACTIVE status only (never completed orders)</li>
                <li><strong>Earlier Today:</strong> Orders from today that are not in live orders (including completed orders)</li>
                <li><strong>History:</strong> Orders from previous days</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Debug Info - Tab Counts */}
        {tabCounts && (
          <div className="mb-4 p-4 bg-gray-50 border border-gray-200 rounded-lg">
            <div className="flex items-start space-x-3">
              <div className="w-2 h-2 bg-gray-500 rounded-full mt-2"></div>
              <div className="text-sm text-gray-800">
                <p className="font-medium mb-1">Current Tab Counts (Debug):</p>
                <div className="grid grid-cols-3 gap-4 text-xs">
                  <div>
                    <strong>Live:</strong> {tabCounts.live_count}
                  </div>
                  <div>
                    <strong>Earlier Today:</strong> {tabCounts.earlier_today_count}
                  </div>
                  <div>
                    <strong>History:</strong> {tabCounts.history_count}
                  </div>
                </div>
                <div className="mt-2 text-xs text-gray-600">
                  <strong>Total Today:</strong> {tabCounts.today_orders_count} | <strong>Active Tables:</strong> {tabCounts.active_tables_count}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Debug Info - Time Window */}
        {todayWindow && (
          <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-start space-x-3">
              <div className="w-2 h-2 bg-yellow-500 rounded-full mt-2"></div>
              <div className="text-sm text-yellow-800">
                <p className="font-medium mb-1">Current Time Window (Debug):</p>
                <div className="text-xs space-y-1">
                  <div><strong>Start (UTC):</strong> {todayWindow.startUtcISO}</div>
                  <div><strong>End (UTC):</strong> {todayWindow.endUtcISO}</div>
                  <div><strong>Current Time (UTC):</strong> {new Date().toISOString()}</div>
                  <div><strong>Current Time (Local):</strong> {new Date().toLocaleString()}</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Manual Refresh Button */}
        <div className="mb-4 flex justify-center">
          <Button 
            onClick={() => {
              refetchCounts();
              loadVenueAndOrders();
            }}
            variant="outline"
            size="sm"
            className="text-xs"
          >
            🔄 Refresh Counts & Orders
          </Button>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(newTab) => {
          console.log('[LIVE_ORDERS_CLIENT] ===== TAB SELECTED =====');
          console.log('[LIVE_ORDERS_CLIENT] Previous Tab:', activeTab);
          console.log('[LIVE_ORDERS_CLIENT] New Tab:', newTab);
          console.log('[LIVE_ORDERS_CLIENT] Venue ID:', venueId);
          console.log('[LIVE_ORDERS_CLIENT] Current Orders Count:', orders.length);
          console.log('[LIVE_ORDERS_CLIENT] Tab Counts:', tabCounts);
          console.log('[LIVE_ORDERS_CLIENT] ===== END TAB SELECTION =====');
          setActiveTab(newTab);
        }} className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-6">
            <TabsTrigger value="live" className="flex items-center space-x-2">
              <span>Live (Last 30 Min)</span>
              {tabCounts?.live_count > 0 && (
                <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full">{tabCounts.live_count}</span>
              )}
            </TabsTrigger>
            <TabsTrigger value="all" className="flex items-center space-x-2">
              <span>Earlier Today</span>
              {tabCounts?.earlier_today_count > 0 && (
                <span className="bg-blue-500 text-white text-xs px-2 py-1 rounded-full">{tabCounts.earlier_today_count}</span>
              )}
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center space-x-2">
              <span>History</span>
              {tabCounts?.history_count > 0 && (
                <span className="bg-gray-500 text-white text-xs px-2 py-1 rounded-full">{tabCounts.history_count}</span>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="live" className="mt-6">
            <div className="grid gap-6">
              {orders.length === 0 ? (
                <Card>
                  <CardContent className="p-8 text-center">
                    <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No Recent Orders</h3>
                    <p className="text-gray-500">Orders placed within the last 30 minutes will appear here</p>
                  </CardContent>
                </Card>
              ) : (
                orders.map((order) => renderOrderCard(order, true))
              )}
            </div>
          </TabsContent>

          <TabsContent value="all" className="mt-6">
            <div className="grid gap-6">
              {allTodayOrders.length === 0 ? (
                <Card>
                  <CardContent className="p-8 text-center">
                    <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No Earlier Orders Today</h3>
                    <p className="text-gray-500">Orders from earlier today (not in live orders) will appear here</p>
                  </CardContent>
                </Card>
              ) : (
                allTodayOrders.map((order) => renderOrderCard(order, false))
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