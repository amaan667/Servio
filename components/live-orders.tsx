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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  RefreshCw,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  User,
} from "lucide-react";
import { Session } from "@supabase/supabase-js";
import { supabase, type AuthSession } from "@/lib/supabase";
import { logger } from "@/lib/logger";
import { todayWindowForTZ } from "@/lib/time";

const hasSupabaseConfig = !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

// Add OrderWithItems type locally since it's not exported from supabase
interface OrderWithItems {
  id: string;
  order_number: number;
  venue_id: string;
  table_number: number;
  customer_name: string;
  customer_phone?: string;
  status: string;
  total_amount: number;
  notes?: string;
  created_at: string;
  payment_status?: string;
  order_items: Array<{
    id: string;
    quantity: number;
    price: number;
    item_name: string;
  }>;
}

interface LiveOrdersProps {
  venueId: string; // This is the text-based slug
  session: Session;
}

export function LiveOrders({ venueId, session }: LiveOrdersProps) {
  const [liveOrders, setLiveOrders] = useState<OrderWithItems[]>([]);
  const [allOrders, setAllOrders] = useState<OrderWithItems[]>([]);
  const [historyOrders, setHistoryOrders] = useState<OrderWithItems[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);
  const [todayWindow, setTodayWindow] = useState<any>(null);
  const [activeTab, setActiveTab] = useState("live");

  const fetchOrders = useCallback(async () => {
    logger.info("LIVE_ORDERS: Fetching orders", {
      venueId,
      hasSupabase: !!supabase,
    });

    setLoading(true);
    setError(null);

    if (!supabase) {
      logger.error("LIVE_ORDERS: Supabase not configured");
      setError("Service is not configured.");
      setLoading(false);
      return;
    }

    try {
      // Get venue timezone for proper date filtering
      const { data: venueData } = await supabase
        .from('venues')
        .select('timezone')
        .eq('venue_id', venueId)
        .single();
      
      const window = todayWindowForTZ(venueData?.timezone);
      setTodayWindow(window);

      // Fetch live orders (pending/preparing from today)
      const { data: liveData, error: liveError } = await supabase
        .from("orders")
        .select(`
          *,
          order_items (
            id,
            quantity,
            price,
            item_name
          )
        `)
        .eq("venue_id", venueId)
        .in("status", ["pending", "preparing"])
        .gte("created_at", window.startUtcISO)
        .lt("created_at", window.endUtcISO)
        .order("created_at", { ascending: false });

      // Fetch all orders from today
      const { data: allData, error: allError } = await supabase
        .from("orders")
        .select(`
          *,
          order_items (
            id,
            quantity,
            price,
            item_name
          )
        `)
        .eq("venue_id", venueId)
        .gte("created_at", window.startUtcISO)
        .lt("created_at", window.endUtcISO)
        .order("created_at", { ascending: false });

      // Fetch history orders (not from today)
      const { data: historyData, error: historyError } = await supabase
        .from("orders")
        .select(`
          *,
          order_items (
            id,
            quantity,
            price,
            item_name
          )
        `)
        .eq("venue_id", venueId)
        .lt("created_at", window.startUtcISO)
        .order("created_at", { ascending: false })
        .limit(100);

      if (liveError || allError || historyError) {
        logger.error("LIVE_ORDERS: Failed to fetch orders from Supabase", {
          liveError: liveError?.message,
          allError: allError?.message,
          historyError: historyError?.message,
          venueId,
        });
        setError("Failed to load orders.");
      } else {
        logger.info("LIVE_ORDERS: Orders fetched successfully", {
          liveCount: liveData?.length || 0,
          allCount: allData?.length || 0,
          historyCount: historyData?.length || 0,
        });
        
        setLiveOrders(liveData || []);
        setAllOrders(allData || []);
        setHistoryOrders(historyData || []);
      }
    } catch (err) {
      logger.error("LIVE_ORDERS: Unexpected error fetching orders", { err });
      setError("An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  }, [venueId]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    setUpdating(orderId);
    logger.info("LIVE_ORDERS: Updating order status", {
      orderId,
      newStatus,
    });

    try {
      const { error } = await supabase
        .from("orders")
        .update({ status: newStatus })
        .eq("id", orderId)
        .eq("venue_id", venueId);

      if (error) {
        logger.error("LIVE_ORDERS: Failed to update order status", {
          error: error.message,
          orderId,
          newStatus,
        });
        setError("Failed to update order status.");
      } else {
        logger.info("LIVE_ORDERS: Order status updated successfully", {
          orderId,
          newStatus,
        });
        
        // Update all order lists
        const updateOrderInList = (orders: OrderWithItems[]) =>
          orders.map((order) =>
            order.id === orderId ? { ...order, status: newStatus } : order
          );

        setLiveOrders(updateOrderInList);
        setAllOrders(updateOrderInList);
        setHistoryOrders(updateOrderInList);
      }
    } catch (err) {
      logger.error("LIVE_ORDERS: Unexpected error updating order status", { err });
      setError("An unexpected error occurred.");
    } finally {
      setUpdating(null);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-yellow-100 text-yellow-800";
      case "preparing":
        return "bg-blue-100 text-blue-800";
      case "ready":
        return "bg-green-100 text-green-800";
      case "completed":
        return "bg-gray-100 text-gray-800";
      case "cancelled":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getPaymentStatusColor = (paymentStatus: string) => {
    switch (paymentStatus) {
      case "paid":
        return "bg-green-100 text-green-800";
      case "pending":
        return "bg-yellow-100 text-yellow-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pending":
        return <Clock className="h-4 w-4" />;
      case "preparing":
        return <RefreshCw className="h-4 w-4" />;
      case "ready":
        return <CheckCircle className="h-4 w-4" />;
      case "completed":
        return <CheckCircle className="h-4 w-4" />;
      case "cancelled":
        return <XCircle className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  const renderOrderCard = (order: OrderWithItems, showActions: boolean = true) => (
    <div
      key={order.id}
      className="border p-4 rounded-lg hover:bg-gray-50"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-3">
          <h3 className="font-semibold text-lg">
            Order #{order.order_number}
          </h3>
          <Badge className={getStatusColor(order.status)}>
            {getStatusIcon(order.status)}
            <span className="ml-1 capitalize">{order.status}</span>
          </Badge>
          {order.payment_status && (
            <Badge className={getPaymentStatusColor(order.payment_status)}>
              {order.payment_status.toUpperCase()}
            </Badge>
          )}
        </div>
        <div className="text-right">
          <p className="text-sm text-gray-600">
            Table {order.table_number}
          </p>
          <p className="text-lg font-bold text-green-600">
            £{order.total_amount.toFixed(2)}
          </p>
        </div>
      </div>

      <div className="mb-3">
        <p className="text-sm text-gray-600 flex items-center">
          <User className="h-4 w-4 mr-1" />
          {order.customer_name}
        </p>
        <p className="text-sm text-gray-600">
          Placed: {new Date(order.created_at).toLocaleString()}
        </p>
      </div>

      {order.order_items && order.order_items.length > 0 && (
        <div className="mb-4">
          <h4 className="font-medium mb-2">Items:</h4>
          <div className="space-y-1">
            {order.order_items.map((item) => (
              <div
                key={item.id}
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

      {showActions && (
        <div className="flex space-x-2">
          {order.status === "pending" && (
            <Button
              size="sm"
              onClick={() => updateOrderStatus(order.id, "preparing")}
              disabled={updating === order.id}
            >
              {updating === order.id ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                "Start Preparing"
              )}
            </Button>
          )}
          {order.status === "preparing" && (
            <Button
              size="sm"
              onClick={() => updateOrderStatus(order.id, "ready")}
              disabled={updating === order.id}
            >
              {updating === order.id ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                "Mark Ready"
              )}
            </Button>
          )}
          {order.status === "ready" && (
            <Button
              size="sm"
              onClick={() => updateOrderStatus(order.id, "completed")}
              disabled={updating === order.id}
            >
              {updating === order.id ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                "Complete"
              )}
            </Button>
          )}
          {(order.status === "pending" ||
            order.status === "preparing") && (
            <Button
              size="sm"
              variant="destructive"
              onClick={() => updateOrderStatus(order.id, "cancelled")}
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
      )}
    </div>
  );

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
            <span>Live Orders</span>
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
          <CardDescription>
            Manage incoming orders in real-time. Orders will appear here
            automatically as customers place them.
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
          ) : (
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="live">Live Orders ({liveOrders.length})</TabsTrigger>
                <TabsTrigger value="all">All Today ({allOrders.length})</TabsTrigger>
                <TabsTrigger value="history">History ({historyOrders.length})</TabsTrigger>
              </TabsList>

              <TabsContent value="live" className="mt-6">
                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {liveOrders.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-gray-600 mb-4">
                        No active orders. New orders will appear here when customers place them.
                      </p>
                    </div>
                  ) : (
                    liveOrders.map((order) => renderOrderCard(order, true))
                  )}
                </div>
              </TabsContent>

              <TabsContent value="all" className="mt-6">
                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {allOrders.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-gray-600 mb-4">
                        No orders today. All orders from today will appear here.
                      </p>
                    </div>
                  ) : (
                    allOrders.map((order) => renderOrderCard(order, false))
                  )}
                </div>
              </TabsContent>

              <TabsContent value="history" className="mt-6">
                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {historyOrders.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-gray-600 mb-4">
                        No historical orders. Previous orders will appear here.
                      </p>
                    </div>
                  ) : (
                    historyOrders.map((order) => renderOrderCard(order, false))
                  )}
                </div>
              </TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
