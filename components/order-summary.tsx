"use client";

import { useState, useEffect } from "react";
import {
  Check,
  Clock,
  User,
  Receipt,
  Star,
  ChefHat,
  CheckCircle,
  Truck,
  UtensilsCrossed,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import UnifiedFeedbackForm from "@/components/UnifiedFeedbackForm";
import { supabaseBrowser as createClient } from "@/lib/supabase";
import { Order, OrderStatus } from "@/types/order";
import { ReceiptModal } from "@/components/receipt/ReceiptModal";
import { logger } from "@/lib/logger";

interface OrderSummaryProps {
  orderId?: string;
  sessionId?: string;
  orderData?: Order;
}

interface OrderTimelineItem {
  status: OrderStatus;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  timestamp?: string;
  completed: boolean;
  current: boolean;
}

const ORDER_STATUSES: Record<
  OrderStatus | "SERVED",
  { label: string; icon: React.ComponentType<{ className?: string }>; color: string }
> = {
  PLACED: { label: "Order Placed", icon: Receipt, color: "bg-blue-100 text-blue-800" },
  ACCEPTED: { label: "Order Accepted", icon: CheckCircle, color: "bg-green-100 text-green-800" },
  IN_PREP: { label: "Preparing", icon: ChefHat, color: "bg-orange-100 text-orange-800" },
  READY: {
    label: "Ready for Pickup",
    icon: UtensilsCrossed,
    color: "bg-purple-100 text-purple-800",
  },
  SERVING: { label: "Serving", icon: Truck, color: "bg-indigo-100 text-indigo-800" },
  SERVED: { label: "Served", icon: CheckCircle, color: "bg-indigo-100 text-indigo-800" },
  COMPLETED: { label: "Completed", icon: Check, color: "bg-green-100 text-green-800" },
  CANCELLED: { label: "Cancelled", icon: Check, color: "bg-red-100 text-red-800" },
};

export default function OrderSummary({ orderId, sessionId, orderData }: OrderSummaryProps) {
  const [order, setOrder] = useState<Order | null>(orderData || null);
  const [loading, setLoading] = useState(!orderData);
  const [error, setError] = useState<string | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [showReceipt, setShowReceipt] = useState(false);
  const [venueInfo, setVenueInfo] = useState<{
    name?: string;
    email?: string;
    address?: string;
    logoUrl?: string;
    primaryColor?: string;
  }>({});

  // Generate short order number for display
  const getShortOrderNumber = (orderId: string) => {
    return orderId.slice(-6).toUpperCase();
  };

  // Get payment success message based on payment method
  const getPaymentSuccessMessage = (paymentMethod: string, paymentStatus: string) => {
    if (paymentStatus === "PAID") {
      if (paymentMethod === "demo" || paymentMethod === "stripe") {
        return {
          title: "✅ Payment Successful",
          description: "Your order has been confirmed and sent to the kitchen.",
        };
      } else if (paymentMethod === "till" || paymentMethod === "later") {
        return {
          title: "✅ Order Created Successfully",
          description: "Your order has been placed and will be prepared.",
        };
      }
    }
    return {
      title: "✅ Order Confirmed",
      description: "Your order has been received and is being processed.",
    };
  };

  // Fetch order data
  useEffect(() => {
    if (orderData) {
      setOrder(orderData);
      setLoading(false);
      return;
    }

    if (!orderId && !sessionId) {
      setError("No order information provided");
      setLoading(false);
      return;
    }

    const fetchOrder = async () => {
      try {
        setLoading(true);

        if (sessionId) {
          // Fetch order by Stripe session ID
          const res = await fetch(`/api/orders/by-session/${sessionId}`);

          if (res.ok) {
            const data = await res.json();

            if (data.ok && data.order) {
              setOrder(data.order);
            } else {
              throw new Error("Order not found for this session");
            }
          } else {
            const errorData = await res.json();
            throw new Error(
              `Failed to fetch order by session ID: ${errorData.error || "Unknown error"}`
            );
          }
        } else if (orderId) {
          // Fetch order by ID with retry logic (for race conditions after Stripe payment)

          let retryCount = 0;
          const maxRetries = 3;
          let fetchSuccess = false;

          while (!fetchSuccess && retryCount < maxRetries) {
            if (retryCount > 0) {
              await new Promise((resolve) => setTimeout(resolve, 1000));
            }

            const res = await fetch(`/api/orders/${orderId}`);

            if (res.ok) {
              const data = await res.json();

              if (data.order) {
                setOrder(data.order);
                fetchSuccess = true;
              } else {
                retryCount++;
              }
            } else {
              if (res.status === 404 && retryCount < maxRetries - 1) {
                retryCount++;
              } else {
                const errorData = await res.json();
                throw new Error(`Failed to fetch order: ${errorData.error || "Unknown error"}`);
              }
            }
          }

          if (!fetchSuccess) {
            throw new Error(`Order not found after ${maxRetries} attempts`);
          }
        }
      } catch {
        setError("Failed to load order details");
      } finally {
        setLoading(false);
      }
    };

    fetchOrder();
  }, [orderId, sessionId, orderData]);

  // Fetch venue info and logo when order is loaded
  useEffect(() => {
    if (!order?.venue_id) return;

    const fetchVenueInfo = async () => {
      try {
        const supabase = createClient();
        
        // Get logo from menu design settings
        const { data: designSettings } = await supabase
          .from("menu_design_settings")
          .select("logo_url, detected_primary_color, primary_color")
          .eq("venue_id", order.venue_id)
          .single();

        // Get venue contact info
        const { data: venue } = await supabase
          .from("venues")
          .select("venue_name, venue_email, venue_address")
          .eq("venue_id", order.venue_id)
          .single();

        const logoUrl = designSettings?.logo_url;
        const primaryColor = designSettings?.detected_primary_color || designSettings?.primary_color || "#8b5cf6";

        setVenueInfo({
          name: venue?.venue_name || undefined,
          email: venue?.venue_email || undefined,
          address: venue?.venue_address || undefined,
          logoUrl,
          primaryColor,
        });
      } catch (error) {
        logger.error("[ORDER SUMMARY] Error fetching venue info:", {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    };

    fetchVenueInfo();
  }, [order?.venue_id]);

  // Set up real-time subscription for order updates
  useEffect(() => {
    if (!order?.id) return;

    const supabase = createClient();
    if (!supabase) return;

    const channel = supabase
      .channel(`order-summary-${order.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
          filter: `id=eq.${order.id}`,
        },
        (payload: { eventType: string; new?: Partial<Order>; old?: Partial<Order> }) => {
          if (payload.eventType === "UPDATE" && payload.new) {
            setOrder((prevOrder) => {
              if (!prevOrder) return null;
              return { ...prevOrder, ...payload.new } as Order;
            });

            setLastUpdate(new Date());
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [order?.id]);

  // Generate timeline items
  const getTimelineItems = (): OrderTimelineItem[] => {
    const statusOrder: (OrderStatus | "SERVED")[] = [
      "PLACED",
      "ACCEPTED",
      "IN_PREP",
      "READY",
      "SERVED",
      "COMPLETED",
    ];
    const currentStatus = order?.order_status || "PLACED";
    // Map SERVING to SERVED for timeline display
    const displayStatus: OrderStatus | "SERVED" = currentStatus === "SERVING" ? "SERVED" : currentStatus;
    const currentIndex = statusOrder.indexOf(displayStatus);

    return statusOrder.map((status, index) => {
      const statusInfo = ORDER_STATUSES[status] || ORDER_STATUSES["SERVING"]; // Fallback
      const completed = index <= currentIndex;
      const current = index === currentIndex;

      return {
        status: status as OrderStatus,
        label: statusInfo.label,
        icon: statusInfo.icon,
        completed,
        current,
      };
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Loading your order...</h2>
            <p className="text-gray-900">Please wait while we fetch your order details.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center">
            <div className="h-12 w-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-red-600 text-xl">⚠️</span>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Order Not Found</h2>
            <p className="text-gray-900">{error || "We couldn't find your order details."}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const paymentMessage = getPaymentSuccessMessage(
    order.payment_method || "unknown",
    order.payment_status
  );
  const timelineItems = getTimelineItems();

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 p-4">
      <div className="max-w-2xl mx-auto">
        {/* Success Header */}
        <Card className="mb-6 border-green-200 bg-green-50">
          <CardContent className="p-6 text-center">
            <div className="h-16 w-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="h-8 w-8 text-green-600" />
            </div>
            <h1 className="text-2xl font-bold text-green-800 mb-2">{paymentMessage.title}</h1>
            <p className="text-green-700">{paymentMessage.description}</p>
          </CardContent>
        </Card>

        {/* Customer Details */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Customer Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-900">Customer Name</p>
                <p className="font-semibold">{order.customer_name || "Not provided"}</p>
              </div>
              {order.customer_phone && (
                <div>
                  <p className="text-sm text-gray-900">Phone Number</p>
                  <p className="font-semibold">{order.customer_phone}</p>
                </div>
              )}
              <div>
                <p className="text-sm text-gray-900">Order Number</p>
                <p className="font-semibold">#{getShortOrderNumber(order.id)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-900">Table</p>
                <p className="font-semibold">{order.table_number || "N/A"}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Order Items */}
        {order.items && order.items.length > 0 && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Order Items</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {order.items.map((item, index) => (
                  <div
                    key={index}
                    className="flex justify-between items-start py-3 border-b border-gray-100 last:border-b-0"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        {item.image_url && (
                          <div
                            className="bg-white rounded-lg border border-gray-200 overflow-hidden"
                            style={{ width: "60px", height: "60px" }}
                          >
                            <img
                              src={item.image_url}
                              alt={item.item_name}
                              className="w-full h-full object-cover"
                              style={{ objectPosition: "center" }}
                            />
                          </div>
                        )}
                        <div>
                          <p className="font-medium">{item.item_name || `Item ${index + 1}`}</p>
                          <p className="text-sm text-gray-900">Quantity: {item.quantity}</p>
                          {item.special_instructions && (
                            <p className="text-sm text-blue-600 italic">
                              Note: {item.special_instructions}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">£{(item.price * item.quantity).toFixed(2)}</p>
                      <p className="text-sm text-gray-900">£{item.price.toFixed(2)} each</p>
                    </div>
                  </div>
                ))}

                {/* Total */}
                <div className="pt-4 border-t-2 border-gray-200">
                  <div className="flex justify-between items-center">
                    <p className="text-lg font-bold">Total</p>
                    <p className="text-lg font-bold">£{order.total_amount?.toFixed(2) || "0.00"}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Order Timeline */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Order Timeline
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {timelineItems.map((item) => {
                const Icon = item.icon as React.ComponentType<{ className?: string }> | undefined;
                return (
                  <div key={item.status} className="flex items-center gap-4">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        item.completed
                          ? "bg-green-100 text-green-600"
                          : item.current
                            ? "bg-blue-100 text-blue-600"
                            : "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {Icon && <Icon className="h-5 w-5" />}
                    </div>
                    <div className="flex-1">
                      <p
                        className={`font-medium ${
                          item.completed
                            ? "text-green-800"
                            : item.current
                              ? "text-blue-800"
                              : "text-gray-900"
                        }`}
                      >
                        {item.label}
                      </p>
                      {item.current && <p className="text-sm text-blue-600">In progress</p>}
                    </div>
                    {item.completed && <Check className="h-5 w-5 text-green-600" />}
                  </div>
                );
              })}
            </div>
            <div className="mt-4 text-xs text-gray-900 text-center">
              Last updated: {lastUpdate.toLocaleTimeString()}
            </div>
          </CardContent>
        </Card>

        {/* Feedback Section */}
        {!showFeedback && !feedbackSubmitted && (
          <Card className="mb-6">
            <CardContent className="p-6 text-center">
              <Star className="h-8 w-8 text-yellow-500 mx-auto mb-3" />
              <h3 className="text-lg font-semibold mb-2">How was your experience?</h3>
              <p className="text-gray-900 mb-4">
                We&apos;d love to hear your feedback to help us improve our service.
              </p>
              <Button onClick={() => setShowFeedback(true)} variant="outline" className="w-full">
                Leave Feedback
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Feedback Form */}
        {showFeedback && !feedbackSubmitted && order && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Share Your Feedback</CardTitle>
            </CardHeader>
            <CardContent>
              <UnifiedFeedbackForm
                orderId={order.id}
                venueId={order.venue_id}
                customerName={order.customer_name || undefined}
                customerPhone={order.customer_phone || undefined}
                onSubmit={() => {
                  setFeedbackSubmitted(true);
                  setShowFeedback(false);
                }}
              />
            </CardContent>
          </Card>
        )}

        {/* Thank You Message */}
        {feedbackSubmitted && (
          <Card className="mb-6 border-green-200 bg-green-50">
            <CardContent className="p-6 text-center">
              <Check className="h-8 w-8 text-green-600 mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-green-800 mb-2">
                Thank you for your feedback!
              </h3>
              <p className="text-green-700">Your input helps us provide better service.</p>
            </CardContent>
          </Card>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4">
          <Button onClick={() => setShowReceipt(true)} variant="outline" className="flex-1">
            <Receipt className="h-4 w-4 mr-2" />
            View Receipt
          </Button>
          <Button
            onClick={() => {
              const orderObj = order as
                | { venue_id?: string; table_number?: number }
                | null
                | undefined;
              window.location.href = `/order?venue=${orderObj?.venue_id || "demo-cafe"}&table=${orderObj?.table_number || 1}`;
            }}
            variant="outline"
            className="flex-1"
          >
            Place Another Order
          </Button>
          <Button onClick={() => window.close()} className="flex-1">
            Close
          </Button>
        </div>
      </div>

      {/* Receipt Modal */}
      {order && (
        <ReceiptModal
          order={order}
          venueEmail={venueInfo.email}
          venueAddress={venueInfo.address}
          logoUrl={venueInfo.logoUrl}
          primaryColor={venueInfo.primaryColor}
          isOpen={showReceipt}
          onClose={() => setShowReceipt(false)}
          isCustomerView={true}
        />
      )}
    </div>
  );
}
