"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, CheckCircle, XCircle, RefreshCw } from "lucide-react";
import { createClient } from "@/lib/supabase";

interface OrderItem {
  menu_item_id: string;
  quantity: number;
  price: number;
  item_name: string;
  specialInstructions?: string;
}

interface Order {
  id: string;
  venue_id: string;
  table_number: number;
  customer_name: string;
  customer_phone: string;
  customer_email?: string;
  order_status: string;
  payment_status: string;
  total_amount: number;
  notes?: string;
  items: OrderItem[];
  created_at: string;
  updated_at: string;
  source?: "qr" | "counter";
}

const ORDER_STATUSES = [
  {
    key: "PLACED",
    label: "Order Placed",
    icon: CheckCircle,
    color: "bg-green-100 text-green-800",
    description: "Order has been placed.",
  },
  {
    key: "ACCEPTED",
    label: "Order Accepted",
    icon: CheckCircle,
    color: "bg-green-100 text-green-800",
    description: "Your order has been accepted by the kitchen.",
  },
  {
    key: "IN_PREP",
    label: "In Preparation",
    icon: RefreshCw,
    color: "bg-orange-100 text-orange-800",
    description: "Your order is being prepared in the kitchen.",
  },
  {
    key: "READY",
    label: "Ready for Pickup / Serving",
    icon: CheckCircle,
    color: "bg-blue-100 text-blue-800",
    description: "Your order is ready for pickup / serving.",
  },
  {
    key: "SERVING",
    label: "Being Served",
    icon: CheckCircle,
    color: "bg-purple-100 text-purple-800",
    description: "Your order has been served. Enjoy your meal!",
  },
  {
    key: "COMPLETED",
    label: "Completed",
    icon: CheckCircle,
    color: "bg-green-100 text-green-800",
    description: "Thank you for your order!",
  },
];

// Statuses that should be greyed out (only show if triggered)
const GREYED_OUT_STATUSES = [
  {
    key: "CANCELLED",
    label: "Order Cancelled",
    icon: XCircle,
    color: "bg-red-100 text-red-800",
    description: "Your order has been cancelled",
  },
  {
    key: "REFUNDED",
    label: "Order Refunded",
    icon: XCircle,
    color: "bg-red-100 text-red-800",
    description: "Your order has been refunded",
  },
  {
    key: "EXPIRED",
    label: "Order Expired",
    icon: XCircle,
    color: "bg-gray-100 text-gray-800",
    description: "Your order has expired",
  },
];

export default function OrderTrackingPage() {
  const params = useParams();
  const orderId = params?.orderId as string;

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  const supabase = createClient();

  const fetchOrder = async () => {
    if (!orderId) return;

    try {
      setLoading(true);
      setError(null);

      // Use API endpoint to get complete order data including items and Stripe details
      const response = await fetch(`/api/orders/${orderId}`);
      const data = await response.json();

      if (!response.ok || !data.order) {
        setError(data.error || "Order not found or access denied");
        return;
      }

      setOrder(data.order);
      setLastUpdate(new Date());
    } catch (_err) {
      setError("Failed to load order details");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrder();

    // Set up real-time subscription for order updates
    if (!supabase || !orderId) return;

    const setupChannel = async () => {
      const supabaseClient = await supabase;
      const channel = supabaseClient
        .channel(`order-tracking-${orderId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "orders",
            filter: `id=eq.${orderId}`,
          },
          (payload: {
            eventType: string;
            new?: Record<string, unknown>;
            old?: Record<string, unknown>;
          }) => {
            if (payload.eventType === "UPDATE") {
              // Update the order with new data
              setOrder((prevOrder) => {
                if (!prevOrder) return null;

                const updatedOrder = { ...prevOrder, ...payload.new };
                return updatedOrder;
              });

              setLastUpdate(new Date());
            } else if (payload.eventType === "DELETE") {
              setError("This order has been cancelled or deleted");
            }
          }
        )
        .subscribe((status: unknown) => {
          if (status === "SUBSCRIBED") {
            // Empty block
          } else if (status === "CHANNEL_ERROR") {
            // Empty block
          }
        });

      return () => {
        supabaseClient.removeChannel(channel);
      };
    };

    let cleanup: (() => void) | undefined;
    setupChannel().then((fn) => {
      cleanup = fn;
    });

    return () => {
      cleanup?.();
    };
  }, [orderId, supabase]);

  const getStatusInfo = (status: string) => {
    return (
      ORDER_STATUSES.find((s) => s.key === status) ||
      GREYED_OUT_STATUSES.find((s) => s.key === status) || {
        key: status,
        label: status.replace("_", " "),
        icon: Clock,
        color: "bg-gray-100 text-gray-800",
        description: "Order status update",
      }
    );
  };

  const getCurrentStatusIndex = () => {
    if (!order) return -1;
    return ORDER_STATUSES.findIndex((s) => s.key === order.order_status);
  };

  const getDisplayStatuses = () => {
    if (!order) return ORDER_STATUSES;

    const currentStatus = order.order_status;
    const isGreyedOutStatus = GREYED_OUT_STATUSES.some((status) => status.key === currentStatus);

    if (isGreyedOutStatus) {
      // If order is in a greyed-out status, show all normal statuses + the greyed-out one
      const greyedOutStatus = GREYED_OUT_STATUSES.find((status) => status.key === currentStatus);
      return [...ORDER_STATUSES, greyedOutStatus!];
    }

    return ORDER_STATUSES;
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: "GBP",
    }).format(amount);
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Generate short order number
  const getShortOrderNumber = (orderId: string) => {
    // Use last 6 characters of UUID for shorter display
    return orderId.slice(-6).toUpperCase();
  };

  // Determine if it's a counter order
  const isCounterOrder = (order: Order) => {
    return order.source === "counter";
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-900">Loading order details...</p>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <XCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Order Not Found</h1>
          <p className="text-gray-900 mb-4">
            {error || "The order you are looking for could not be found."}
          </p>
          <Button onClick={() => window.history.back()}>Go Back</Button>
        </div>
      </div>
    );
  }

  const currentStatusIndex = getCurrentStatusIndex();
  const isCounter = isCounterOrder(order);

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-2xl mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Order Tracking</h1>
          <p className="text-gray-900 text-sm sm:text-base">Track your order in real-time</p>
        </div>

        {/* Order Summary Card */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Order #{getShortOrderNumber(order.id)}</span>
              <Badge variant="outline" className="text-sm">
                {isCounter ? `Counter ${order.table_number}` : `Table ${order.table_number}`}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium text-gray-900">Customer:</span>
                <p className="text-gray-900">{order.customer_name}</p>
              </div>
              <div>
                <span className="font-medium text-gray-900">Total:</span>
                <p className="text-gray-900 font-semibold">{formatCurrency(order.total_amount)}</p>
              </div>
              <div>
                <span className="font-medium text-gray-900">Placed:</span>
                <p className="text-gray-900">{formatTime(order.created_at)}</p>
              </div>
              <div>
                <span className="font-medium text-gray-900">Last Updated:</span>
                <p className="text-gray-900">{formatTime(order.updated_at)}</p>
              </div>
            </div>

            {order.notes && (
              <div>
                <span className="font-medium text-gray-900">Special Instructions:</span>
                <p className="text-gray-900 mt-1">{order.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Order Status Timeline */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-2 sm:space-y-0">
              <span>Order Progress</span>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchOrder}
                className="flex items-center gap-2 w-full sm:w-auto"
              >
                <RefreshCw className="h-4 w-4" />
                Refresh
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {getDisplayStatuses().map((status, index) => {
                const isGreyedOut = GREYED_OUT_STATUSES.some((gs) => gs.key === status.key);
                const isCompleted = !isGreyedOut && index <= currentStatusIndex;
                const isCurrent = status.key === order?.order_status;
                const Icon = status.icon;

                return (
                  <div key={status.key} className="flex items-start space-x-4">
                    <div
                      className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                        isGreyedOut
                          ? "bg-red-500 text-white"
                          : isCompleted
                            ? "bg-servio-purple text-white"
                            : "bg-gray-200 text-gray-700"
                      }`}
                    >
                      {isGreyedOut ? (
                        <XCircle className="h-5 w-5" />
                      ) : isCompleted ? (
                        <CheckCircle className="h-5 w-5" />
                      ) : (
                        <Icon className="h-5 w-5" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2">
                        <h3
                          className={`text-sm font-medium ${
                            isGreyedOut
                              ? "text-red-600"
                              : isCurrent
                                ? "text-servio-purple"
                                : "text-gray-900"
                          }`}
                        >
                          {status.label}
                        </h3>
                        {isCurrent && !isGreyedOut && (
                          <Badge className={status.color}>Current</Badge>
                        )}
                        {isGreyedOut && (
                          <Badge variant="destructive" className="text-xs">
                            {status.key}
                          </Badge>
                        )}
                      </div>
                      <p
                        className={`text-sm mt-1 ${isGreyedOut ? "text-red-500" : "text-gray-900"}`}
                      >
                        {status.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Order Items */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Order Items</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {order.items.map((item, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between py-2 border-b border-gray-100 last:border-b-0"
                >
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <span className="font-medium text-gray-900">{item.item_name}</span>
                      <span className="text-sm text-gray-900">×{item.quantity}</span>
                    </div>
                    {item.specialInstructions && (
                      <p className="text-sm text-gray-900 mt-1 italic">
                        "{item.specialInstructions}"
                      </p>
                    )}
                  </div>
                  <span className="font-medium text-gray-900">
                    {formatCurrency(item.price * item.quantity)}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center text-sm text-gray-900">
          <p>Last updated: {lastUpdate.toLocaleTimeString()}</p>
          <p className="mt-1">This page updates automatically</p>
        </div>
      </div>
    </div>
  );
}
