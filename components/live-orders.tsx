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
import type { AuthSession } from "@/lib/supabase";
import { logger } from "@/lib/logger";

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
  session: Session;
}

export function LiveOrders({ venueId, session }: LiveOrdersProps) {
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
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

  const ACTIVE_STATUSES = ['PLACED', 'ACCEPTED', 'IN_PREP', 'READY', 'OUT_FOR_DELIVERY', 'SERVING'];
  const TERMINAL_STATUSES = ['COMPLETED', 'CANCELLED', 'REFUNDED', 'EXPIRED'];

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
      logger.info("LIVE_ORDERS: Auto-refreshing orders");
      fetchOrders();
    }, refreshInterval);

    return () => {
      if (autoRefreshRef.current) {
        clearInterval(autoRefreshRef.current);
        autoRefreshRef.current = null;
      }
    };
  }, [autoRefreshEnabled, refreshInterval, fetchOrders]);

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

        logger.info("LIVE_ORDERS: Testing dashboard_counts function");
        
        const { data: countsData, error: countsError } = await supabase
          .rpc('dashboard_counts', { 
            p_venue_id: venueId, 
            p_tz: 'Europe/London', 
            p_live_window_mins: 30 
          })
          .single();
        
        if (countsError) {
          logger.error("LIVE_ORDERS: dashboard_counts function test failed", { 
            error: countsError.message, 
            code: countsError.code 
          });
        } else {
          logger.info("LIVE_ORDERS: dashboard_counts function test successful", countsData);
        }
      } catch (error) {
        logger.error("LIVE_ORDERS: dashboard_counts function test exception", error);
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

        logger.info("LIVE_ORDERS: Testing basic database connectivity");
        
        // Test 1: Check if we can connect to orders table
        const { data: ordersTest, error: ordersError } = await supabase
          .from("orders")
          .select("id, venue_id, order_status")
          .limit(5);
        
        if (ordersError) {
          logger.error("LIVE_ORDERS: Orders table test failed", { error: ordersError.message, code: ordersError.code });
        } else {
          logger.info("LIVE_ORDERS: Orders table test successful", { 
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
          logger.error("LIVE_ORDERS: Venues table test failed", { error: venuesError.message, code: venuesError.code });
        } else {
          logger.info("LIVE_ORDERS: Venues table test successful", { 
            count: venuesTest?.length || 0,
            sample: venuesTest?.slice(0, 2) || []
          });
        }

      } catch (error) {
        logger.error("LIVE_ORDERS: Database debug test exception", error);
      }
    };

    debugDatabase();
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

  const fetchLiveOrders = useCallback(async () => {
    const supabase = createClient();
    
    logger.info("LIVE_ORDERS: Fetching live orders", { venueId });

    setLoading(true);
    setError(null);

    if (!supabase) {
      logger.error("LIVE_ORDERS: Supabase not configured");
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
        logger.error("LIVE_ORDERS: Supabase connection test failed", { error: testError.message, code: testError.code });
        setError(`Database connection failed: ${testError.message}`);
        setLoading(false);
        return;
      }
      
      logger.info("LIVE_ORDERS: Supabase connection test successful");
    } catch (testErr: any) {
      logger.error("LIVE_ORDERS: Supabase connection test exception", testErr);
      setError(`Database connection failed: ${testErr.message}`);
      setLoading(false);
      return;
    }

    try {
      // Get orders that are either active OR completed within the last 30 minutes
      const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();

      logger.info("LIVE_ORDERS: Querying orders with filter", { 
        venueId, 
        thirtyMinutesAgo,
        activeStatuses: ACTIVE_STATUSES 
      });

      const { data: ordersData, error: ordersError } = await supabase
        .from("orders")
        .select("*")
        .eq("venue_id", venueId)
        .or(`order_status.in.(${ACTIVE_STATUSES.join(',')}),and(order_status.eq.COMPLETED,created_at.gte.${thirtyMinutesAgo})`)
        .order("updated_at", { ascending: false });

      if (ordersError) {
        logger.error("LIVE_ORDERS: Failed to fetch live orders", { error: ordersError.message, code: ordersError.code });
        
        // Check if it's a 503 service unavailable error
        if (ordersError.message.includes('503') || ordersError.message.includes('Service Unavailable')) {
          setServiceStatus('down');
          // Reduce retry frequency for service issues
          setRefreshInterval(60000); // 1 minute instead of 15 seconds
        } else {
          setServiceStatus('degraded');
        }
        
        setError(`Failed to load orders: ${ordersError.message}`);
      } else {
        logger.info("LIVE_ORDERS: Live orders fetched successfully", {
          orderCount: ordersData?.length || 0,
          statuses: ordersData?.map((order) => order.order_status) || [],
          firstOrder: ordersData?.[0] ? { id: ordersData[0].id, status: ordersData[0].order_status } : null
        });
        setOrders((ordersData || []) as OrderWithItems[]);
        setLastUpdate(new Date());
      }
    } catch (error: any) {
      logger.error("LIVE_ORDERS: Unexpected error fetching live orders", error);
      setError(`An unexpected error occurred: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }, [venueId]);

  const fetchTodayOrders = useCallback(async () => {
    const supabase = createClient();
    
    logger.info("LIVE_ORDERS: Fetching today's orders", { venueId });

    setLoading(true);
    setError(null);

    if (!supabase) {
      logger.error("LIVE_ORDERS: Supabase not configured");
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

      const { data: ordersData, error: ordersError } = await supabase
        .from("orders")
        .select("*")
        .eq("venue_id", venueId)
        .gte("created_at", today.toISOString())
        .lt("created_at", tomorrow.toISOString())
        .order("created_at", { ascending: false });

      if (ordersError) {
        logger.error("LIVE_ORDERS: Failed to fetch today's orders", { error: ordersError.message });
        setError("Failed to load orders.");
      } else {
        logger.info("LIVE_ORDERS: Today's orders fetched successfully", {
          orderCount: ordersData?.length || 0,
        });
        setOrders((ordersData || []) as OrderWithItems[]);
        setLastUpdate(new Date());
      }
    } catch (error: any) {
      logger.error("LIVE_ORDERS: Unexpected error fetching today's orders", error);
      setError("An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  }, [venueId]);

  const fetchHistoryOrders = useCallback(async () => {
    const supabase = createClient();
    
    logger.info("LIVE_ORDERS: Fetching historical orders", { venueId });

    setLoading(true);
    setError(null);

    if (!supabase) {
      logger.error("LIVE_ORDERS: Supabase not configured");
      setError("Service is not configured.");
      setLoading(false);
      return;
    }

    try {
      // Get today's start for comparison
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { data: ordersData, error: ordersError } = await supabase
        .from("orders")
        .select("*")
        .eq("venue_id", venueId)
        .in("order_status", TERMINAL_STATUSES)
        .lt("created_at", today.toISOString())
        .order("created_at", { ascending: false });

      if (ordersError) {
        logger.error("LIVE_ORDERS: Failed to fetch historical orders", { error: ordersError.message });
        setError("Failed to load orders.");
      } else {
        logger.info("LIVE_ORDERS: Historical orders fetched successfully", {
          orderCount: ordersData?.length || 0,
        });
        setOrders((ordersData || []) as OrderWithItems[]);
        setLastUpdate(new Date());
      }
    } catch (error: any) {
      logger.error("LIVE_ORDERS: Unexpected error fetching historical orders", error);
      setError("An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  }, [venueId]);

  const fetchOrders = useCallback(async () => {
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
  }, [activeTab, fetchLiveOrders, fetchTodayOrders, fetchHistoryOrders]);

  useEffect(() => {
    fetchOrders();
  }, [activeTab, fetchOrders]);

  useEffect(() => {
    const supabase = createClient();
    if (!supabase) return;

    logger.debug("LIVE_ORDERS: Setting up real-time subscription");
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
          logger.info(
            "LIVE_ORDERS: Real-time change detected, refetching orders",
            payload,
          );
          // Refetch for all tabs to keep counts accurate
          fetchOrders();
        },
      )
      .subscribe((status: any) => {
        logger.debug("LIVE_ORDERS: Real-time subscription status", { status });
      });

    return () => {
      logger.debug("LIVE_ORDERS: Cleaning up real-time subscription");
      if (supabase) {
        createClient().removeChannel(channel);
      }
    };
  }, [fetchOrders, venueId]);

  const updateOrderStatus = async (orderId: string, newOrderStatus: string) => {
    logger.info("LIVE_ORDERS: Updating order status", { orderId, newOrderStatus });

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
        logger.error("LIVE_ORDERS: Failed to update order status", {
          orderId,
          newOrderStatus,
          error: error.message,
          code: error.code,
        });
        setError(`Failed to update order: ${error.message}`);
        // Revert optimistic update on error
        fetchOrders();
      } else {
        logger.info("LIVE_ORDERS: Order status updated successfully", {
          orderId,
          newOrderStatus,
        });
        // Real-time subscription will handle the UI update
      }
    } catch (error: any) {
      logger.error(
        "LIVE_ORDERS: Unexpected error updating order status",
        error,
      );
      setError("An unexpected error occurred.");
      // Revert optimistic update on error
      fetchOrders();
    } finally {
      setUpdating(null);
    }
  };

  // Get badge counts for each tab
  const getLiveOrdersCount = () => {
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
    
    return orders.filter(order => {
      // Count active orders
      if (ACTIVE_STATUSES.includes(order.order_status)) {
        return true;
      }
      
      // Count completed orders from the last 30 minutes
      if (order.order_status === 'COMPLETED') {
        const orderCreatedAt = new Date(order.created_at);
        return orderCreatedAt >= thirtyMinutesAgo;
      }
      
      return false;
    }).length;
  };

  const getTodayOrdersCount = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
    
    return orders.filter(order => {
      const orderDate = new Date(order.created_at);
      const scheduledDate = order.scheduled_for ? new Date(order.scheduled_for) : null;
      const isTodayOrder = (orderDate >= today && orderDate < tomorrow) || 
                          (scheduledDate && scheduledDate >= today && scheduledDate < tomorrow);
      
      // For completed orders, only count them in today if they're older than 30 minutes
      if (order.order_status === 'COMPLETED') {
        const orderCreatedAt = new Date(order.created_at);
        // Only count in today if it's older than 30 minutes (otherwise it stays in live)
        return isTodayOrder && orderCreatedAt < thirtyMinutesAgo;
      }
      
      // For other terminal statuses, count them in today
      if (TERMINAL_STATUSES.includes(order.order_status)) {
        return isTodayOrder;
      }
      
      // For active orders, count them in today
      return isTodayOrder;
    }).length;
  };

  const getHistoryOrdersCount = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
    
    return orders.filter(order => {
      // Only count terminal status orders
      if (!TERMINAL_STATUSES.includes(order.order_status)) {
        return false;
      }
      
      const orderCreatedAt = new Date(order.created_at);
      
      // For completed orders, only count them in history if they're older than 30 minutes
      if (order.order_status === 'COMPLETED') {
        return orderCreatedAt < thirtyMinutesAgo && orderCreatedAt < today;
      }
      
      // For other terminal statuses, count them in history if they're from previous days
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
                    fetchOrders();
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
                      fetchOrders();
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
