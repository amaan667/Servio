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
  const LIVE_WINDOW_STATUSES = ['PLACED', 'ACCEPTED', 'IN_PREP', 'READY', 'OUT_FOR_DELIVERY', 'SERVING', 'COMPLETED']; // Include COMPLETED for 30-min window
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
      // Only refresh counts, not the full order list to avoid overwriting optimistic updates
      // The real-time subscription handles order updates
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
      // Load live orders - orders placed within the last 30 minutes (including completed orders)
      const liveOrdersCutoff = new Date(Date.now() - LIVE_ORDER_WINDOW_MS).toISOString();
      
      const { data: liveData, error: liveError } = await createClient()
        .from('orders')
        .select('*')
        .eq('venue_id', venueId)
        .in('order_status', LIVE_WINDOW_STATUSES)
        .gte('created_at', liveOrdersCutoff)
        .order('created_at', { ascending: false });

      // Load earlier today orders (today but more than 30 minutes ago)
      const { data: allData, error: allError } = await createClient()
        .from('orders')
        .select('*')
        .eq('venue_id', venueId)
        .gte('created_at', window.startUtcISO)
        .lt('created_at', liveOrdersCutoff)  // Before the live orders cutoff (30 minutes ago)
        .order('created_at', { ascending: false });

      // Load history orders (all orders before today, not just terminal statuses)
      const { data: historyData, error: historyError } = await createClient()
        .from('orders')
        .select('*')
        .eq('venue_id', venueId)
        .lt('created_at', window.startUtcISO)
        .order('created_at', { ascending: false })
        .limit(100); // Limit to last 100 orders

      
      if (liveError) {
        console.error('[LIVE ORDERS DEBUG] Live orders error:', liveError);
      }
      if (allError) {
        console.error('[LIVE ORDERS DEBUG] Earlier today orders error:', allError);
      }
      if (historyError) {
        console.error('[LIVE ORDERS DEBUG] History orders error:', historyError);
      }

      if (!liveError && liveData) {
        setOrders(liveData as Order[]);
      }
      if (!allError && allData) {
        
        // Earlier Today shows orders from today that are older than 30 minutes
        // Also exclude completed orders from the last 30 minutes (they stay in live)
        const liveOrderIds = new Set((liveData || []).map((order: any) => order.id));
        const thirtyMinutesAgo = new Date(Date.now() - LIVE_ORDER_WINDOW_MS);
        
        const allTodayFiltered = allData.filter((order: any) => {
          // Don't show orders that are already in live orders
          if (liveOrderIds.has(order.id)) {
            return false;
          }
          
          // Show completed orders in Earlier Today (they move from Live Orders when completed)
          // No special filtering needed for completed orders
          
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
            const isLiveOrder = LIVE_WINDOW_STATUSES.includes(newOrder.order_status);
            const orderCreatedAt = new Date(newOrder.created_at);
            const isRecentOrder = orderCreatedAt > new Date(Date.now() - LIVE_ORDER_WINDOW_MS);
            
            // Show orders with live window statuses in live orders (including completed orders within 30 min)
            if (isLiveOrder && isRecentOrder) {
              console.log('[LIVE ORDERS DEBUG] Adding to live orders - recent order with live window status');
              setOrders(prev => [newOrder, ...prev]);
            }
            
            // Check if order should appear in all today orders
            const isInTodayWindow = orderCreatedAt && todayWindow && 
              orderCreatedAt >= new Date(todayWindow.startUtcISO) && 
              orderCreatedAt < new Date(todayWindow.endUtcISO);
            
                      if (isInTodayWindow) {
            // Only add to all today if it's NOT already in live orders
            if (!(isLiveOrder && isRecentOrder)) {
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
            const isLiveOrder = LIVE_WINDOW_STATUSES.includes(newOrder.order_status);
            const orderCreatedAt = new Date(newOrder.created_at);
            const isRecentOrder = orderCreatedAt > new Date(Date.now() - LIVE_ORDER_WINDOW_MS);
            
            // Include completed orders in live orders if within 30-minute window
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
              console.log('[LIVE ORDERS DEBUG] Removing order from live orders:', {
                orderId: newOrder.id,
                newStatus: newOrder.order_status,
                isLiveOrder,
                isRecentOrder
              });
              setOrders(prev => prev.filter(order => order.id !== newOrder.id));
              
              // Add to all today orders if it's from today and not recent
              if (todayWindow && orderCreatedAt >= new Date(todayWindow.startUtcISO) && orderCreatedAt < new Date(todayWindow.endUtcISO)) {
                console.log('[LIVE ORDERS DEBUG] Adding order to all today orders:', {
                  orderId: newOrder.id,
                  newStatus: newOrder.order_status
                });
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
          // Keep order in live if it's both recent AND in live window statuses (including completed)
          return orderCreatedAt > cutoff && LIVE_WINDOW_STATUSES.includes(order.order_status);
        });
        
        const movedToAllToday = prevOrders.filter(order => {
          const orderCreatedAt = new Date(order.created_at);
          // Move order if it's either old OR not in live window statuses
          return orderCreatedAt <= cutoff || !LIVE_WINDOW_STATUSES.includes(order.order_status);
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

  const renderOrderCard = (order: Order, showActions: boolean = true) => {
    const isCompleted = order.order_status === 'COMPLETED';
    const borderColor = isCompleted ? 'border-l-green-500' : 'border-l-blue-500';
    
    return (
    <Card key={order.id} className={`hover:shadow-md transition-shadow border-l-4 ${borderColor}`}>
      <CardContent className="p-4 sm:p-6">
        {/* Header - Mobile optimized */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 space-y-2 sm:space-y-0">
          <div className="flex flex-col sm:flex-row sm:items-center space-y-1 sm:space-y-0 sm:space-x-4">
            <div className="flex items-center space-x-2">
              <div className="text-sm font-medium text-gray-900">
                {formatTime(order.created_at)}
              </div>
              <div className="text-sm text-gray-500">•</div>
              <div className="font-semibold text-gray-900">
                Table {order.table_number || 'Takeaway'}
              </div>
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
          <div className="flex items-center justify-between sm:justify-end space-x-2">
            <div className="text-lg font-bold text-gray-900">
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

        {/* Status badges - Mobile optimized */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <Badge className={`${getStatusColor(order.order_status)} text-xs font-medium px-2 py-1`}>
            {order.order_status.replace('_', ' ').toLowerCase()}
          </Badge>
          {isCompleted && (
            <Badge className="bg-green-100 text-green-800 text-xs font-medium px-2 py-1">
              ✓ Completed
            </Badge>
          )}
          {order.payment_status && (
            <Badge className={`${getPaymentStatusColor(order.payment_status)} text-xs font-medium px-2 py-1`}>
              {order.payment_status.toUpperCase()}
            </Badge>
          )}
        </div>

        {/* Order Items - Mobile optimized */}
        <div className="space-y-2 mb-4">
          {order.items.map((item, index) => {
            console.log('[LIVE ORDERS DEBUG] Rendering item:', item);
            return (
              <div key={index} className="flex justify-between items-center text-sm bg-gray-50 rounded-md p-2">
                <span className="font-medium text-gray-900">{item.quantity}x {item.item_name}</span>
                <span className="font-semibold text-gray-700">£{(item.quantity * item.price).toFixed(2)}</span>
              </div>
            );
          })}
        </div>

        {/* Action Buttons - Mobile optimized */}
        {showActions && !isCompleted && (
          <div className="flex flex-col sm:flex-row gap-2">
            {order.order_status === 'PLACED' && (
              <Button 
                size="sm"
                onClick={() => updateOrderStatus(order.id, 'IN_PREP')}
                className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700"
              >
                Start Preparing
              </Button>
            )}
            {order.order_status === 'IN_PREP' && (
              <Button 
                size="sm"
                onClick={() => updateOrderStatus(order.id, 'READY')}
                className="w-full sm:w-auto bg-green-600 hover:bg-green-700"
              >
                Mark Ready
              </Button>
            )}
            {order.order_status === 'READY' && (
              <Button 
                size="sm"
                onClick={() => updateOrderStatus(order.id, 'SERVING')}
                className="w-full sm:w-auto bg-purple-600 hover:bg-purple-700"
              >
                Mark Served
              </Button>
            )}
            {order.order_status === 'SERVING' && (
              <Button 
                size="sm"
                onClick={() => updateOrderStatus(order.id, 'COMPLETED')}
                className="w-full sm:w-auto bg-gray-600 hover:bg-gray-700"
              >
                Mark Complete
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
    );
  };

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
        <div className="mb-6 space-y-4">
          {/* Mobile-first layout */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-2 sm:space-y-0">
            <div className="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-4">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-sm text-muted-foreground">Real-time monitoring active</span>
              </div>
              <div className="hidden sm:flex items-center space-x-2">
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
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-4">
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
          
          {/* Mobile date/time info */}
          <div className="sm:hidden flex items-center space-x-2 text-sm text-muted-foreground">
            <span>
              {new Date().toLocaleDateString('en-GB', { 
                day: 'numeric', 
                month: 'long' 
              })} (today)
            </span>
            <span>•</span>
            <span>
              Current time: {new Date().toLocaleTimeString('en-GB', { 
                hour: '2-digit', 
                minute: '2-digit' 
              })}
            </span>
          </div>
        </div>


        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(newTab) => {
          setActiveTab(newTab);
        }} className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-6 gap-1 p-1 bg-gray-100 rounded-lg">
            <TabsTrigger 
              value="live" 
              className="flex flex-col items-center justify-center space-y-1 text-sm font-medium px-3 py-4 rounded-md transition-all duration-200 data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-gray-200 data-[state=active]:text-red-600 data-[state=inactive]:text-gray-600 hover:text-gray-900 hover:bg-gray-50"
            >
              <div className="flex items-center space-x-2">
                <span className="font-semibold">Live Orders</span>
                {tabCounts?.live_count > 0 && (
                  <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full font-bold min-w-[20px] text-center">{tabCounts.live_count}</span>
                )}
              </div>
              <span className="text-xs text-gray-500">Last 30 min</span>
            </TabsTrigger>
            <TabsTrigger 
              value="all" 
              className="flex flex-col items-center justify-center space-y-1 text-sm font-medium px-3 py-4 rounded-md transition-all duration-200 data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-gray-200 data-[state=active]:text-blue-600 data-[state=inactive]:text-gray-600 hover:text-gray-900 hover:bg-gray-50"
            >
              <div className="flex items-center space-x-2">
                <span className="font-semibold">Earlier Today</span>
                {tabCounts?.earlier_today_count > 0 && (
                  <span className="bg-blue-500 text-white text-xs px-2 py-1 rounded-full font-bold min-w-[20px] text-center">{tabCounts.earlier_today_count}</span>
                )}
              </div>
              <span className="text-xs text-gray-500">Today's orders</span>
            </TabsTrigger>
            <TabsTrigger 
              value="history" 
              className="flex flex-col items-center justify-center space-y-1 text-sm font-medium px-3 py-4 rounded-md transition-all duration-200 data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-gray-200 data-[state=active]:text-gray-700 data-[state=inactive]:text-gray-600 hover:text-gray-900 hover:bg-gray-50"
            >
              <div className="flex items-center space-x-2">
                <span className="font-semibold">History</span>
                {tabCounts?.history_count > 0 && (
                  <span className="bg-gray-500 text-white text-xs px-2 py-1 rounded-full font-bold min-w-[20px] text-center">{tabCounts.history_count}</span>
                )}
              </div>
              <span className="text-xs text-gray-500">Previous days</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="live" className="mt-4">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                <span className="text-sm font-medium text-red-800">Live Orders - Last 30 Minutes</span>
              </div>
              <p className="text-xs text-red-600 mt-1">Orders placed within the last 30 minutes (including completed orders)</p>
            </div>
            <div className="grid gap-4">
              {orders.length === 0 ? (
                <Card className="border-dashed border-2 border-gray-200">
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

          <TabsContent value="all" className="mt-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                <span className="text-sm font-medium text-blue-800">Earlier Today</span>
              </div>
              <p className="text-xs text-blue-600 mt-1">Orders from today that are not in live orders</p>
            </div>
            <div className="grid gap-4">
              {allTodayOrders.length === 0 ? (
                <Card className="border-dashed border-2 border-gray-200">
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

          <TabsContent value="history" className="mt-4">
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-gray-500 rounded-full"></div>
                <span className="text-sm font-medium text-gray-800">Order History</span>
              </div>
              <p className="text-xs text-gray-600 mt-1">Orders from previous days</p>
            </div>
            <div className="space-y-6">
              {Object.keys(groupedHistoryOrders).length === 0 ? (
                <Card className="border-dashed border-2 border-gray-200">
                  <CardContent className="p-8 text-center">
                    <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No Historical Orders</h3>
                    <p className="text-gray-500">Previous orders will appear here</p>
                  </CardContent>
                </Card>
              ) : (
                Object.entries(groupedHistoryOrders).map(([date, orders]) => (
                  <div key={date} className="space-y-4">
                    <div className="flex items-center space-x-2">
                      <h3 className="text-lg font-semibold text-gray-900">{date}</h3>
                      <span className="bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded-full">{orders.length} orders</span>
                    </div>
                    <div className="grid gap-4">
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