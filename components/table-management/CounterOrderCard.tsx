"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { User, X, CreditCard, CheckCircle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { CounterOrder } from "@/hooks/useCounterOrders";
import { calculateOrderTotal, formatPrice, normalizePrice } from "@/lib/pricing-utils";

// Helper functions for order status flow
const getNextOrderStatus = (currentStatus: string) => {
  // Normalize to uppercase for comparison
  const status = currentStatus.toUpperCase();
  switch (status) {
    case "PLACED":
    case "ACCEPTED":
      return "IN_PREP";
    case "IN_PREP":
    case "PREPARING":
      return "READY";
    case "READY":
      return "COMPLETED";
    case "SERVING":
    case "SERVED":
      return "COMPLETED";
    default:
      return "COMPLETED";
  }
};

const getNextStatusLabel = (currentStatus: string) => {
  // Normalize to uppercase for comparison
  const status = currentStatus.toUpperCase();
  switch (status) {
    case "PLACED":
    case "ACCEPTED":
      return "Start Preparing";
    case "IN_PREP":
    case "PREPARING":
      return "Mark as Ready for Pickup";
    case "READY":
      return "Complete Order";
    case "SERVING":
    case "SERVED":
      return "Complete Order";
    default:
      return "Complete Order";
  }
};

interface CounterOrderCardProps {
  order: CounterOrder;
  venueId: string;
  onActionComplete?: () => void;
}

export function CounterOrderCard({ order, venueId, onActionComplete }: CounterOrderCardProps) {
  const [showHoverRemove, setShowHoverRemove] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  const handleRemoveOrder = async () => {
    try {
      setIsRemoving(true);

      const response = await fetch("/api/orders/delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include", // Include cookies for authentication
        body: JSON.stringify({
          orderId: order.id,
          venue_id: venueId,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to delete order");
      }

      onActionComplete?.();
    } catch (_error) {
      // Error silently handled
    } finally {
      setIsRemoving(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "PLACED":
        return "bg-yellow-100 text-yellow-800";
      case "IN_PREP":
        return "bg-blue-100 text-blue-800";
      case "READY":
        return "bg-green-100 text-green-800";
      case "SERVING":
        return "bg-purple-100 text-purple-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getPaymentStatusColor = (status: string) => {
    switch (status) {
      case "PAID":
        return "bg-green-100 text-green-800";
      case "UNPAID":
        return "bg-red-100 text-red-800";
      case "TILL":
        return "bg-blue-100 text-blue-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getTotalAmount = () => {
    // Use the standardized pricing calculation
    const total = calculateOrderTotal({ total_amount: order.total_amount, items: order.items });
    return formatPrice(total);
  };

  const handlePayment = async (paymentMethod: "till" | "card") => {
    try {
      setIsProcessingPayment(true);

      const response = await fetch("/api/orders/payment", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          orderId: order.id,
          venue_id: venueId,
          payment_method: paymentMethod,
          payment_status: "PAID",
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to process payment");
      }

      onActionComplete?.();
    } catch (_error) {
      // Error silently handled
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const handleStatusUpdate = async (newStatus: string) => {
    try {
      setIsProcessingPayment(true);

      const response = await fetch("/api/orders/set-status", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          orderId: order.id,
          status: newStatus,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to update order status");
      }

      onActionComplete?.();
    } catch (_error) {
      // Error silently handled
    } finally {
      setIsProcessingPayment(false);
    }
  };

  return (
    <Card
      className="w-full shadow-sm hover:shadow-md transition-all duration-200 relative"
      onMouseEnter={() => setShowHoverRemove(true)}
      onMouseLeave={() => setShowHoverRemove(false)}
    >
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-6">
          <div className="flex-1 min-w-0">
            {/* Order ID - Prominently displayed */}
            <div className="mb-3">
              <div className="text-xs font-semibold text-gray-900 uppercase tracking-wide mb-1">
                Order ID
              </div>
              <div className="text-xl font-bold text-orange-600 bg-orange-50 px-3 py-1 rounded-lg inline-block">
                #{order.id.slice(-6).toUpperCase()}
              </div>
            </div>

            <div className="flex items-center gap-3 mb-2">
              <h3 className="font-semibold text-lg text-gray-900">Counter {order.table_number}</h3>
            </div>
            <div className="flex items-center gap-3 mb-2">
              <Badge variant="secondary" className="text-xs px-2 py-1 bg-orange-50 text-orange-700">
                <User className="h-3 w-3 mr-1" />
                Counter Order
              </Badge>
              <div className="text-sm text-gray-900">{formatTime(order.created_at)}</div>
            </div>
          </div>
          <div className="text-right ml-4 flex items-center gap-2">
            {/* Total Amount - More prominent */}
            <div className="text-right">
              <div className="text-xs font-semibold text-gray-900 uppercase tracking-wide mb-1">
                Total
              </div>
              <div className="text-3xl font-bold text-green-600 bg-green-50 px-4 py-2 rounded-lg">
                £{getTotalAmount()}
              </div>
            </div>
            {/* Remove Order Button - appears on hover */}
            <div
              className={`transition-opacity duration-200 ${showHoverRemove ? "opacity-100" : "opacity-0"}`}
            >
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                      onClick={handleRemoveOrder}
                      disabled={isRemoving}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Remove Order</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
        </div>

        {/* Customer Info - More prominent */}
        {order.customer_name && (
          <div className="mb-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
            <div className="text-xs font-semibold text-gray-900 uppercase tracking-wide mb-1">
              Customer
            </div>
            <div className="flex items-center gap-2">
              <User className="h-5 w-5 text-gray-900" />
              <span className="text-lg font-bold text-gray-900">{order.customer_name}</span>
              {order.customer_phone && (
                <span className="text-sm text-gray-900 ml-2">• {order.customer_phone}</span>
              )}
            </div>
          </div>
        )}

        {/* Status Badges */}
        <div className="flex items-center flex-wrap gap-2 mb-6">
          <Badge
            className={`${getStatusColor(order.order_status)} text-xs font-semibold px-3 py-1.5 rounded-full whitespace-nowrap`}
          >
            {order.order_status.replace("_", " ")}
          </Badge>
          <Badge
            className={`${getPaymentStatusColor(order.payment_status)} text-xs font-semibold px-3 py-1.5 rounded-full whitespace-nowrap`}
          >
            {order.payment_status}
          </Badge>
        </div>

        {/* Order Items */}
        {order.items && order.items.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-gray-700 mb-3">Order Items</h4>
            <div className="space-y-2">
              {order.items.map((item, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center text-xs font-bold text-gray-900 border border-gray-200">
                      {item.quantity}
                    </div>
                    <span className="font-medium text-gray-900">{item.item_name}</span>
                  </div>
                  <span className="font-semibold text-gray-900">
                    £{formatPrice(normalizePrice(item.price))}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Payment Actions */}
        {order.payment_status === "UNPAID" && (
          <div className="mt-6 pt-4 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-900">
                <span className="font-medium">Payment Required:</span> £{getTotalAmount()}
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handlePayment("till")}
                  disabled={isProcessingPayment}
                  className="text-green-600 border-green-200 hover:bg-green-50"
                >
                  <CheckCircle className="h-4 w-4 mr-1" />
                  Till Payment
                </Button>
                <Button
                  size="sm"
                  onClick={() => handlePayment("card")}
                  disabled={isProcessingPayment}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <CreditCard className="h-4 w-4 mr-1" />
                  Card Payment
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Order Status Actions */}
        {order.payment_status === "PAID" && order.order_status !== "COMPLETED" && (
          <div className="mt-6 pt-4 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <div className="text-sm text-blue-600">
                <span className="font-medium">Payment Complete - Ready for next step</span>
              </div>
              <Button
                size="sm"
                onClick={() => handleStatusUpdate(getNextOrderStatus(order.order_status))}
                disabled={isProcessingPayment}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <CheckCircle className="h-4 w-4 mr-1" />
                {getNextStatusLabel(order.order_status)}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
