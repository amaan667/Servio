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
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/client";
import { Clock, ArrowLeft, User } from "lucide-react";
import { todayWindowForTZ } from "@/lib/time";
import { useTabCounts } from "@/hooks/use-tab-counts";
import { calculateOrderTotal, formatPrice, normalizePrice } from "@/lib/pricing-utils";


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
  const ACTIVE_TABLE_ORDER_STATUSES = ['PLACED', 'ACCEPTED', 'IN_PREP', 'READY', 'SERVING']; // Only active orders for table management
  const prepLeadMs = 30 * 60 * 1000; // 30 minutes default
  
  // Define what constitutes a "live" order - orders placed within the last 30 minutes
  const LIVE_ORDER_WINDOW_MS = 30 * 60 * 1000; // 30 minutes

  // Auto-refresh functionality
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(15000); // 15 seconds
  const autoRefreshRef = useRef<NodeJS.Timeout | null>(null);

  // Use the authoritative tab counts hook with error handling
  const { data: tabCounts, isLoading: countsLoading, error: countsError, refetch: refetchCounts } = useTabCounts(venueId, 'Europe/London', 30);
  // Local fallback counts if RPC is unavailable or returns 0
  const [localCounts, setLocalCounts] = useState<{ live_count: number; earlier_today_count: number; history_count: number } | null>(null);
  
  // State for managing table group expansion
  const [expandedTables, setExpandedTables] = useState<Set<number>>(new Set());
  
  // Helper functions for table expansion
  const toggleTableExpansion = (tableNumber: number) => {
    setExpandedTables(prev => {
      const newSet = new Set(prev);
      if (newSet.has(tableNumber)) {
        newSet.delete(tableNumber);
      } else {
        newSet.add(tableNumber);
      }
      return newSet;
    });
  };
  
  const isTableExpanded = (tableNumber: number) => {
    return expandedTables.has(tableNumber);
  };

  // Refresh counts when component mounts or venue changes
  useEffect(() => {
    if (venueId) {
      refetchCounts();
    }
  }, [venueId, refetchCounts]);

  // Handle RPC function errors by using fallback logic
  useEffect(() => {
    if (countsError) {
      console.error('[LIVE_ORDERS] RPC function error, using fallback logic:', countsError);
      // If RPC fails, we'll rely on local counts calculation
      recalcLocalCounts();
    }
  }, [countsError]);

  // Debug log when tab counts change
  useEffect(() => {
    if (tabCounts) {
    }
  }, [tabCounts]);

  // Lightweight local recount using COUNT(*) to avoid heavy loads
  const recalcLocalCounts = async () => {
    try {
      if (!todayWindow) return;
      const supabase = createClient();
      const startUtc = todayWindow.startUtcISO;
      const endUtc = todayWindow.endUtcISO;
      const liveCutoff = new Date(Date.now() - LIVE_ORDER_WINDOW_MS).toISOString();

      const todayTotalPromise = supabase
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .eq('venue_id', venueId)
        .gte('created_at', startUtc)
        .lt('created_at', endUtc);

      const liveEligiblePromise = supabase
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .eq('venue_id', venueId)
        .in('order_status', ['PLACED','ACCEPTED','IN_PREP','READY','OUT_FOR_DELIVERY','SERVING','COMPLETED'])
        .gte('created_at', startUtc)
        .lt('created_at', endUtc)
        .gte('created_at', liveCutoff);

      const historyPromise = supabase
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .eq('venue_id', venueId)
        .lt('created_at', startUtc);

      const [{ count: todayTotal }, { count: liveEligible }, { count: historyCount }] = await Promise.all([
        todayTotalPromise,
        liveEligiblePromise,
        historyPromise,
      ]);

      const live_count = liveEligible || 0;
      const earlier_today_count = Math.max(0, (todayTotal || 0) - (liveEligible || 0));
      const history_count = historyCount || 0;

      setLocalCounts({ live_count, earlier_today_count, history_count });
    } catch (err) {
      console.error('[LIVE ORDERS] Failed to recalc local counts', err);
    }
  };

  // Recalc when today window becomes available
  useEffect(() => {
    recalcLocalCounts();
  }, [todayWindow]);

  // Set up today window when component mounts
  useEffect(() => {
    const window = todayWindowForTZ('Europe/London');
    if (window.startUtcISO && window.endUtcISO) {
      setTodayWindow({
        startUtcISO: window.startUtcISO,
        endUtcISO: window.endUtcISO
      });
    }
  }, []);

  // Prevent infinite loading by setting a timeout
  useEffect(() => {
    const loadingTimeout = setTimeout(() => {
      if (loading) {
        console.warn('[LIVE_ORDERS] Loading timeout reached, setting loading to false');
        setLoading(false);
      }
    }, 10000); // 10 second timeout

    return () => clearTimeout(loadingTimeout);
  }, [loading]);

  // Force loading to false if RPC function fails
  useEffect(() => {
    if (countsError && loading) {
      console.warn('[LIVE_ORDERS] RPC function failed, forcing loading to false');
      setLoading(false);
    }
  }, [countsError, loading]);

  // Prefer local counts if RPC is missing or reports 0 while local > 0
  const getDisplayCount = (key: 'live' | 'all' | 'history') => {
    const rpc = key === 'live' ? tabCounts?.live_count : key === 'all' ? tabCounts?.earlier_today_count : tabCounts?.history_count;
    const local = key === 'live' ? localCounts?.live_count : key === 'all' ? localCounts?.earlier_today_count : localCounts?.history_count;
    if (typeof rpc === 'number' && rpc > 0) return rpc;
    if (typeof local === 'number' && local > 0) return local;
    return (typeof rpc === 'number' ? rpc : (local || 0)) || 0;
  };

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
      recalcLocalCounts();
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
      let venueTimezone = 'Europe/London';
      if (!venueNameProp) {
        const { data: venueData } = await createClient()
          .from('venues')
          .select('name')
          .eq('venue_id', venueId)
          .single();
        setVenueName(venueData?.name || '');
        // keep default timezone for now; replace with venue setting when available
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
        .gte('created_at', window.startUtcISO)
        .lt('created_at', window.endUtcISO)
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
          
          // Show all orders from earlier today - keep their original status
          return true;
        }).map((order: any) => {
          // Keep orders in their original status - don't auto-complete them
          // Only mark as completed/paid if they are from previous days (history)
          console.log('[LIVE ORDERS DEBUG] Processing earlier today order - keeping original status:', order.id, order.order_status);
          return order;
        });
        
        console.log('[LIVE ORDERS DEBUG] Filtered all today orders (excluding live orders):', {
          originalCount: allData.length,
          filteredCount: allTodayFiltered.length,
          liveOrderIds: Array.from(liveOrderIds)
        });
        
        setAllTodayOrders(allTodayFiltered as Order[]);
      }
      if (!historyError && historyData) {
        // Mark all historical orders as PAID and COMPLETED
        const processedHistory = (historyData as Order[]).map((order: Order) => {
          console.log('[LIVE ORDERS DEBUG] Processing historical order - marking as PAID and COMPLETED:', order.id);
          return {
            ...order,
            payment_status: 'PAID',
            order_status: 'COMPLETED' as const
          };
        });
        
        setHistoryOrders(processedHistory);
        
        // Group history orders by date
        const grouped = processedHistory.reduce((acc: GroupedHistoryOrders, order) => {
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
        
        // Update the database for these orders to reflect the status change
        processedHistory.forEach((order: Order) => {
          updateOrderToCompletedAndPaid(order.id);
        });
      }
      // Compute local counts as a robust fallback for badges
      try {
        const liveCount = (liveData || []).length;
        const earlierCount = (allTodayOrders || []).length > 0 ? (allTodayOrders as Order[]).length : (allData ? (allData as any[]).length - (liveData ? (liveData as any[]).length : 0) : 0);
        const historyCount = (historyData || []).length || 0;
        setLocalCounts({ live_count: liveCount, earlier_today_count: Math.max(0, earlierCount), history_count: historyCount });
      } catch {}
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
                console.log('[LIVE ORDERS DEBUG] Adding to all today orders - keeping original status');
                // Keep original status - don't auto-complete orders
                setAllTodayOrders(prev => [newOrder, ...prev]);
              } else {
                setAllTodayOrders(prev => [newOrder, ...prev]);
              }
            } else {
              console.log('[LIVE ORDERS DEBUG] Adding to history orders - not from today, marking as PAID and COMPLETED');
              // Mark historical orders as PAID and COMPLETED
              const processedOrder = {
                ...newOrder,
                payment_status: 'PAID',
                order_status: 'COMPLETED' as const
              };
              setHistoryOrders(prev => [processedOrder, ...prev]);
              // Update grouped history
              const date = new Date(newOrder.created_at).toLocaleDateString('en-GB', {
                day: '2-digit',
                month: 'short',
                year: 'numeric'
              });
              setGroupedHistoryOrders(prev => ({
                ...prev,
                [date]: [processedOrder, ...(prev[date] || [])]
              }));
              
              // Update the order in database to reflect the status change
              updateOrderToCompletedAndPaid(newOrder.id);
            }
          
          // Refresh the authoritative counts
          refetchCounts();
          recalcLocalCounts();
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
                console.log('[LIVE ORDERS DEBUG] Adding order to all today orders - keeping original status:', {
                  orderId: newOrder.id,
                  newStatus: newOrder.order_status
                });
                
                // Keep original status when moving to "Earlier Today"
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
            recalcLocalCounts();
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
            recalcLocalCounts();
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
          console.log('[LIVE ORDERS DEBUG] Moving orders from live to all today - keeping original status:', movedToAllToday.length);
          
          // Keep original status - don't auto-complete orders
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

  // Helper function to update orders to COMPLETED and PAID when they're not in live orders
  const updateOrderToCompletedAndPaid = async (orderId: string) => {
    try {
      console.log('[LIVE ORDERS DEBUG] Updating order to COMPLETED and PAID:', orderId);
      const { error } = await createClient()
        .from('orders')
        .update({ 
          order_status: 'COMPLETED',
          payment_status: 'PAID',
          updated_at: new Date().toISOString()
        })
        .eq('id', orderId)
        .eq('venue_id', venueId);

      if (error) {
        console.error('[LIVE ORDERS DEBUG] Failed to update order to COMPLETED and PAID:', error);
      } else {
        console.log('[LIVE ORDERS DEBUG] Successfully updated order to COMPLETED and PAID:', orderId);
      }
    } catch (error) {
      console.error('[LIVE ORDERS DEBUG] Exception updating order to COMPLETED and PAID:', error);
    }
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-GB', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  // Generate short order number
  const getShortOrderNumber = (orderId: string) => {
    // Use last 6 characters of UUID for shorter display
    return orderId.slice(-6).toUpperCase();
  };

  // Determine if it's a counter order - use source field as primary indicator
  const isCounterOrder = (order: Order) => {
    return order.source === 'counter';
  };

  // Group table orders by table number, but only group orders that are actually related
  const groupOrdersByTable = (orders: Order[]) => {
    const tableGroups: { [tableNumber: number]: Order[] } = {};
    
    orders.forEach(order => {
      const tableNum = order.table_number || 0;
      if (!tableGroups[tableNum]) {
        tableGroups[tableNum] = [];
      }
      tableGroups[tableNum].push(order);
    });

    // Filter out groups that have orders from different customers or are too far apart in time
    const filteredGroups: { [tableNumber: number]: Order[] } = {};
    
    Object.keys(tableGroups).forEach(tableNum => {
      const orders = tableGroups[Number(tableNum)];
      
      // If only one order, keep it as is
      if (orders.length === 1) {
        filteredGroups[Number(tableNum)] = orders;
        return;
      }
      
      // Sort orders by creation time
      orders.sort((a, b) => {
        const dateA = new Date(a.created_at);
        const dateB = new Date(b.created_at);
        return dateA.getTime() - dateB.getTime();
      });
      
      // Check if orders should be grouped together
      const shouldGroup = orders.every((order, index) => {
        if (index === 0) return true; // First order is always included
        
        const prevOrder = orders[index - 1];
        const timeDiff = new Date(order.created_at).getTime() - new Date(prevOrder.created_at).getTime();
        const timeDiffMinutes = timeDiff / (1000 * 60);
        
        // Group orders if they're from the same customer AND within 30 minutes of each other
        const sameCustomer = order.customer_name === prevOrder.customer_name;
        const withinTimeWindow = timeDiffMinutes <= 30;
        
        return sameCustomer && withinTimeWindow;
      });
      
      if (shouldGroup) {
        // All orders can be grouped together
        filteredGroups[Number(tableNum)] = orders;
      } else {
        // Orders should be treated as individual orders
        // We'll handle this by not adding them to filteredGroups
        // and they'll be displayed as individual orders instead
      }
    });

    return filteredGroups;
  };

  // Calculate table total and status summary
  const getTableSummary = (orders: Order[]) => {
    const total = orders.reduce((sum, order) => {
      return sum + calculateOrderTotal({ total_amount: order.total_amount, items: order.items });
    }, 0);

    const statuses = orders.map(order => order.order_status);
    const paymentStatuses = orders.map(order => order.payment_status).filter(Boolean);
    
    // Determine overall status
    let overallStatus = 'MIXED';
    const uniqueStatuses = [...new Set(statuses)];
    if (uniqueStatuses.length === 1) {
      overallStatus = uniqueStatuses[0];
    } else if (uniqueStatuses.includes('READY')) {
      overallStatus = 'MIXED_READY';
    } else if (uniqueStatuses.includes('IN_PREP')) {
      overallStatus = 'MIXED_PREP';
    }

    const uniquePaymentStatuses = [...new Set(paymentStatuses)];
    let overallPaymentStatus = 'MIXED';
    if (uniquePaymentStatuses.length === 1 && uniquePaymentStatuses[0]) {
      overallPaymentStatus = uniquePaymentStatuses[0];
    }

    return {
      total,
      orderCount: orders.length,
      overallStatus,
      overallPaymentStatus,
      statuses: uniqueStatuses,
      paymentStatuses: uniquePaymentStatuses
    };
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
      case 'MIXED': return 'bg-purple-100 text-purple-800';
      case 'MIXED_READY': return 'bg-emerald-100 text-emerald-800';
      case 'MIXED_PREP': return 'bg-indigo-100 text-indigo-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPaymentStatusColor = (paymentStatus: string) => {
    switch (paymentStatus) {
      case 'PAID': return 'bg-green-100 text-green-800';
      case 'UNPAID': return 'bg-red-100 text-red-800';
      case 'PAY_LATER': return 'bg-blue-100 text-blue-800';
      case 'IN_PROGRESS': return 'bg-blue-100 text-blue-800';
      case 'REFUNDED': return 'bg-red-100 text-red-800';
      case 'MIXED': return 'bg-amber-100 text-amber-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const renderOrderCard = (order: Order, showActions: boolean = true) => {
    const isCompleted = order.order_status === 'COMPLETED';
    
    // Calculate total amount using standardized function
    const totalAmount = calculateOrderTotal({ total_amount: order.total_amount, items: order.items });

    // Generate order ID for display (last 6 characters)
    const orderId = order.id.slice(-6).toUpperCase();
    
    // Create items summary for POS-style display
    const itemsSummary = order.items.map(item => 
      `${item.quantity}x ${item.item_name}`
    ).join(', ');
    
    return (
      <article key={order.id} className="bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow">
        {/* POS-Style Header */}
        <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 rounded-t-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-blue-600 text-white px-3 py-1 rounded-md font-bold text-sm">
                #{orderId}
              </div>
              <div className="text-sm text-gray-600">
                {formatTime(order.created_at)}
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-gray-900">
                £{totalAmount.toFixed(2)}
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="p-4">
          {/* Customer Info */}
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-1">
              <User className="h-4 w-4 text-gray-500" />
              <span className="font-semibold text-gray-900">
                {order.customer_name || 'Guest Customer'}
              </span>
            </div>
            {order.customer_phone && (
              <div className="text-sm text-gray-600 ml-6">
                {order.customer_phone}
              </div>
            )}
          </div>

          {/* Items Summary - POS Style */}
          <div className="mb-4">
            <div className="text-sm font-medium text-gray-700 mb-2">Order Items:</div>
            <div className="bg-gray-50 rounded-md p-3">
              <div className="text-sm text-gray-800 leading-relaxed">
                {itemsSummary}
              </div>
            </div>
          </div>

          {/* Status and Actions Row */}
          <div className="flex items-center justify-between">
            {/* Status Badges */}
            <div className="flex items-center gap-2">
              <Badge className={`${getStatusColor(order.order_status)} text-xs font-semibold px-3 py-1 rounded-full`}>
                {order.order_status.replace('_', ' ').toLowerCase()}
              </Badge>
              {order.payment_status && (
                <Badge className={`${getPaymentStatusColor(order.payment_status)} text-xs font-semibold px-3 py-1 rounded-full`}>
                  {order.payment_status.toLowerCase()}
                </Badge>
              )}
            </div>

            {/* Action Buttons - Show for orders that aren't completed */}
            {showActions && order.order_status !== 'COMPLETED' && (
              <div className="flex items-center gap-2">
                {order.order_status === 'PLACED' && (
                  <Button 
                    size="sm"
                    onClick={() => updateOrderStatus(order.id, 'IN_PREP')}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2 rounded-lg shadow-sm transition-all duration-200 hover:shadow-md text-sm"
                  >
                    Start Preparing
                  </Button>
                )}
                {order.order_status === 'IN_PREP' && (
                  <Button 
                    size="sm"
                    onClick={() => updateOrderStatus(order.id, 'READY')}
                    className="bg-green-600 hover:bg-green-700 text-white font-semibold px-4 py-2 rounded-lg shadow-sm transition-all duration-200 hover:shadow-md text-sm"
                  >
                    Mark Ready
                  </Button>
                )}
                {order.order_status === 'READY' && (
                  <Button 
                    size="sm"
                    onClick={() => updateOrderStatus(order.id, 'SERVING')}
                    className="bg-purple-600 hover:bg-purple-700 text-white font-semibold px-4 py-2 rounded-lg shadow-sm transition-all duration-200 hover:shadow-md text-sm"
                  >
                    Mark Served
                  </Button>
                )}
                {order.order_status === 'SERVING' && (
                  <Button 
                    size="sm"
                    onClick={() => updateOrderStatus(order.id, 'COMPLETED')}
                    className="bg-gray-600 hover:bg-gray-700 text-white font-semibold px-4 py-2 rounded-lg shadow-sm transition-all duration-200 hover:shadow-md text-sm"
                  >
                    Mark Complete
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </article>
    );
  };

  // Render table group card with expandable orders
  const renderTableGroupCard = (tableNumber: number, orders: Order[], showActions: boolean = true) => {
    const isExpanded = isTableExpanded(tableNumber);
    const summary = getTableSummary(orders);
    const earliestOrder = orders[0];
    const latestOrder = orders[orders.length - 1];

    return (
      <div key={tableNumber} className="rounded-xl border border-gray-200 bg-white shadow-sm transition-all duration-200 hover:shadow-lg">
        {/* Table Header - POS System Style */}
        <div className="p-6 border-b border-gray-100">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column - Time and Table Info */}
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Clock className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-500">Order Time</div>
                  <div className="text-lg font-semibold text-gray-900">
                    {formatTime(earliestOrder.created_at)}
                  </div>
                  {orders.length > 1 && (
                    <div className="text-xs text-gray-500">
                      Latest: {formatTime(latestOrder.created_at)}
                    </div>
                  )}
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <span className="text-lg font-bold text-green-600">T</span>
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-500">Table Number</div>
                  <div className="text-2xl font-bold text-gray-900">
                    Table {tableNumber}
                  </div>
                  <div className="text-xs px-2 py-1 rounded-full bg-blue-50 text-blue-700 font-medium w-fit">
                    QR Table
                  </div>
                </div>
              </div>
            </div>

            {/* Middle Column - Customer and Order Info */}
            <div className="space-y-4">
              {earliestOrder.customer_name && (
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                    <User className="h-6 w-6 text-purple-600" />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-gray-500">Customer</div>
                    <div className="text-lg font-semibold text-gray-900">
                      {earliestOrder.customer_name}
                    </div>
                    {earliestOrder.customer_phone && (
                      <div className="text-sm text-gray-600">
                        {earliestOrder.customer_phone}
                      </div>
                    )}
                  </div>
                </div>
              )}
              
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                  <span className="text-lg font-bold text-orange-600">#</span>
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-500">Orders</div>
                  <div className="text-lg font-semibold text-gray-900">
                    {summary.orderCount} order{summary.orderCount > 1 ? 's' : ''}
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column - Total and Status */}
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center">
                  <span className="text-lg font-bold text-emerald-600">£</span>
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-500">Total Amount</div>
                  <div className="text-3xl font-bold text-gray-900">
                    £{formatPrice(summary.total)}
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
                  <span className="text-lg font-bold text-gray-600">✓</span>
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-500">Status</div>
                  <div className="flex items-center gap-2">
                    <Badge className={`${getStatusColor(summary.overallStatus)} text-xs font-semibold px-3 py-1.5 rounded-full`}>
                      {summary.overallStatus.replace('_', ' ').toLowerCase()}
                    </Badge>
                    <Badge className={`${getPaymentStatusColor(summary.overallPaymentStatus)} text-xs font-semibold px-3 py-1.5 rounded-full`}>
                      {summary.overallPaymentStatus.toLowerCase()}
                    </Badge>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Expand/Collapse button - Full width */}
          <div className="mt-6 pt-4 border-t border-gray-100">
            <button
              onClick={() => toggleTableExpansion(tableNumber)}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-colors"
            >
              <span>{isExpanded ? 'Hide' : 'Show'} individual orders</span>
              <svg
                className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>
        </div>

        {/* Expanded Orders List */}
        {isExpanded && (
          <div className="p-6 pt-4">
            <div className="space-y-6">
              <h4 className="text-lg font-semibold text-gray-700 mb-4 flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-blue-500"></span>
                Individual Orders
              </h4>
              {orders.map((order, index) => (
                <div key={order.id} className="border border-gray-200 rounded-xl p-6 bg-white shadow-sm">
                  {/* Order Header */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    {/* Order Info */}
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                        <span className="text-sm font-bold text-blue-600">#{index + 1}</span>
                      </div>
                      <div>
                        <div className="text-sm font-medium text-gray-500">Order Time</div>
                        <div className="text-lg font-semibold text-gray-900">
                          {formatTime(order.created_at)}
                        </div>
                        <div className="text-xs text-gray-500">
                          Order #{getShortOrderNumber(order.id)}
                        </div>
                      </div>
                    </div>

                    {/* Customer Info */}
                    {order.customer_name && (
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                          <User className="h-5 w-5 text-purple-600" />
                        </div>
                        <div>
                          <div className="text-sm font-medium text-gray-500">Customer</div>
                          <div className="text-lg font-semibold text-gray-900">
                            {order.customer_name}
                          </div>
                          {order.customer_phone && (
                            <div className="text-sm text-gray-600">
                              {order.customer_phone}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Total Amount */}
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                        <span className="text-sm font-bold text-emerald-600">£</span>
                      </div>
                      <div>
                        <div className="text-sm font-medium text-gray-500">Total</div>
                        <div className="text-2xl font-bold text-gray-900">
                          £{formatPrice(calculateOrderTotal({ total_amount: order.total_amount, items: order.items }))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Status Badges */}
                  <div className="flex items-center gap-3 mb-6">
                    <Badge className={`${getStatusColor(order.order_status)} text-sm font-semibold px-4 py-2 rounded-full`}>
                      {order.order_status.replace('_', ' ').toLowerCase()}
                    </Badge>
                    {order.payment_status && (
                      <Badge className={`${getPaymentStatusColor(order.payment_status)} text-sm font-semibold px-4 py-2 rounded-full`}>
                        {order.payment_status.toLowerCase()}
                      </Badge>
                    )}
                  </div>

                  {/* Order Items */}
                  <div className="space-y-4">
                    <h5 className="text-base font-semibold text-gray-700 flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-orange-500"></span>
                      Order Items ({order.items.length})
                    </h5>
                    <div className="grid gap-3">
                      {order.items.map((item, itemIndex) => (
                        <div key={itemIndex} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-100">
                          <div className="flex items-center gap-4">
                            <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center text-sm font-bold text-gray-600 border border-gray-200">
                              {item.quantity}
                            </div>
                            <span className="text-gray-900 font-medium text-base">{item.item_name}</span>
                          </div>
                          <span className="font-semibold text-gray-900 text-lg">£{(item.quantity * item.price).toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Action buttons for individual orders */}
                  {showActions && order.order_status !== 'COMPLETED' && (
                    <div className="flex items-center gap-3 mt-6 pt-4 border-t border-gray-200">
                      {order.order_status === 'PLACED' && (
                        <Button 
                          size="sm"
                          onClick={() => updateOrderStatus(order.id, 'IN_PREP')}
                          className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-2 rounded-lg text-sm"
                        >
                          Start Preparing
                        </Button>
                      )}
                      {order.order_status === 'IN_PREP' && (
                        <Button 
                          size="sm"
                          onClick={() => updateOrderStatus(order.id, 'READY')}
                          className="bg-green-600 hover:bg-green-700 text-white font-semibold px-6 py-2 rounded-lg text-sm"
                        >
                          Mark Ready
                        </Button>
                      )}
                      {order.order_status === 'READY' && (
                        <Button 
                          size="sm"
                          onClick={() => updateOrderStatus(order.id, 'SERVING')}
                          className="bg-purple-600 hover:bg-purple-700 text-white font-semibold px-6 py-2 rounded-lg text-sm"
                        >
                          Mark Served
                        </Button>
                      )}
                      {order.order_status === 'SERVING' && (
                        <Button 
                          size="sm"
                          onClick={() => updateOrderStatus(order.id, 'COMPLETED')}
                          className="bg-gray-600 hover:bg-gray-700 text-white font-semibold px-6 py-2 rounded-lg text-sm"
                        >
                          Mark Complete
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
  {/* NavBar is rendered by the server component */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-center h-64">
            <div className="text-gray-500">Loading orders...</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 py-4 sm:py-6 lg:py-8">
        {/* Modern Header */}
        <section className="flex flex-col gap-3 sm:gap-4 mb-4 sm:mb-6">
          {/* Status row */}
          <div className="flex flex-col sm:flex-row sm:flex-wrap items-start sm:items-center gap-2 sm:gap-3 text-sm text-slate-600">
            <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-emerald-700 ring-1 ring-emerald-100 text-xs sm:text-sm">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" /> Real-time monitoring active
            </span>
            <div className="hidden sm:flex items-center gap-3 text-xs sm:text-sm">
              <span>• {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })} (today)</span>
              <span>• Current time: {new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>
            </div>

            <div className="flex items-center gap-2 sm:ml-auto">
              <label className="text-slate-500 text-xs sm:text-sm">Auto-refresh:</label>
              <select
                className="rounded-md border-slate-200 bg-white px-2 py-1 text-xs sm:text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-violet-200 min-h-[32px]"
                value={refreshInterval / 1000}
                onChange={(e) => changeRefreshInterval(Number(e.target.value))}
                disabled={!autoRefreshEnabled}
              >
                {[5,10,15,30,60].map(s => <option key={s} value={s}>{s}s</option>)}
              </select>

              {/* Switch */}
              <button
                onClick={toggleAutoRefresh}
                className={`
                  relative inline-flex h-6 w-10 sm:h-7 sm:w-12 items-center rounded-full transition min-h-[32px] min-w-[40px]
                  ${autoRefreshEnabled ? 'bg-violet-600' : 'bg-slate-200'}
                `}
                aria-pressed={autoRefreshEnabled}
              >
                <span
                  className={`
                    inline-block h-4 w-4 sm:h-5 sm:w-5 transform rounded-full bg-white shadow transition
                    ${autoRefreshEnabled ? 'translate-x-5 sm:translate-x-6' : 'translate-x-1'}
                  `}
                />
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex items-center justify-center gap-2 sm:gap-3 overflow-x-auto">
            <div className="inline-flex rounded-2xl bg-white p-1 shadow-sm ring-1 ring-slate-200 min-w-max">
              {[
                { key:'live',  label:'Live',    longLabel: 'Live Orders', hint:'Last 30 min', count: getDisplayCount('live') },
                { key:'all', label:'Earlier',  longLabel: 'Earlier Today', hint:"Today's orders", count: getDisplayCount('all') },
                { key:'history',  label:'History',  longLabel: 'History',      hint:'Previous days', count: getDisplayCount('history') },
              ].map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`
                    group relative grid grid-rows-[1fr_auto] rounded-xl px-3 py-2 sm:px-4 text-left transition min-w-[5rem] sm:w-[11rem]
                    ${activeTab === tab.key ? 'bg-violet-600 text-white' : 'text-slate-700 hover:bg-slate-50'}
                  `}
                >
                  <span className="flex items-center justify-between">
                    <span className="font-medium text-sm sm:text-base">
                      <span className="sm:hidden">{tab.label}</span>
                      <span className="hidden sm:inline">{tab.longLabel}</span>
                    </span>
                    <span className={`
                      ml-2 inline-flex min-w-[1.5rem] items-center justify-center rounded-full px-1.5 sm:px-2 text-xs
                      ${activeTab === tab.key ? 'bg-violet-500/70 text-white' : 'bg-slate-200 text-slate-700'}
                    `}>
                      {tab.count}
                    </span>
                  </span>
                  <span className={`
                    mt-0.5 text-xs hidden sm:block
                    ${activeTab === tab.key ? 'text-violet-100' : 'text-slate-400'}
                  `}>
                    {tab.hint}
                  </span>
                </button>
              ))}
            </div>
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


        {/* Content */}
        <main className="mt-4 space-y-4">

          {/* Content based on active tab */}
          {activeTab === 'live' && (
            <div className="space-y-6">
              {orders.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-10 text-center text-slate-500">
                  <Clock className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-slate-900 mb-2">No Live Orders</h3>
                  <p className="text-slate-500">Orders placed within the last 30 minutes will appear here</p>
                </div>
              ) : (
                <>
                  {/* Counter Orders */}
                  {orders.filter(order => isCounterOrder(order)).length > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-orange-500"></span>
                        Counter Orders ({orders.filter(order => isCounterOrder(order)).length})
                      </h3>
                      <div className="grid gap-3 sm:gap-4 grid-cols-1 lg:grid-cols-2 xl:grid-cols-3">
                        {orders.filter(order => isCounterOrder(order)).map((order) => renderOrderCard(order, true))}
                      </div>
                    </div>
                  )}
                  
                  {/* Table Orders */}
                  {(() => {
                    const activeTableOrders = orders.filter(order => 
                      !isCounterOrder(order) && ACTIVE_TABLE_ORDER_STATUSES.includes(order.order_status)
                    );
                    return activeTableOrders.length > 0 && (
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full bg-blue-500"></span>
                          Table Orders ({activeTableOrders.length})
                        </h3>
                        <div className="grid gap-3 sm:gap-4 grid-cols-1">
                          {(() => {
                            const tableGroups = groupOrdersByTable(activeTableOrders);
                            const groupedOrderIds = new Set();
                            
                            // Collect all order IDs that are in groups
                            Object.values(tableGroups).forEach(group => {
                              group.forEach(order => groupedOrderIds.add(order.id));
                            });
                            
                            // Find orders that couldn't be grouped (different customers, etc.)
                            const ungroupedOrders = activeTableOrders.filter(order => 
                              !groupedOrderIds.has(order.id)
                            );
                            
                            return (
                              <>
                                {/* Render grouped orders */}
                                {Object.entries(tableGroups).map(([tableNumber, tableOrdersList]) => 
                                  renderTableGroupCard(Number(tableNumber), tableOrdersList, true)
                                )}
                                
                                {/* Render ungrouped orders as individual cards */}
                                {ungroupedOrders.map(order => renderOrderCard(order, true))}
                              </>
                            );
                          })()}
                        </div>
                      </div>
                    );
                  })()}
                </>
              )}
            </div>
          )}

          {activeTab === 'all' && (
            <div className="space-y-6">
              {allTodayOrders.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-10 text-center text-slate-500">
                  <Clock className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-slate-900 mb-2">No Earlier Orders Today</h3>
                  <p className="text-slate-500">Orders from earlier today will appear here</p>
                </div>
              ) : (
                <>
                  {/* Counter Orders */}
                  {allTodayOrders.filter(order => isCounterOrder(order)).length > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-orange-500"></span>
                        Counter Orders ({allTodayOrders.filter(order => isCounterOrder(order)).length})
                      </h3>
                      <div className="grid gap-3 sm:gap-4 grid-cols-1 lg:grid-cols-2 xl:grid-cols-3">
                        {allTodayOrders.filter(order => isCounterOrder(order)).map((order) => renderOrderCard(order, true))}
                      </div>
                    </div>
                  )}
                  
                  {/* Table Orders */}
                  {(() => {
                    // Earlier Today should show ALL table orders from today (older than 30 mins)
                    // regardless of whether they are active or terminal statuses
                    const earlierTableOrders = allTodayOrders.filter(order => 
                      !isCounterOrder(order)
                    );
                    return earlierTableOrders.length > 0 && (
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full bg-blue-500"></span>
                          Table Orders ({earlierTableOrders.length})
                        </h3>
                        <div className="grid gap-3 sm:gap-4 grid-cols-1">
                          {(() => {
                            const tableGroups = groupOrdersByTable(earlierTableOrders);
                            const groupedOrderIds = new Set();
                            
                            // Collect all order IDs that are in groups
                            Object.values(tableGroups).forEach(group => {
                              group.forEach(order => groupedOrderIds.add(order.id));
                            });
                            
                            // Find orders that couldn't be grouped (different customers, etc.)
                            const ungroupedOrders = earlierTableOrders.filter(order => 
                              !groupedOrderIds.has(order.id)
                            );
                            
                            return (
                              <>
                                {/* Render grouped orders */}
                                {Object.entries(tableGroups).map(([tableNumber, tableOrdersList]) => 
                                  renderTableGroupCard(Number(tableNumber), tableOrdersList, true)
                                )}
                                
                                {/* Render ungrouped orders as individual cards */}
                                {ungroupedOrders.map(order => renderOrderCard(order, true))}
                              </>
                            );
                          })()}
                        </div>
                      </div>
                    );
                  })()}
                </>
              )}
            </div>
          )}

          {activeTab === 'history' && (
            <div className="space-y-6">
              {Object.keys(groupedHistoryOrders).length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-10 text-center text-slate-500">
                  <Clock className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-slate-900 mb-2">No Historical Orders</h3>
                  <p className="text-slate-500">Previous orders will appear here</p>
                </div>
              ) : (
                Object.entries(groupedHistoryOrders).map(([date, orders]) => (
                  <div key={date} className="space-y-4">
                    <div className="flex items-center space-x-2">
                      <h3 className="text-lg font-semibold text-slate-900">{date}</h3>
                      <span className="bg-slate-100 text-slate-600 text-xs px-2 py-1 rounded-full">{orders.length} orders</span>
                    </div>
                    
                    {/* Counter Orders for this date */}
                    {orders.filter(order => isCounterOrder(order)).length > 0 && (
                      <div className="space-y-3">
                        <h4 className="text-md font-medium text-gray-700 flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full bg-orange-500"></span>
                          Counter Orders ({orders.filter(order => isCounterOrder(order)).length})
                        </h4>
                        <div className="grid gap-3 sm:gap-4 grid-cols-1 lg:grid-cols-2 xl:grid-cols-3">
                          {orders.filter(order => isCounterOrder(order)).map((order) => renderOrderCard(order, false))}
                        </div>
                      </div>
                    )}
                    
                    {/* Table Orders for this date */}
                    {orders.filter(order => !isCounterOrder(order)).length > 0 && (
                      <div className="space-y-3">
                        <h4 className="text-md font-medium text-gray-700 flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full bg-blue-500"></span>
                          Table Orders ({orders.filter(order => !isCounterOrder(order)).length})
                        </h4>
                        <div className="grid gap-3 sm:gap-4 grid-cols-1">
                          {(() => {
                            const tableOrders = orders.filter(order => !isCounterOrder(order));
                            const tableGroups = groupOrdersByTable(tableOrders);
                            const groupedOrderIds = new Set();
                            
                            // Collect all order IDs that are in groups
                            Object.values(tableGroups).forEach(group => {
                              group.forEach(order => groupedOrderIds.add(order.id));
                            });
                            
                            // Find orders that couldn't be grouped (different customers, etc.)
                            const ungroupedOrders = tableOrders.filter(order => 
                              !groupedOrderIds.has(order.id)
                            );
                            
                            return (
                              <>
                                {/* Render grouped orders */}
                                {Object.entries(tableGroups).map(([tableNumber, tableOrdersList]) => 
                                  renderTableGroupCard(Number(tableNumber), tableOrdersList, false)
                                )}
                                
                                {/* Render ungrouped orders as individual cards */}
                                {ungroupedOrders.map(order => renderOrderCard(order, false))}
                              </>
                            );
                          })()}
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}