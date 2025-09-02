"use client";

import { useState, useEffect, useCallback } from "react";
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

  const ACTIVE_STATUSES = ['PLACED', 'ACCEPTED', 'IN_PREP', 'READY', 'OUT_FOR_DELIVERY', 'SERVING'];
  const TERMINAL_STATUSES = ['COMPLETED', 'CANCELLED', 'REFUNDED', 'EXPIRED'];

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

    try {
      // Get orders that are active and within prep window
      const prepLeadMs = 30 * 60 * 1000; // 30 minutes default
      const prepWindow = new Date(Date.now() + prepLeadMs).toISOString();

      const { data: ordersData, error: ordersError } = await supabase
        .from("orders")
        .select("*")
        .eq("venue_id", venueId)
        .in("order_status", ACTIVE_STATUSES)
        .order("updated_at", { ascending: false });

      if (ordersError) {
        logger.error("LIVE_ORDERS: Failed to fetch live orders", { error: ordersError.message });
        setError("Failed to load orders.");
      } else {
        logger.info("LIVE_ORDERS: Live orders fetched successfully", {
          orderCount: ordersData?.length || 0,
          statuses: ordersData?.map((order) => order.order_status) || [],
        });
        setOrders((ordersData || []) as OrderWithItems[]);
      }
    } catch (error: any) {
      logger.error("LIVE_ORDERS: Unexpected error fetching live orders", error);
      setError("An unexpected error occurred.");
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
          // Only refetch if we're on the live tab, as other tabs don't need real-time updates
          if (activeTab === 'live') {
            fetchOrders();
          }
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
    } finally {
      setUpdating(null);
    }
  };

  // Get badge counts for each tab
  const getLiveOrdersCount = () => {
    return orders.filter(order => 
      ACTIVE_STATUSES.includes(order.order_status) && 
      (!order.scheduled_for || new Date(order.scheduled_for) <= new Date(Date.now() + 30 * 60 * 1000))
    ).length;
  };

  const getTodayOrdersCount = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    return orders.filter(order => {
      const orderDate = new Date(order.created_at);
      const scheduledDate = order.scheduled_for ? new Date(order.scheduled_for) : null;
      return (orderDate >= today && orderDate < tomorrow) || 
             (scheduledDate && scheduledDate >= today && scheduledDate < tomorrow);
    }).length;
  };

  const getHistoryOrdersCount = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    return orders.filter(order => 
      TERMINAL_STATUSES.includes(order.order_status) && 
      new Date(order.created_at) < today
    ).length;
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

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Order Management</span>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchOrders}
              disabled={loading}
            >
              <RefreshCw
                className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`}
              />
              Refresh
            </Button>
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
              Live (In Progress)
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
            {activeTab === 'live' && "Orders currently requiring action (prep/serve/pay)."}
            {activeTab === 'today' && "All orders for today's business date."}
            {activeTab === 'history' && "Completed and cancelled orders from previous days."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {loading ? (
            <div className="text-center py-8">
              <RefreshCw className="h-8 w-8 mx-auto text-gray-400 animate-spin mb-4" />
              <p className="text-gray-600">Loading orders...</p>
            </div>
          ) : orders.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-600 mb-4">
                No orders yet. Orders will appear here when customers place
                them.
              </p>
            </div>
          ) : (
            <div className="space-y-4 max-h-96 overflow-y-auto">
              {orders.map((order: OrderWithItems) => (
                <div
                  key={order.id}
                  className="border p-4 rounded-lg hover:bg-gray-50"
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
                        onClick={() => updateOrderStatus(order.id, "COMPLETED")}
                        disabled={updating === order.id}
                      >
                        {updating === order.id ? (
                          <RefreshCw className="h-4 w-4 animate-spin" />
                        ) : (
                          "Complete"
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
