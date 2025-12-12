"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import {
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  User,
  Play,
  SkipForward,
  RotateCcw,
  Timer,
  Zap,
} from "lucide-react";
import { supabaseBrowser as createClient } from "@/lib/supabase";

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
  customer_phone?: string;
  customer_email?: string;
  order_status: string;
  payment_status: string;
  total_amount: number;
  notes?: string;
  payment_method?: string;
  scheduled_for?: string;
  prep_lead_minutes?: number;
  estimated_prep_time?: number;
  source?: "qr" | "counter"; // Order source - qr for table orders, counter for counter orders
  items: OrderItem[];
  created_at: string;
  updated_at: string;
}

interface OrderLifecycleProps {
  venueId: string;
  order: Order;
  onUpdate: () => void;
}

// Enhanced order status definitions with timing and automation rules
const ORDER_STATUSES = {
  PLACED: {
    label: "Order Placed",
    icon: Clock,
    color: "bg-yellow-100 text-yellow-800",
    nextStatuses: ["ACCEPTED", "CANCELLED"],
    autoTransition: false,
    estimatedTime: 0,
    description: "Order received, waiting for confirmation",
  },
  ACCEPTED: {
    label: "Order Accepted",
    icon: CheckCircle,
    color: "bg-blue-100 text-blue-800",
    nextStatuses: ["IN_PREP", "CANCELLED"],
    autoTransition: false,
    estimatedTime: 0,
    description: "Order confirmed, ready to start preparation",
  },
  IN_PREP: {
    label: "In Preparation",
    icon: Play,
    color: "bg-orange-100 text-orange-800",
    nextStatuses: ["READY", "CANCELLED"],
    autoTransition: true,
    estimatedTime: 15, // minutes
    description: "Kitchen is preparing the order",
  },
  READY: {
    label: "Ready for Pickup",
    icon: CheckCircle,
    color: "bg-green-100 text-green-800",
    nextStatuses: ["COMPLETED", "CANCELLED"], // Updated to go directly to COMPLETED
    autoTransition: false,
    estimatedTime: 0,
    description: "Order is ready to be served",
  },
  SERVING: {
    label: "Being Served",
    icon: User,
    color: "bg-purple-100 text-purple-800",
    nextStatuses: ["COMPLETED", "CANCELLED"],
    autoTransition: true,
    estimatedTime: 5, // minutes
    description: "Order is being delivered to customer",
  },
  COMPLETED: {
    label: "Completed",
    icon: CheckCircle,
    color: "bg-green-100 text-green-800",
    nextStatuses: [],
    autoTransition: false,
    estimatedTime: 0,
    description: "Order has been successfully completed",
  },
  CANCELLED: {
    label: "Cancelled",
    icon: XCircle,
    color: "bg-red-100 text-red-800",
    nextStatuses: [],
    autoTransition: false,
    estimatedTime: 0,
    description: "Order has been cancelled",
  },
  REFUNDED: {
    label: "Refunded",
    icon: RotateCcw,
    color: "bg-gray-100 text-gray-800",
    nextStatuses: [],
    autoTransition: false,
    estimatedTime: 0,
    description: "Order has been refunded",
  },
  EXPIRED: {
    label: "Expired",
    icon: AlertTriangle,
    color: "bg-gray-100 text-gray-800",
    nextStatuses: [],
    autoTransition: false,
    estimatedTime: 0,
    description: "Order has expired",
  },
};

// Helper function to get button label based on order source
const getButtonLabel = (status: string, orderSource?: string) => {
  switch (status) {
    case "READY":
      return orderSource === "counter" ? "Mark as Ready for Pickup" : "Mark as Served";
    case "COMPLETED":
      return "Complete Order";
    default:
      return ORDER_STATUSES[status as keyof typeof ORDER_STATUSES]?.label || status;
  }
};

export function EnhancedOrderLifecycle({
  venueId: _venueId,
  order,
  onUpdate,
}: OrderLifecycleProps) {
  // Determine if it's a counter order
  const isCounterOrder = (order: Order) => {
    return order.source === "counter" || (order.table_number !== null && order.table_number >= 10);
  };
  const [updating, setUpdating] = useState(false);
  const [autoTransitionTimer, setAutoTransitionTimer] = useState<NodeJS.Timeout | null>(null);
  const [timeInCurrentStatus, setTimeInCurrentStatus] = useState(0);
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);

  const currentStatus = ORDER_STATUSES[order.order_status as keyof typeof ORDER_STATUSES];
  const nextStatuses = currentStatus?.nextStatuses || [];

  // Calculate time spent in current status
  useEffect(() => {
    const updateTime = () => {
      const now = new Date().getTime();
      const statusUpdateTime = new Date(order.updated_at).getTime();
      const timeDiff = Math.floor((now - statusUpdateTime) / 1000 / 60); // minutes
      setTimeInCurrentStatus(timeDiff);
    };

    updateTime();
    const interval = setInterval(updateTime, 120000); // Update every 2 minutes

    return () => clearInterval(interval);
  }, [order.updated_at]);

  // Auto-transition logic
  useEffect(() => {
    if (!currentStatus?.autoTransition || !currentStatus.estimatedTime) return;

    const timeUntilTransition = Math.max(0, currentStatus.estimatedTime - timeInCurrentStatus);

    if (timeUntilTransition <= 0) {
      // Auto-advance to next logical status
      const nextStatus = getNextLogicalStatus(order.order_status);
      if (nextStatus) {
        updateOrderStatus(nextStatus);
      }
    } else {
      // Set timer for auto-transition
      const timer = setTimeout(
        () => {
          const nextStatus = getNextLogicalStatus(order.order_status);
          if (nextStatus) {
            updateOrderStatus(nextStatus);
          }
        },
        Math.min(timeUntilTransition * 60 * 1000, 15000)
      ); // Cap at 15 seconds max

      setAutoTransitionTimer(timer);
    }

    return () => {
      if (autoTransitionTimer) {
        clearTimeout(autoTransitionTimer);
      }
    };
  }, [order.order_status, timeInCurrentStatus, currentStatus]);

  const getNextLogicalStatus = (currentStatus: string): string | null => {
    switch (currentStatus) {
      case "IN_PREP":
        return "READY";
      case "SERVING":
        return "COMPLETED";
      default:
        return null;
    }
  };

  const updateOrderStatus = async (newStatus: string) => {
    if (updating) return;

    setUpdating(true);

    try {
      const supabase = createClient();
      if (!supabase) throw new Error("Supabase client not available");

      const { error } = await supabase
        .from("orders")
        .update({
          order_status: newStatus,
          updated_at: new Date().toISOString(),
        })
        .eq("id", order.id);

      if (error) {
        throw new Error(error.message);
      }

      onUpdate();
    } catch (_error) {
      // Error silently handled
    } finally {
      setUpdating(false);
    }
  };

  const getStatusProgress = () => {
    const statusOrder = ["PLACED", "ACCEPTED", "IN_PREP", "READY", "SERVING", "COMPLETED"];
    const currentIndex = statusOrder.indexOf(order.order_status);
    return currentIndex >= 0 ? ((currentIndex + 1) / statusOrder.length) * 100 : 0;
  };

  const getEstimatedCompletionTime = () => {
    if (order.order_status === "COMPLETED") return 0;

    const statusOrder = ["PLACED", "ACCEPTED", "IN_PREP", "READY", "SERVING", "COMPLETED"];
    const currentIndex = statusOrder.indexOf(order.order_status);
    if (currentIndex < 0) return 0;

    let totalTime = 0;
    for (let i = currentIndex; i < statusOrder.length - 1; i++) {
      const status = statusOrder[i];
      const statusConfig = ORDER_STATUSES[status as keyof typeof ORDER_STATUSES];
      totalTime += statusConfig.estimatedTime || 0;
    }

    return totalTime;
  };

  const formatTime = (minutes: number) => {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  const getUrgencyLevel = () => {
    if (order.order_status === "COMPLETED" || order.order_status === "CANCELLED") return "none";

    const timeInStatus = timeInCurrentStatus;
    const estimatedTime = currentStatus?.estimatedTime || 0;

    if (timeInStatus > estimatedTime * 1.5) return "critical";
    if (timeInStatus > estimatedTime * 1.2) return "warning";
    return "normal";
  };

  const urgencyColors = {
    normal: "text-green-600",
    warning: "text-orange-600",
    critical: "text-red-600",
    none: "text-gray-900",
  };

  const urgencyIcons = {
    normal: Clock,
    warning: AlertTriangle,
    critical: Zap,
    none: Clock,
  };

  const UrgencyIcon = urgencyIcons[getUrgencyLevel() as keyof typeof urgencyIcons];

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Order #{order.id.slice(-6).toUpperCase()}</span>
          <Badge className={currentStatus?.color || "bg-gray-100 text-gray-800"}>
            {currentStatus?.icon && <currentStatus.icon className="h-3 w-3 mr-1" />}
            {currentStatus?.label || order.order_status}
          </Badge>
        </CardTitle>
        <CardDescription>{currentStatus?.description || "Order management"}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Order Progress */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span>Order Progress</span>
            <span className="text-gray-900">{Math.round(getStatusProgress())}%</span>
          </div>
          <Progress value={getStatusProgress()} className="h-2" />

          {/* Status Timeline */}
          <div className="flex justify-between text-xs text-gray-900 mt-2">
            {["PLACED", "ACCEPTED", "IN_PREP", "READY", "SERVING", "COMPLETED"].map(
              (status, index) => {
                const isActive = status === order.order_status;
                const isCompleted =
                  ["PLACED", "ACCEPTED", "IN_PREP", "READY", "SERVING", "COMPLETED"].indexOf(
                    order.order_status
                  ) >= index;

                return (
                  <div
                    key={status}
                    className={`flex flex-col items-center ${isActive ? "text-blue-600" : isCompleted ? "text-green-600" : "text-gray-700"}`}
                  >
                    <div
                      className={`w-2 h-2 rounded-full mb-1 ${isActive ? "bg-blue-600" : isCompleted ? "bg-green-600" : "bg-gray-300"}`}
                    />
                    <span className="text-center">
                      {ORDER_STATUSES[status as keyof typeof ORDER_STATUSES]?.label || status}
                    </span>
                  </div>
                );
              }
            )}
          </div>
        </div>

        {/* Current Status Info */}
        <div className="grid grid-cols-2 gap-4 p-3 bg-gray-50 rounded-lg">
          <div>
            <div className="text-sm text-gray-900">Time in Status</div>
            <div className="font-semibold">{formatTime(timeInCurrentStatus)}</div>
          </div>
          <div>
            <div className="text-sm text-gray-900">Estimated Time</div>
            <div className="font-semibold">
              {currentStatus?.estimatedTime ? formatTime(currentStatus.estimatedTime) : "N/A"}
            </div>
          </div>
          <div>
            <div className="text-sm text-gray-900">Time to Complete</div>
            <div className="font-semibold">{formatTime(getEstimatedCompletionTime())}</div>
          </div>
          <div>
            <div className="text-sm text-gray-900">Urgency</div>
            <div
              className={`flex items-center ${urgencyColors[getUrgencyLevel() as keyof typeof urgencyColors]}`}
            >
              <UrgencyIcon className="h-4 w-4 mr-1" />
              <span className="capitalize">{getUrgencyLevel()}</span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2">
          {nextStatuses.map((nextStatus) => {
            const nextStatusConfig = ORDER_STATUSES[nextStatus as keyof typeof ORDER_STATUSES];
            return (
              <Button
                key={nextStatus}
                onClick={() => updateOrderStatus(nextStatus)}
                disabled={updating}
                variant={nextStatus === "CANCELLED" ? "destructive" : "default"}
                size="sm"
                className="flex items-center gap-2"
              >
                {nextStatusConfig?.icon && <nextStatusConfig.icon className="h-4 w-4" />}
                {getButtonLabel(nextStatus, order.source)}
              </Button>
            );
          })}
        </div>

        {/* Advanced Options */}
        <div className="space-y-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
            className="w-full"
          >
            {showAdvancedOptions ? "Hide" : "Show"} Advanced Options
          </Button>

          {showAdvancedOptions && (
            <div className="space-y-2 p-3 border rounded-lg bg-gray-50">
              <div className="text-sm font-medium">Manual Overrides</div>

              {/* Skip Status */}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const nextStatus = getNextLogicalStatus(order.order_status);
                    if (nextStatus) updateOrderStatus(nextStatus);
                  }}
                  disabled={updating || !getNextLogicalStatus(order.order_status)}
                  className="flex-1"
                >
                  <SkipForward className="h-4 w-4 mr-1" />
                  Skip to Next
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => updateOrderStatus("COMPLETED")}
                  disabled={updating || order.order_status === "COMPLETED"}
                  className="flex-1"
                >
                  <CheckCircle className="h-4 w-4 mr-1" />
                  Mark Complete
                </Button>
              </div>

              {/* Time Adjustments */}
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    // Add 5 minutes to current status time
                    const newTime = new Date();
                    newTime.setMinutes(newTime.getMinutes() - 5);
                    // This would need a custom API endpoint to update the updated_at timestamp
                  }}
                  disabled={updating}
                >
                  <Timer className="h-4 w-4 mr-1" />
                  -5 min
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    // Add 5 minutes to current status time
                    const newTime = new Date();
                    newTime.setMinutes(newTime.getMinutes() + 5);
                    // This would need a custom API endpoint to update the updated_at timestamp
                  }}
                  disabled={updating}
                >
                  <Timer className="h-4 w-4 mr-1" />
                  +5 min
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Order Details */}
        <div className="space-y-2">
          <div className="text-sm font-medium">Order Details</div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-900">{isCounterOrder(order) ? "Counter" : "Table"}:</span>
              <span className="ml-2 font-medium">{order.table_number}</span>
            </div>
            <div>
              <span className="text-gray-900">Customer:</span>
              <span className="ml-2 font-medium">{order.customer_name}</span>
            </div>
            <div>
              <span className="text-gray-900">Total:</span>
              <span className="ml-2 font-medium text-green-600">
                £{order.total_amount.toFixed(2)}
              </span>
            </div>
            <div>
              <span className="text-gray-900">Items:</span>
              <span className="ml-2 font-medium">{order.items.length}</span>
            </div>
          </div>
        </div>

        {/* Auto-transition Status */}
        {currentStatus?.autoTransition && (
          <Alert>
            <Timer className="h-4 w-4" />
            <AlertDescription>
              This order will automatically advance to the next status in{" "}
              <span className="font-medium">
                {Math.max(0, (currentStatus.estimatedTime || 0) - timeInCurrentStatus)} minutes
              </span>
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
