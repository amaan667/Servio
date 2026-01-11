"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, CheckCircle, XCircle, RefreshCw } from "lucide-react";
import { supabaseBrowser as createClient } from "@/lib/supabase";

interface OrderItem {

}

interface Order {

}

// Table order timeline (includes serving step)
const TABLE_ORDER_STATUSES = [
  {

  },
  {

  },
  {

  },
  {

  },
  {

  },
  {

  },
];

// Counter order timeline (no serving step - goes directly from ready to completed)
const COUNTER_ORDER_STATUSES = [
  {

  },
  {

  },
  {

  },
  {

  },
  {

  },
];

// Statuses that should be greyed out (only show if triggered)
const GREYED_OUT_STATUSES = [
  {

  },
  {

  },
  {

  },
];

interface RealTimeOrderTimelineProps {

}

export function RealTimeOrderTimeline({
  orderId,

  className,
}: RealTimeOrderTimelineProps) {
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  const supabase = createClient();

  // Determine if it's a counter order
  const isCounterOrder = (order: Order) => {
    return order.source === "counter" || order.order_type === "counter";
  };

  const fetchOrder = async () => {
    if (!orderId) return;

    try {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase.from("orders").select("*").eq("id", orderId).single();

      if (error) {
        setError("Order not found or access denied");
        return;
      }

      setOrder(data);
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

    const channel = supabase
      .channel(`order-timeline-${orderId}`)
      .on(
        "postgres_changes",
        {

          filter: `id=eq.${orderId}`,
        },
        (payload: {

          new?: Record<string, unknown>;
          old?: Record<string, unknown>;
        }) => {
          if (payload.eventType === "UPDATE") {
            // Update the order with new data
            setOrder((prevOrder) => {
              if (!prevOrder) return null;

              const updatedOrder = { ...prevOrder, ...payload.new };
              return updatedOrder;

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

    return () => {
      supabase.removeChannel(channel);
    };
  }, [orderId, supabase]);

  const getStatusInfo = (status: string, order: Order) => {
    const statusArray = isCounterOrder(order) ? COUNTER_ORDER_STATUSES : TABLE_ORDER_STATUSES;
    return (
      statusArray.find((s) => s.key === status) ||
      GREYED_OUT_STATUSES.find((s) => s.key === status) || {

        label: status.replace("_", " "),

      }
    );
  };

  const getCurrentStatusIndex = () => {
    if (!order) return 0;
    const statusArray = isCounterOrder(order) ? COUNTER_ORDER_STATUSES : TABLE_ORDER_STATUSES;
    return statusArray.findIndex((status) => status.key === order.order_status);
  };

  const getDisplayStatuses = () => {
    if (!order) return TABLE_ORDER_STATUSES;

    const statusArray = isCounterOrder(order) ? COUNTER_ORDER_STATUSES : TABLE_ORDER_STATUSES;
    const currentStatus = order.order_status;
    const isGreyedOutStatus = GREYED_OUT_STATUSES.some((status) => status.key === currentStatus);

    if (isGreyedOutStatus) {
      // If order is in a greyed-out status, show all normal statuses + the greyed-out one
      const greyedOutStatus = GREYED_OUT_STATUSES.find((status) => status.key === currentStatus);
      return [...statusArray, greyedOutStatus!];
    }

    return statusArray;
  };

  if (error) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-blue-500" />
            Order Timeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <XCircle className="w-8 h-8 text-red-500 mx-auto mb-4" />
            <p className="text-red-600 mb-4">{error}</p>
            <Button onClick={fetchOrder} variant="outline" size="sm">
              <RefreshCw className="w-4 h-4 mr-2" />
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!order) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-blue-500" />
            Order Timeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-gray-900">No order data available</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const currentStatusIndex = getCurrentStatusIndex();
  const displayStatuses = getDisplayStatuses();
  const currentStatus = order?.order_status;
  const isGreyedOutStatus = GREYED_OUT_STATUSES.some((status) => status.key === currentStatus);

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-blue-500" />
            Order Timeline
          </span>
          <Badge variant="outline" className="text-xs">
            Live Updates
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Order Status Timeline */}
          <div className="space-y-4">
            {displayStatuses.map((status, index) => {
              const isGreyedOut = GREYED_OUT_STATUSES.some((gs) => gs.key === status.key);
              const isCompleted = !isGreyedOut && index <= currentStatusIndex;
              const isCurrent = status.key === currentStatus;
              const Icon = status.icon;

              return (
                <div key={status.key} className="relative">
                  <div className="flex items-start space-x-3">
                    {/* Timeline Icon */}
                    <div
                      className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                        isGreyedOut
                          ? "bg-red-500 text-white"

                      }`}
                    >
                      <Icon className="h-4 w-4" />
                    </div>

                    {/* Timeline Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2">
                        <p
                          className={`text-sm font-medium ${
                            isGreyedOut
                              ? "text-red-600"

                          }`}
                        >
                          {status.label}
                        </p>
                        {isCurrent && !isGreyedOut && (
                          <Badge variant="secondary" className="text-xs">
                            Current
                          </Badge>
                        )}
                        {isCompleted && !isCurrent && (
                          <Badge
                            variant="outline"
                            className="text-xs text-green-600 border-green-600"
                          >
                            Complete
                          </Badge>
                        )}
                        {isGreyedOut && (
                          <Badge variant="destructive" className="text-xs">
                            {status.key}
                          </Badge>
                        )}
                      </div>
                      <p
                        className={`text-xs mt-1 ${isGreyedOut ? "text-red-500" : "text-gray-900"}`}
                      >
                        {status.description}
                      </p>
                    </div>
                  </div>

                  {/* Timeline Line */}
                  {index < displayStatuses.length - 1 && (
                    <div
                      className={`absolute left-4 top-8 w-0.5 h-4 ${
                        isCompleted ? "bg-gray-300" : "bg-gray-200"
                      }`}
                    />
                  )}
                </div>
              );
            })}
          </div>

          {/* Last Update Info */}
          <div className="bg-gray-50 p-3 rounded-lg">
            <p className="text-xs text-gray-900">Last updated: {lastUpdate.toLocaleTimeString()}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
