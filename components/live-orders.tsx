"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  RefreshCw,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Wifi,
  WifiOff,
  Bell,
} from "lucide-react";
import { Session } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

const hasSupabaseConfig = !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

// Add OrderWithItems type locally since it's not exported from supabase
interface OrderWithItems {
  id: string;
  venue_id: string;
  table_number: number;
  customer_name: string;
  customer_phone?: string;
  customer_email?: string;
  order_status: string;
  total_amount: number;
  notes?: string;
  payment_method?: string;
  payment_status?: string;
  scheduled_for?: string;
  prep_lead_minutes?: number;
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

interface LiveOrdersProps {
  venueId: string; // This is the text-based slug
  session?: Session; // Make session optional since it's not used
}

export function LiveOrders({ venueId, session }: LiveOrdersProps) {
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [allOrders, setAllOrders] = useState<OrderWithItems[]>([]); // New state for all orders
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'live' | 'today' | 'history'>('live');
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [isOnline, setIsOnline] = useState(true);
  const [hasNewOrders, setHasNewOrders] = useState(false);
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(15000); // 15 seconds
  const [showDemoOrders, setShowDemoOrders] = useState(false);
  const [serviceStatus, setServiceStatus] = useState<'healthy' | 'degraded' | 'down'>('healthy');
  const autoRefreshRef = useRef<NodeJS.Timeout | null>(null);
  const lastOrderCountRef = useRef<number>(0);

  // Demo orders for when database is unavailable
  const demoOrders: OrderWithItems[] = [
    {
      id: 'demo-1',
      venue_id: venueId,
      table_number: 5,
      customer_name: 'John Smith',
      customer_phone: '+44 123 456 7890',
      customer_email: 'john@example.com',
      order_status: 'PLACED',
      total_amount: 24.50,
      notes: 'Extra crispy fries please',
      payment_method: 'card',
      payment_status: 'pending',
      scheduled_for: null,
      prep_lead_minutes: 15,
      items: [
        { menu_item_id: 'demo-item-1', quantity: 1, price: 14.50, item_name: 'Beef Burger' },
        { menu_item_id: 'demo-item-2', quantity: 1, price: 4.50, item_name: 'French Fries' },
        { menu_item_id: 'demo-item-3', quantity: 1, price: 5.50, item_name: 'Coca Cola' }
      ],
      created_at: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
      updated_at: new Date(Date.now() - 5 * 60 * 1000).toISOString()
    },
    {
      id: 'demo-2',
      venue_id: venueId,
      table_number: 3,
      customer_name: 'Sarah Johnson',
      customer_phone: '+44 987 654 3210',
      customer_email: 'sarah@example.com',
      order_status: 'IN_PREP',
      total_amount: 18.75,
      notes: 'No onions please',
      payment_method: 'card',
      payment_status: 'pending',
      scheduled_for: null,
      prep_lead_minutes: 20,
      items: [
        { menu_item_id: 'demo-item-4', quantity: 1, price: 18.75, item_name: 'Grilled Salmon' }
      ],
      created_at: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
      updated_at: new Date(Date.now() - 2 * 60 * 1000).toISOString()
    }
  ];

  const ACTIVE_STATUSES = ['PLACED', 'ACCEPTED', 'IN_PREP', 'READY', 'OUT_FOR_DELIVERY'];
  const TERMINAL_STATUSES = ['SERVING', 'COMPLETED', 'CANCELLED', 'REFUNDED', 'EXPIRED'];

  // Define fetch functions first to avoid circular dependencies
  const fetchLiveOrders = useCallback(async () => {
    const supabase = createClient();
    
    console.log("LIVE_ORDERS: Fetching live orders", { venueId });

    setLoading(true);
    setError(null);

    if (!supabase) {
      console.error("LIVE_ORDERS: Supabase not configured");
      setError("Service is not configured.");
      setLoading(false);
      return;
    }

    // Test Supabase connection
    try {
      const { data: testData, error: testError } = await supabase
        .from("orders")
        .select("id")
        .limit(1);
      
      if (testError) {
        console.error("LIVE_ORDERS: Supabase connection test failed", { error: testError.message, code: testError.code });
        setError(`Database connection failed: ${testError.message}`);
        setLoading(false);
        return;
      }
      
      console.log("LIVE_ORDERS: Supabase connection test successful");
    } catch (testErr: any) {
      console.error("LIVE_ORDERS: Supabase connection test exception", testErr);
      setError(`Database connection failed: ${testErr.message}`);
      setLoading(false);
      return;
    }

    try {
      // Get orders that are either active OR completed within the last 30 minutes
      const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();

      console.log("LIVE_ORDERS: Querying orders with filter", { 
        venueId, 
        thirtyMinutesAgo,
        activeStatuses: ACTIVE_STATUSES 
      });

      // First, let's get ALL orders for this venue to see what we're working with
      const { data: allVenueOrders, error: allOrdersError } = await supabase
        .from("orders")
        .select("*")
        .eq("venue_id", venueId)
        .order("created_at", { ascending: false })
        .throwOnError();

      if (allOrdersError) {
        console.error("LIVE_ORDERS: Failed to fetch all venue orders", { error: allOrdersError.message });
        setError(`Failed to load orders: ${allOrdersError.message}`);
        setLoading(false);
        return;
      }

      console.log("LIVE_ORDERS: All venue orders fetched", {
        totalCount: allVenueOrders?.length || 0,
        statuses: allVenueOrders?.map(order => ({ 
          id: order.id, 
          status: order.order_status, 
          created: order.created_at,
          age: Math.round((Date.now() - new Date(order.created_at).getTime()) / (1000 * 60 * 60 * 24)) + ' days ago'
        })) || []
      });

      // Now filter for live orders
      const liveOrders = allVenueOrders?.filter(order => {
        const orderCreatedAt = new Date(order.created_at);
        
        // Only include ACTIVE orders in live tab (not completed ones)
        const isActive = ACTIVE_STATUSES.includes(order.order_status) && 
                        orderCreatedAt >= new Date(thirtyMinutesAgo);
        
        // Don't include completed orders in live tab - they should only be in "Earlier Today"
        // This fixes the issue where orders appear in both tabs
        
        if (isActive) {
          console.log("LIVE_ORDERS: Order included in live tab", {
            id: order.id,
            status: order.order_status,
            created: order.created_at,
            age: Math.round((Date.now() - orderCreatedAt.getTime()) / (1000 * 60 * 60 * 24)) + ' days ago',
            reason: 'active status within 30 minutes'
          });
        }
        
        return isActive; // Only return active orders, not completed ones
      }) || [];

      console.log("LIVE_ORDERS: Live orders filtering results", {
        totalOrders: allVenueOrders?.length || 0,
        liveOrdersCount: liveOrders.length,
        activeOrdersCount: liveOrders.filter(o => ACTIVE_STATUSES.includes(o.order_status)).length,
        recentCompletedCount: liveOrders.filter(o => o.order_status === 'COMPLETED').length,
        liveOrders: liveOrders.map(o => ({
          id: o.id,
          status: o.order_status,
          created: o.created_at,
          age: Math.round((Date.now() - new Date(o.created_at).getTime()) / (1000 * 60 * 60 * 24)) + ' days ago'
        }))
      });

      setOrders(liveOrders as OrderWithItems[]);
      setLastUpdate(new Date());
      
      console.log("LIVE_ORDERS: Live orders set successfully", {
        liveOrdersCount: liveOrders.length,
        expectedCount: 0 // Based on your requirement
      });

    } catch (error: any) {
      console.error("LIVE_ORDERS: Unexpected error fetching live orders", error);
      setError(`An unexpected error occurred: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }, [venueId]);

  const fetchTodayOrders = useCallback(async () => {
    const supabase = createClient();
    
    console.log("LIVE_ORDERS: Fetching today's orders", { venueId });

    setLoading(true);
    setError(null);

    if (!supabase) {
      console.error("LIVE_ORDERS: Supabase not configured");
      setError("Service is not configured.");
      setLoading(false);
      return;
    }

    try {
      // Get today's business date bounds (UTC)
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      console.log("LIVE_ORDERS: Today's date range", {
        today: today.toISOString(),
        tomorrow: tomorrow.toISOString()
      });

      const { data: ordersData, error: ordersError } = await supabase
        .from("orders")
        .select("*")
        .eq("venue_id", venueId)
        .gte("created_at", today.toISOString())
        .lt("created_at", tomorrow.toISOString())
        .order("created_at", { ascending: false })
        .throwOnError();

      if (ordersError) {
        console.error("LIVE_ORDERS: Failed to fetch today's orders", { error: ordersError.message });
        setError("Failed to load orders.");
      } else {
        console.log("LIVE_ORDERS: Today's orders fetched successfully", {
          orderCount: ordersData?.length || 0,
          orders: ordersData?.map(o => ({
            id: o.id,
            status: o.order_status,
            created: o.created_at,
            age: Math.round((Date.now() - new Date(o.created_at).getTime()) / (1000 * 60 * 60 * 24)) + ' days ago'
          })) || []
        });
        setOrders((ordersData || []) as OrderWithItems[]);
        setLastUpdate(new Date());
      }
    } catch (error: any) {
      console.error("LIVE_ORDERS: Unexpected error fetching today's orders", error);
      setError("An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  }, [venueId]);

  const fetchHistoryOrders = useCallback(async () => {
    const supabase = createClient();
    
    console.log("LIVE_ORDERS: Fetching historical orders", { venueId });

    setLoading(true);
    setError(null);

    if (!supabase) {
      console.error("LIVE_ORDERS: Supabase not configured");
      setError("Service is not configured.");
      setLoading(false);
      return;
    }

    try {
      // Get today's start for comparison
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      console.log("LIVE_ORDERS: History date threshold", {
        today: today.toISOString()
      });

      const { data: ordersData, error: ordersError } = await supabase
        .from("orders")
        .select("*")
        .eq("venue_id", venueId)
        .lt("created_at", today.toISOString())
        .order("created_at", { ascending: false })
        .throwOnError();

      if (ordersError) {
        console.error("LIVE_ORDERS: Failed to fetch historical orders", { error: ordersError.message });
        setError("Failed to load orders.");
      } else {
        console.log("LIVE_ORDERS: Historical orders fetched successfully", {
          orderCount: ordersData?.length || 0,
          orders: ordersData?.map(o => ({
            id: o.id,
            status: o.order_status,
            created: o.created_at,
            age: Math.round((Date.now() - new Date(o.created_at).getTime()) / (1000 * 60 * 60 * 24)) + ' days ago'
          })) || []
        });
        setOrders((ordersData || []) as OrderWithItems[]);
        setLastUpdate(new Date());
      }
    } catch (error: any) {
      console.error("LIVE_ORDERS: Unexpected error fetching historical orders", error);
      setError("An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  }, [venueId]);

  // New function to fetch ALL orders for counting purposes
  const fetchAllOrders = useCallback(async () => {
    const supabase = createClient();
    
    if (!supabase) return;

    try {
      console.log("LIVE_ORDERS: Fetching all orders for counting");
      
      const { data: allOrdersData, error: allOrdersError } = await supabase
        .from("orders")
        .select("*")
        .eq("venue_id", venueId)
        .order("created_at", { ascending: false })
        .throwOnError();

      if (!allOrdersError && allOrdersData) {
        setAllOrders(allOrdersData as OrderWithItems[]);
        
        // Log detailed breakdown for counting
        const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const liveCount = allOrdersData.filter(order => {
          const orderCreatedAt = new Date(order.created_at);
          const isActive = ACTIVE_STATUSES.includes(order.order_status) && 
                          orderCreatedAt >= thirtyMinutesAgo;
          const isRecentCompleted = order.order_status === 'COMPLETED' && 
                                  orderCreatedAt >= thirtyMinutesAgo;
          return isActive || isRecentCompleted;
        }).length;
        
        const todayCount = allOrdersData.filter(order => {
          const orderDate = new Date(order.created_at);
          return orderDate >= today;
        }).length;
        
        const historyCount = allOrdersData.filter(order => {
          const orderDate = new Date(order.created_at);
          return orderDate < today;
        }).length;
        
        console.log("LIVE_ORDERS: All orders fetched for counting", { 
          totalCount: allOrdersData.length,
          breakdown: {
            live: liveCount,
            today: todayCount,
            history: historyCount
          },
          statusBreakdown: allOrdersData.reduce((acc, order) => {
            acc[order.order_status] = (acc[order.order_status] || 0) + 1;
            return acc;
          }, {} as Record<string, number>),
          ageBreakdown: allOrdersData.reduce((acc, order) => {
            const age = Math.round((Date.now() - new Date(order.created_at).getTime()) / (1000 * 60 * 60 * 24));
            if (age === 0) acc['today'] = (acc['today'] || 0) + 1;
            else if (age === 1) acc['yesterday'] = (acc['yesterday'] || 0) + 1;
            else if (age <= 7) acc['this week'] = (acc['this week'] || 0) + 1;
            else if (age <= 30) acc['this month'] = (acc['this month'] || 0) + 1;
            else acc['older'] = (acc['older'] || 0) + 1;
            return acc;
          }, {} as Record<string, number>)
        });
      }
    } catch (error) {
      console.error("LIVE_ORDERS: Failed to fetch all orders for counting", error);
    }
  }, [venueId]);

  const fetchOrders = useCallback(async () => {
    // Add timeout to prevent infinite loading
    const timeoutId = setTimeout(() => {
      console.error("LIVE_ORDERS: Query timeout - taking too long to load orders");
      setError("Query timeout - taking too long to load orders");
      setLoading(false);
    }, 10000); // 10 second timeout

    try {
      switch (activeTab) {
        case 'live':
          await fetchLiveOrders();
          break;
        case 'today':
          await fetchTodayOrders();
          break;
        case 'history':
          await fetchHistoryOrders();
          break;
      }
      
      // Always fetch all orders for accurate counting
      await fetchAllOrders();
    } finally {
      clearTimeout(timeoutId);
    }
  }, [activeTab, fetchLiveOrders, fetchTodayOrders, fetchHistoryOrders, fetchAllOrders]);

  // Store fetchOrders in a ref to avoid circular dependencies
  const fetchOrdersRef = useRef(fetchOrders);
  fetchOrdersRef.current = fetchOrders;

  // Network status monitoring
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Auto-refresh functionality
  useEffect(() => {
    if (!autoRefreshEnabled) {
      if (autoRefreshRef.current) {
        clearInterval(autoRefreshRef.current);
        autoRefreshRef.current = null;
      }
      return;
    }

    autoRefreshRef.current = setInterval(() => {
      console.log("LIVE_ORDERS: Auto-refreshing orders");
      fetchOrdersRef.current();
    }, refreshInterval);

    return () => {
      if (autoRefreshRef.current) {
        clearInterval(autoRefreshRef.current);
        autoRefreshRef.current = null;
      }
    };
  }, [autoRefreshEnabled, refreshInterval]);

  // Check for new orders
  useEffect(() => {
    if (orders.length > lastOrderCountRef.current && lastOrderCountRef.current > 0) {
      setHasNewOrders(true);
      // Auto-clear notification after 5 seconds
      setTimeout(() => setHasNewOrders(false), 5000);
    }
    lastOrderCountRef.current = orders.length;
  }, [orders.length]);

  // Test dashboard counts function
  useEffect(() => {
    const testDashboardCounts = async () => {
      try {
        const supabase = createClient();
        if (!supabase) return;

        console.log("LIVE_ORDERS: Testing dashboard_counts function");
        
        const { data: countsData, error: countsError } = await supabase
          .rpc('dashboard_counts', { 
            p_venue_id: venueId, 
            p_tz: 'Europe/London', 
            p_live_window_mins: 30 
          })
          .single();
        
        if (countsError) {
          console.error("LIVE_ORDERS: dashboard_counts function test failed", { 
            error: countsError.message, 
            code: countsError.code 
          });
        } else {
          console.log("LIVE_ORDERS: dashboard_counts function test successful", countsData);
        }
      } catch (error) {
        console.error("LIVE_ORDERS: dashboard_counts function test exception", error);
      }
    };

    testDashboardCounts();
  }, [venueId]);

  // Debug function to test basic database connectivity
  useEffect(() => {
    const debugDatabase = async () => {
      try {
        const supabase = createClient();
        if (!supabase) return;

        console.log("LIVE_ORDERS: Testing basic database connectivity");
        
        // Test 1: Check if we can connect to orders table
        const { data: ordersTest, error: ordersError } = await supabase
          .from("orders")
          .select("id, venue_id, order_status")
          .limit(5);
        
        if (ordersError) {
          console.error("LIVE_ORDERS: Orders table test failed", { error: ordersError.message, code: ordersError.code });
        } else {
          console.log("LIVE_ORDERS: Orders table test successful", { 
            count: ordersTest?.length || 0,
            sample: ordersTest?.slice(0, 2) || []
          });
        }

        // Test 2: Check if we can connect to venues table
        const { data: venuesTest, error: venuesError } = await supabase
          .from("venues")
          .select("venue_id, name")
          .limit(5);
        
        if (venuesError) {
          console.error("LIVE_ORDERS: Venues table test failed", { error: venuesError.message, code: venuesError.code });
        } else {
          console.log("LIVE_ORDERS: Venues table test successful", { 
            count: venuesTest?.length || 0,
            sample: venuesTest?.slice(0, 2) || []
          });
        }

      } catch (error) {
        console.error("LIVE_ORDERS: Database debug test exception", error);
      }
    };

    debugDatabase();
  }, [venueId]);

  // Initial fetch and tab change handling
  useEffect(() => {
    fetchOrders();
  }, [activeTab, fetchOrders]);

  // Real-time subscription
  useEffect(() => {
    const supabase = createClient();
    if (!supabase) return;

    console.log("LIVE_ORDERS: Setting up real-time subscription");
    const channel = supabase
      .channel(`live-orders-${venueId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
          filter: `venue_id=eq.${venueId}`,
        },
        (payload: any) => {
          console.log(
            "LIVE_ORDERS: Real-time change detected, refetching orders",
            payload,
          );
          // Refetch for all tabs to keep counts accurate
          fetchOrdersRef.current();
        },
      )
      .subscribe((status: any) => {
        console.log("LIVE_ORDERS: Real-time subscription status", { status });
      });

    return () => {
      console.log("LIVE_ORDERS: Cleaning up real-time subscription");
      if (supabase) {
        createClient().removeChannel(channel);
      }
    };
  }, [venueId]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'PLACED':
        return <Clock className="h-3 w-3" />;
      case 'ACCEPTED':
        return <CheckCircle className="h-3 w-3" />;
      case 'IN_PREP':
        return <RefreshCw className="h-3 w-3" />;
      case 'READY':
        return <CheckCircle className="h-3 w-3" />;
      case 'OUT_FOR_DELIVERY':
        return <Clock className="h-3 w-3" />;
      case 'SERVING':
        return <CheckCircle className="h-3 w-3" />;
      case 'COMPLETED':
        return <CheckCircle className="h-3 w-3" />;
      case 'CANCELLED':
        return <XCircle className="h-3 w-3" />;
      case 'REFUNDED':
        return <XCircle className="h-3 w-3" />;
      case 'EXPIRED':
        return <AlertTriangle className="h-3 w-3" />;
      default:
        return <Clock className="h-3 w-3" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PLACED':
        return 'bg-yellow-100 text-yellow-800';
      case 'ACCEPTED':
        return 'bg-blue-100 text-blue-800';
      case 'IN_PREP':
        return 'bg-orange-100 text-orange-800';
      case 'READY':
        return 'bg-green-100 text-green-800';
      case 'OUT_FOR_DELIVERY':
        return 'bg-purple-100 text-purple-800';
      case 'SERVING':
        return 'bg-green-100 text-green-800';
      case 'COMPLETED':
        return 'bg-green-100 text-green-800';
      case 'CANCELLED':
        return 'bg-red-100 text-red-800';
      case 'REFUNDED':
        return 'bg-red-100 text-red-800';
      case 'EXPIRED':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const updateOrderStatus = async (orderId: string, newOrderStatus: string) => {
    console.log("LIVE_ORDERS: Updating order status", { orderId, newOrderStatus });

    const supabase = createClient();
    if (!supabase) return;

    setUpdating(orderId);

    // Optimistic update
    setOrders(prevOrders => 
      prevOrders.map(order => 
        order.id === orderId 
          ? { ...order, order_status: newOrderStatus, updated_at: new Date().toISOString() }
          : order
      )
    );

    try {
      const { error } = await supabase
        .from("orders")
        .update({ order_status: newOrderStatus })
        .eq("id", orderId);

      if (error) {
        console.error("LIVE_ORDERS: Failed to update order status", {
          orderId,
          newOrderStatus,
          error: error.message,
          code: error.code,
        });
        setError(`Failed to update order: ${error.message}`);
        // Revert optimistic update on error
        fetchOrdersRef.current();
      } else {
        console.log("LIVE_ORDERS: Order status updated successfully", {
          orderId,
          newOrderStatus,
        });
        // Real-time subscription will handle the UI update
      }
    } catch (error: any) {
      console.error(
        "LIVE_ORDERS: Unexpected error updating order status",
        error,
      );
      setError("An unexpected error occurred.");
      // Revert optimistic update on error
      fetchOrdersRef.current();
    } finally {
      setUpdating(null);
    }
  };

  // Get badge counts for each tab - FIXED LOGIC using allOrders
  const getLiveOrdersCount = () => {
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
    
    return allOrders.filter(order => {
      const orderCreatedAt = new Date(order.created_at);
      
      // Count only truly active orders within the last 30 minutes
      // Don't count completed orders in live tab - they belong in "Earlier Today"
      if (ACTIVE_STATUSES.includes(order.order_status)) {
        return orderCreatedAt >= thirtyMinutesAgo;
      }
      
      // Remove this logic - completed orders should not be counted in live orders
      // if (order.order_status === 'COMPLETED') {
      //   return orderCreatedAt >= thirtyMinutesAgo;
      // }
      
      return false;
    }).length;
  };

  const getTodayOrdersCount = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    return allOrders.filter(order => {
      const orderDate = new Date(order.created_at);
      const scheduledDate = order.scheduled_for ? new Date(order.scheduled_for) : null;
      const isTodayOrder = (orderDate >= today && orderDate < tomorrow) || 
                          (scheduledDate && scheduledDate >= today && scheduledDate < tomorrow);
      
      // Count all orders from today, regardless of status
      return isTodayOrder;
    }).length;
  };

  const getHistoryOrdersCount = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    return allOrders.filter(order => {
      const orderCreatedAt = new Date(order.created_at);
      return orderCreatedAt < today;
    }).length;
  };

  const toggleAutoRefresh = () => {
    setAutoRefreshEnabled(!autoRefreshEnabled);
  };

  const changeRefreshInterval = (interval: number) => {
    setRefreshInterval(interval);
  };

  return (
    <div className="space-y-6">
      {!hasSupabaseConfig && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Service is not configured. Order management is disabled.
          </AlertDescription>
        </Alert>
      )}

      {/* Connection Status & Auto-refresh Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className={`flex items-center space-x-2 ${isOnline ? 'text-green-600' : 'text-red-600'}`}>
            {isOnline ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
            <span className="text-sm font-medium">
              {isOnline ? 'Connected' : 'Offline'}
            </span>
          </div>
          
          {/* Service Status Indicator */}
          <div className={`flex items-center space-x-2 ${
            serviceStatus === 'healthy' ? 'text-green-600' : 
            serviceStatus === 'degraded' ? 'text-yellow-600' : 'text-red-600'
          }`}>
            <div className={`w-2 h-2 rounded-full ${
              serviceStatus === 'healthy' ? 'bg-green-500' : 
              serviceStatus === 'degraded' ? 'bg-yellow-500' : 'bg-red-500'
            }`}></div>
            <span className="text-sm font-medium">
              {serviceStatus === 'healthy' ? 'Service Healthy' : 
               serviceStatus === 'degraded' ? 'Service Degraded' : 'Service Down'}
            </span>
          </div>
          
          {hasNewOrders && (
            <div className="flex items-center space-x-2 text-orange-600 animate-pulse">
              <Bell className="h-4 w-4" />
              <span className="text-sm font-medium">New orders!</span>
            </div>
          )}
        </div>

        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-600">Auto-refresh:</span>
            <select
              value={refreshInterval / 1000}
              onChange={(e) => changeRefreshInterval(Number(e.target.value) * 1000)}
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
          

          
          <div className="text-xs text-gray-500">
            Last update: {lastUpdate.toLocaleTimeString()}
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            <span>Order Management</span>
          </CardTitle>
          
          {/* Tab Navigation */}
          <div className="flex space-x-1 border-b">
            <button
              onClick={() => setActiveTab('live')}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                activeTab === 'live'
                  ? 'bg-servio-purple text-white border-b-2 border-servio-purple'
                  : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
              }`}
            >
              Live (Last 30 Min)
              {getLiveOrdersCount() > 0 && (
                <span className="ml-2 bg-red-100 text-red-800 text-xs px-2 py-1 rounded-full">
                  {getLiveOrdersCount()}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('today')}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                activeTab === 'today'
                  ? 'bg-servio-purple text-white border-b-2 border-servio-purple'
                  : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
              }`}
            >
              Today (All Orders)
              {getTodayOrdersCount() > 0 && (
                <span className="ml-2 bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">
                  {getTodayOrdersCount()}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                activeTab === 'history'
                  ? 'bg-servio-purple text-white border-b-2 border-servio-purple'
                  : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
              }`}
            >
              History
              {getHistoryOrdersCount() > 0 && (
                <span className="ml-2 bg-gray-100 text-gray-800 text-xs px-2 py-1 rounded-full">
                  {getHistoryOrdersCount()}
                </span>
              )}
            </button>
          </div>

          {/* Tab Description */}
          <CardDescription>
            {activeTab === 'live' && "Orders currently requiring action (prep/serve/pay) and completed orders from the last 30 minutes."}
            {activeTab === 'today' && "All orders for today's business date."}
            {activeTab === 'history' && "Completed and cancelled orders from previous days."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {showDemoOrders && (
            <Alert className="mb-4">
              <AlertDescription className="flex items-center justify-between">
                <span>⚠️ Showing demo orders - Database connection unavailable</span>
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={() => {
                    setShowDemoOrders(false);
                    setOrders([]);
                    fetchOrdersRef.current();
                  }}
                  className="ml-2"
                >
                  <RefreshCw className="h-4 w-4 mr-1" />
                  Try Real Data
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription className="flex items-center justify-between">
                <span>
                  {error.includes('503') || error.includes('Service Unavailable') 
                    ? 'Database service temporarily unavailable. Please try again in a few minutes.'
                    : error
                  }
                </span>
                <div className="flex space-x-2">
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={() => {
                      setError(null);
                      fetchOrdersRef.current();
                    }}
                    className="ml-2"
                  >
                    <RefreshCw className="h-4 w-4 mr-1" />
                    Retry
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={() => {
                      setShowDemoOrders(true);
                      setOrders(demoOrders);
                      setError(null);
                    }}
                    className="ml-2"
                  >
                    Show Demo
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {loading ? (
            <div className="text-center py-8">
              <RefreshCw className="h-8 w-8 mx-auto text-gray-400 animate-spin mb-4" />
              <p className="text-gray-600">Loading orders...</p>
            </div>
          ) : orders.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-gray-400 mb-4">
                <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <p className="text-gray-600 mb-2 font-medium">No orders found</p>
              <p className="text-gray-500 text-sm mb-4">
                {activeTab === 'live' && "No active orders requiring attention at the moment."}
                {activeTab === 'today' && "No orders have been placed today yet."}
                {activeTab === 'history' && "No historical orders found."}
              </p>
              <div className="text-xs text-gray-400">
                <p>Venue ID: {venueId}</p>
                <p>Last checked: {lastUpdate.toLocaleTimeString()}</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4 max-h-96 overflow-y-auto">
              {orders.map((order: OrderWithItems) => (
                <div
                  key={order.id}
                  className={`border p-4 rounded-lg hover:bg-gray-50 transition-all duration-200 ${
                    updating === order.id ? 'ring-2 ring-blue-500 bg-blue-50' : ''
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      <h3 className="font-semibold text-lg">
                        Order #{order.id.slice(0, 8)}
                      </h3>
                      <Badge className={getStatusColor(order.order_status)}>
                        {getStatusIcon(order.order_status)}
                        <span className="ml-1 capitalize">{order.order_status.replace('_', ' ').toLowerCase()}</span>
                      </Badge>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-600">
                        Table {order.table_number}
                      </p>
                      <p className="text-lg font-bold text-green-600">
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
                      </p>
                    </div>
                  </div>

                  <div className="mb-3">
                    <p className="text-sm text-gray-600">
                      Customer: {order.customer_name}
                    </p>
                    <p className="text-sm text-gray-600">
                      Placed: {new Date(order.created_at).toLocaleString()}
                    </p>
                  </div>

                  {order.items && order.items.length > 0 && (
                    <div className="mb-4">
                      <h4 className="font-medium mb-2">Items:</h4>
                      <div className="space-y-1">
                        {order.items.map((item, index) => (
                          <div
                            key={index}
                            className="flex justify-between text-sm"
                          >
                            <span>
                              {item.quantity}x {item.item_name}
                            </span>
                            <span>
                              £{(item.price * item.quantity).toFixed(2)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex space-x-2">
                    {order.order_status === "PLACED" && (
                      <Button
                        size="sm"
                        onClick={() => updateOrderStatus(order.id, "IN_PREP")}
                        disabled={updating === order.id}
                      >
                        {updating === order.id ? (
                          <RefreshCw className="h-4 w-4 animate-spin" />
                        ) : (
                          "Start Preparing"
                        )}
                      </Button>
                    )}
                    {order.order_status === "IN_PREP" && (
                      <Button
                        size="sm"
                        onClick={() => updateOrderStatus(order.id, "READY")}
                        disabled={updating === order.id}
                      >
                        {updating === order.id ? (
                          <RefreshCw className="h-4 w-4 animate-spin" />
                        ) : (
                          "Mark Ready"
                        )}
                      </Button>
                    )}
                    {order.order_status === "READY" && (
                      <Button
                        size="sm"
                        onClick={() => updateOrderStatus(order.id, "SERVING")}
                        disabled={updating === order.id}
                      >
                        {updating === order.id ? (
                          <RefreshCw className="h-4 w-4 animate-spin" />
                        ) : (
                          "Mark as Served"
                        )}
                      </Button>
                    )}
                    {order.order_status === "SERVING" && (
                      <Button
                        size="sm"
                        onClick={() => updateOrderStatus(order.id, "COMPLETED")}
                        disabled={updating === order.id}
                      >
                        {updating === order.id ? (
                          <RefreshCw className="h-4 w-4 animate-spin" />
                        ) : (
                          "Complete Order"
                        )}
                      </Button>
                    )}
                    {(order.order_status === "PLACED" ||
                      order.order_status === "IN_PREP") && (
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => updateOrderStatus(order.id, "CANCELLED")}
                        disabled={updating === order.id}
                      >
                        {updating === order.id ? (
                          <RefreshCw className="h-4 w-4 animate-spin" />
                        ) : (
                          "Cancel"
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
