"use client";

import { useState } from "react";
import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, User, Hash, MapPin, CreditCard, CheckCircle, X, QrCode, Receipt } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

import { OrderForCard } from "@/types/orders";
import { deriveEntityKind, shouldShowUnpaidChip } from "@/lib/orders/entity-types";
import { OrderStatusChip, PaymentStatusChip } from "@/components/ui/chips";
import { formatCurrency, formatOrderTime } from "@/lib/orders/mapOrderToCardData";
import { supabaseBrowser as createClient } from "@/lib/supabase";
import { PaymentCollectionDialog } from "./PaymentCollectionDialog";
import { TablePaymentDialog } from "./TablePaymentDialog";
import { ReceiptModal } from "@/components/receipt/ReceiptModal";
import { Order } from "@/types/order";
import { Users } from "lucide-react";

interface OrderCardProps {
  order: OrderForCard;
  variant?: "table" | "counter" | "auto";
  venueId?: string;
  showActions?: boolean;
  onActionComplete?: () => void;
  className?: string;
}

export function OrderCard({
  order,
  variant = "auto",
  venueId,
  showActions = true,
  onActionComplete,
  className = "",
}: OrderCardProps) {
  const [showHoverRemove, setShowHoverRemove] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [showTablePaymentDialog, setShowTablePaymentDialog] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [tableUnpaidCount, setTableUnpaidCount] = useState<number | null>(null);
  const [venueInfo, setVenueInfo] = useState<{
    name?: string;
    email?: string;
    address?: string;
    logoUrl?: string;
    primaryColor?: string;
  }>({});

  // Determine variant automatically if not specified
  const finalVariant =
    variant === "auto" ? (deriveEntityKind(order) === "table" ? "table" : "counter") : variant;

  const isTableVariant = finalVariant === "table";

  // Fetch table unpaid count for "Pay Entire Table" button
  React.useEffect(() => {
    if (!venueId || !order.table_number) return;

    const fetchTableUnpaidCount = async () => {
      try {
        const supabase = createClient();
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const todayEnd = new Date();
        todayEnd.setHours(23, 59, 59, 999);

        const { count } = await supabase
          .from("orders")
          .select("*", { count: "exact", head: true })
          .eq("venue_id", venueId)
          .eq("table_number", order.table_number)
          .in("payment_status", ["UNPAID", "PAY_LATER"])
          .gte("created_at", todayStart.toISOString())
          .lte("created_at", todayEnd.toISOString());

        setTableUnpaidCount(count || 0);
      } catch {
        // Silently fail
      }
    };

    fetchTableUnpaidCount();
  }, [venueId, order.table_number]);

  // Fetch venue info and logo for receipt
  React.useEffect(() => {
    if (!venueId) return;

    const fetchVenueInfo = async () => {
      try {
        const supabase = createClient();
        
        // Get logo from menu design settings
        const { data: designSettings } = await supabase
          .from("menu_design_settings")
          .select("logo_url, detected_primary_color, primary_color")
          .eq("venue_id", venueId)
          .single();

        // Get venue contact info
        const { data: venue } = await supabase
          .from("venues")
          .select("venue_name, venue_email, venue_address")
          .eq("venue_id", venueId)
          .single();

        const logoUrl = designSettings?.logo_url;
        const primaryColor = designSettings?.detected_primary_color || designSettings?.primary_color || "#8b5cf6";

        setVenueInfo({
          name: venue?.venue_name,
          email: venue?.venue_email,
          address: venue?.venue_address,
          logoUrl,
          primaryColor,
        });
      } catch {
        // Silently fail - venue info is optional
      }
    };

    fetchVenueInfo();
  }, [venueId]);

  // Convert OrderForCard to Order type for ReceiptModal
  const convertToOrder = (): Order | null => {
    if (!order) return null;

    // Normalize payment status to uppercase PaymentStatus type
    const normalizePaymentStatus = (status: string): Order["payment_status"] => {
      const upper = status.toUpperCase();
      if (upper === "PAID" || upper === "UNPAID" || upper === "REFUNDED" || upper === "PARTIALLY_PAID") {
        return upper as Order["payment_status"];
      }
      return "UNPAID";
    };

    // Normalize payment method
    const normalizePaymentMethod = (mode: string): Order["payment_method"] => {
      const normalized = mode.replace("_", " ").toLowerCase();
      if (normalized === "demo" || normalized === "stripe" || normalized === "till" || normalized === "cash" || normalized === "card") {
        return normalized as Order["payment_method"];
      }
      return null;
    };

    return {
      id: order.id,
      venue_id: venueId || "",
      table_number: order.table_number || undefined,
      customer_name: order.customer?.name || order.customer_name || undefined,
      customer_phone: order.customer?.phone || order.customer_phone || undefined,
      customer_email: undefined, // Not available in OrderForCard
      items: order.items?.map((item) => ({
        menu_item_id: item.menu_item_id || "",
        item_name: (item as { item_name?: string }).item_name || "Item",
        quantity: item.quantity,
        price: item.price,
        special_instructions: (item as { specialInstructions?: string }).specialInstructions,
      })) || [],
      total_amount: order.total_amount,
      order_status: order.order_status.toUpperCase() as Order["order_status"],
      payment_status: normalizePaymentStatus(order.payment.status),
      payment_method: normalizePaymentMethod(order.payment.mode),
      created_at: order.placed_at,
    };
  };

  // Get appropriate label and icon
  const getEntityDisplay = () => {
    if (isTableVariant) {
      // For table orders, prioritize table_label, then generate from table_number
      let label = order.table_label;
      if (!label && order.table_number) {
        label = `Table ${order.table_number}`;
      }
      if (!label) {
        label = "Table Order";
      }
      return {
        icon: <MapPin className="h-4 w-4" />,
        label,
        badgeColor: "bg-blue-50 text-blue-700 border-blue-200",
        type: "Table Order",
      };
    } else {
      return {
        icon: <Hash className="h-4 w-4" />,
        label: order.counter_label || "Counter A",
        badgeColor: "bg-orange-50 text-orange-700 border-orange-200",
        type: "Counter Order",
      };
    }
  };

  const { icon, label, badgeColor, type } = getEntityDisplay();

  // Handle order actions
  const handleRemoveOrder = async () => {
    if (!venueId) return;

    try {
      setIsProcessing(true);
      const response = await fetch("/api/orders/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          orderId: order.id,
          venue_id: venueId,
        }),
      });

      if (!response.ok) throw new Error("Failed to delete order");
      onActionComplete?.();
    } catch {
      // Error silently handled
    } finally {
      setIsProcessing(false);
    }
  };

  const handleStatusUpdate = async (nextStatusRaw: string) => {
    if (!venueId) {
      alert("Error: Venue ID missing. Please refresh the page.");
      return;
    }

    const nextStatus = (nextStatusRaw || "").toUpperCase();

    try {
      setIsProcessing(true);

      if (nextStatus === "SERVED") {
        // Use server endpoint for serving to ensure related side-effects
        const response = await fetch("/api/orders/serve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId: order.id }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Failed to mark order as served: ${response.status} - ${errorText}`);
        }

        const result = await response.json().catch(() => null);
      } else if (nextStatus === "COMPLETED") {
        // Use server endpoint for completing to clear tables
        const response = await fetch("/api/orders/complete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId: order.id }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Failed to mark order as completed: ${response.status} - ${errorText}`);
        }

        const result = await response.json().catch(() => null);
      } else {
        // Directly update status via Supabase for other transitions
        const supabase = createClient();
        const { error } = await supabase
          .from("orders")
          .update({
            order_status: nextStatus,
            updated_at: new Date().toISOString(),
          })
          .eq("id", order.id)
          .eq("venue_id", venueId);
        if (error) {
          throw new Error(`Failed to update order status: ${error.message}`);
        }
      }

      await onActionComplete?.();
    } catch (_error) {
      alert(`Error: ${_error instanceof Error ? _error.message : "Failed to update order status"}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Order action buttons
  const renderActions = () => {
    if (!showActions || !venueId) return null;

    // Check payment status - handle both nested payment object and flat payment_status
    const paymentStatus = (order.payment?.status || order.payment_status || "unpaid").toUpperCase();
    const isPaid = paymentStatus === "PAID" || paymentStatus === "TILL";
    const isCompleted = (order.order_status || "").toUpperCase() === "COMPLETED";
    // Normalize order status - handle both uppercase and lowercase, and "served" vs "serving"
    const rawStatus = (order.order_status || "").toString();
    const orderStatus = rawStatus.toUpperCase();
    const paymentMode = order.payment?.mode || order.payment_mode; // "online", "pay_at_till", "pay_later"

    // If already completed, no actions needed
    if (isCompleted) {
      return null;
    }

    // If order is IN_PREP or PREPARING, show preparing message (not clickable)
    if (orderStatus === "IN_PREP" || orderStatus === "PREPARING") {
      return (
        <div className="mt-4 pt-4 border-t border-slate-200">
          <div className="flex items-center justify-center gap-2 p-3 bg-blue-50 rounded-lg">
            <Clock className="h-4 w-4 text-blue-600 animate-pulse" />
            <span className="text-sm font-medium text-blue-700">Preparing in Kitchen...</span>
          </div>
        </div>
      );
    }

    // If order is READY, show "Mark Served" button
    if (orderStatus === "READY") {
      return (
        <div className="mt-4 pt-4 border-t border-slate-200">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="text-sm text-blue-600">
              <span className="font-medium">Kitchen Ready - Mark as Served</span>
            </div>
            <Button
              size="sm"
              onClick={() => handleStatusUpdate("SERVED")}
              disabled={isProcessing}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <CheckCircle className="h-4 w-4 mr-1" />
              Mark Served
            </Button>
          </div>
        </div>
      );
    }

    // If order is SERVING, SERVED, or lowercase "served", check payment status before allowing completion
    const isServed =
      orderStatus === "SERVING" || orderStatus === "SERVED" || rawStatus.toLowerCase() === "served";
    if (isServed) {
      // CASE 1: Already paid (online/stripe) - can mark completed immediately
      if (isPaid) {
        return (
          <div className="mt-4 pt-4 border-t border-slate-200">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="text-sm text-green-600">
                <span className="font-medium">✓ Paid & Served - Ready to Complete</span>
              </div>
              <Button
                size="sm"
                onClick={() => handleStatusUpdate("COMPLETED")}
                disabled={isProcessing}
                className="bg-green-600 hover:bg-green-700"
              >
                <CheckCircle className="h-4 w-4 mr-1" />
                Mark Complete
              </Button>
            </div>
          </div>
        );
      }

      // CASE 2: Pay at Till - staff must collect payment
      if (paymentMode === "pay_at_till") {
        const hasMultipleUnpaid = tableUnpaidCount !== null && tableUnpaidCount > 1;
        return (
          <div className="mt-4 pt-4 border-t border-slate-200">
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="text-sm text-orange-600">
                  <span className="font-medium">Served - Unpaid</span>
                  {hasMultipleUnpaid && (
                    <span className="ml-2 text-xs">
                      ({tableUnpaidCount} unpaid orders at table)
                    </span>
                  )}
                </div>
                <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
                  Unpaid - {formatCurrency(order.total_amount, order.currency)}
                </Badge>
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                {hasMultipleUnpaid && (
                  <Button
                    size="sm"
                    onClick={() => setShowTablePaymentDialog(true)}
                    disabled={isProcessing}
                    variant="outline"
                    className="w-full sm:w-auto border-purple-200 text-purple-700 hover:bg-purple-50"
                  >
                    <Users className="h-4 w-4 mr-2" />
                    Pay Entire Table
                  </Button>
                )}
                <Button
                  size="sm"
                  onClick={() => setShowPaymentDialog(true)}
                  disabled={isProcessing}
                  variant="servio"
                  className="w-full sm:w-auto"
                >
                  <CreditCard className="h-4 w-4 mr-2" />
                  Collect Payment at Till
                </Button>
              </div>
            </div>
          </div>
        );
      }

      // CASE 3: Pay Later - customer must rescan QR and pay
      if (paymentMode === "pay_later") {
        return (
          <div className="mt-4 pt-4 border-t border-slate-200">
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="text-sm text-blue-600">
                  <span className="font-medium">Served - Unpaid</span>
                </div>
                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                  Pay Later - {formatCurrency(order.total_amount, order.currency)}
                </Badge>
              </div>
              <div className="bg-blue-50 rounded-lg p-3 text-sm text-gray-700">
                <p className="font-medium mb-1 flex items-center gap-2">
                  <QrCode className="h-4 w-4" />
                  Customer can rescan QR code to pay
                </p>
                <p className="text-xs text-gray-600">
                  When customer rescans QR code, they will see their unpaid orders and can pay from the order page.
                </p>
              </div>
            </div>
          </div>
        );
      }
    }

    // Default: no actions
    return null;
  };


  return (
    <Card
      className={`rounded-xl border border-slate-200 bg-white shadow-sm hover:shadow-md transition-shadow ${className}`}
      onMouseEnter={() => setShowHoverRemove(true)}
      onMouseLeave={() => setShowHoverRemove(false)}
    >
      <CardContent className="p-6">
        {/* Header Section */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1 min-w-0">
            {/* Order ID and Time */}
            <div className="flex items-center gap-3 mb-3">
              <Badge variant="outline" className="text-sm font-semibold px-3 py-1">
                #{order.short_id}
              </Badge>
              <div className="flex items-center gap-1 text-sm text-slate-500">
                <Clock className="h-4 w-4" />
                {formatOrderTime(order.placed_at)}
              </div>
            </div>

            {/* Entity Badge and Status */}
            <div className="flex items-center gap-3 mb-4">
              <Badge className={`inline-flex items-center text-sm px-3 py-1.5 ${badgeColor}`}>
                {icon}
                <span className="ml-2 font-medium">{label}</span>
                <span className="ml-2 text-xs opacity-75">({type})</span>
              </Badge>

              {/* Status Chips */}
              <div className="flex items-center gap-2">
                <OrderStatusChip status={order.order_status} />
                {shouldShowUnpaidChip(order) && <PaymentStatusChip status="unpaid" />}
                {order.payment.status === "paid" && <PaymentStatusChip status="paid" />}
                {order.payment.status === "failed" && <PaymentStatusChip status="failed" />}
                {order.payment.status === "refunded" && <PaymentStatusChip status="refunded" />}
              </div>
            </div>
          </div>

          {/* Total Amount and Action Buttons */}
          <div className="flex items-center gap-2">
            <div className="text-right">
              <div className="text-2xl font-bold text-green-600">
                {formatCurrency(order.total_amount, order.currency)}
              </div>
            </div>

            {/* Receipt Button */}
            {showActions && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-purple-600 hover:text-purple-700 hover:bg-purple-50"
                      onClick={() => setShowReceipt(true)}
                    >
                      <Receipt className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>View Receipt</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}

            {/* Remove Button - On Hover */}
            {showActions && venueId && (
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
                        disabled={isProcessing}
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
            )}
          </div>
        </div>

        {/* Customer Info */}
        {order.customer?.name && (
          <div className="mb-4 p-3 bg-slate-50 rounded-lg border border-slate-200">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-slate-600" />
              <span className="font-semibold text-slate-900">{order.customer.name}</span>
              {order.customer.phone && (
                <span className="text-sm text-slate-600 ml-2">• {order.customer.phone}</span>
              )}
            </div>
          </div>
        )}

        {/* Items Preview */}
        {order.items_preview && (
          <div className="mb-4">
            <div className="text-sm font-medium text-slate-700 mb-2">Order Items</div>
            <div className="text-sm text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-200">
              {order.items_preview}
            </div>
          </div>
        )}

        {/* Action Section */}
        {renderActions()}
      </CardContent>

      {/* Payment Collection Dialog (for pay_at_till orders) */}
      {venueId && (
        <>
          <PaymentCollectionDialog
            open={showPaymentDialog}
            onOpenChange={setShowPaymentDialog}
            orderId={order.id}
            orderNumber={order.short_id}
            customerName={order.customer_name || "Customer"}
            totalAmount={order.total_amount}
            venueId={venueId}
            items={
              order.items?.map((item: Record<string, unknown>) => ({
                item_name: (item.item_name as string) || (item.name as string) || "Item",
                quantity: (item.quantity as number) || (item.qty as number) || 1,
                price: (item.price as number) || (item.unit_price as number) || 0,
              })) || []
            }
            onSuccess={async () => {
              setShowPaymentDialog(false);
              // Refresh order data to get updated payment status
              // This will trigger a re-render showing "Mark Completed" button
              await onActionComplete?.();
            }}
          />
          {/* Table Payment Dialog (for paying entire table) */}
          {order.table_number && (
            <TablePaymentDialog
              open={showTablePaymentDialog}
              onOpenChange={setShowTablePaymentDialog}
              tableNumber={order.table_number}
              venueId={venueId}
              onSuccess={async () => {
                setShowTablePaymentDialog(false);
                await onActionComplete?.();
              }}
            />
          )}
        </>
      )}

      {/* Receipt Modal */}
      {convertToOrder() && (
        <ReceiptModal
          order={convertToOrder()!}
          venueEmail={venueInfo.email}
          venueAddress={venueInfo.address}
          logoUrl={venueInfo.logoUrl}
          primaryColor={venueInfo.primaryColor}
          isOpen={showReceipt}
          onClose={() => setShowReceipt(false)}
          isCustomerView={false}
        />
      )}
    </Card>
  );
}

// Convenience wrapper that automatically determines variant
export function AutoOrderCard(props: Omit<OrderCardProps, "variant">) {
  return <OrderCard {...props} variant="auto" />;
}
