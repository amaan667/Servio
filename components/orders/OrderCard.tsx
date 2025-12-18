"use client";

import { useState } from "react";
import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Clock,
  User,
  Hash,
  MapPin,
  CreditCard,
  CheckCircle,
  X,
  QrCode,
  Receipt,
} from "lucide-react";
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
import { logger } from "@/lib/logger";

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
  const [allTicketsBumped, setAllTicketsBumped] = useState<boolean | null>(null);
  const [checkingTickets, setCheckingTickets] = useState(false);
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
          .eq("payment_status", "UNPAID")
          .in("payment_method", ["PAY_LATER", "PAY_AT_TILL"])
          .gte("created_at", todayStart.toISOString())
          .lte("created_at", todayEnd.toISOString());

        setTableUnpaidCount(count || 0);
      } catch {
        // Silently fail
      }
    };

    fetchTableUnpaidCount();
  }, [venueId, order.table_number]);

  // Helper function to check ticket status (used by real-time subscriptions and polling)
  const triggerTicketCheck = React.useCallback(async () => {
    if (!venueId || !order.id) return;

    try {
      setCheckingTickets(true);
      const response = await fetch("/api/kds/tickets/check-bumped", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          order_id: order.id,
          venue_id: venueId,
        }),
      });
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          const allBumped = data.data?.all_bumped ?? false;
          logger.debug("[ORDER CARD] Check bumped result", {
            orderId: order.id,
            allBumped,
            ticketCount: data.data?.ticket_count,
            bumpedCount: data.data?.bumped_count,
          });
          setAllTicketsBumped(allBumped);
        } else {
          logger.debug("[ORDER CARD] Check bumped API returned success=false", {
            orderId: order.id,
            error: data.error,
          });
          // If API fails, default to false (not ready) to prevent premature "Mark Served"
          setAllTicketsBumped(false);
        }
      } else {
        // Log the error response for debugging
        const errorText = await response.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = errorText;
        }
        logger.debug("[ORDER CARD] Check bumped failed", {
          orderId: order.id,
          venueId,
          status: response.status,
          error: errorData,
        });
        // If API fails, default to false (not ready) to prevent premature "Mark Served"
        setAllTicketsBumped(false);
      }
    } catch (error) {
      logger.debug("[ORDER CARD] Check bumped error", {
        orderId: order.id,
        error: error instanceof Error ? error.message : String(error),
      });
      // Silently fail - default to false (not ready) to prevent premature "Mark Served"
      setAllTicketsBumped(false);
    } finally {
      setCheckingTickets(false);
    }
  }, [venueId, order.id]);

  // Check if all KDS tickets are bumped for this order
  React.useEffect(() => {
    if (!venueId || !order.id) return;

    // Check ticket status for orders that:
    // 1. Are not completed/cancelled/refunded
    // 2. Are in a status where we need to check if items are ready (PLACED, IN_PREP, PREPARING, READY)
    // 3. Have payment status PAID or UNPAID
    const orderStatus = (order.order_status || "").toUpperCase();
    const paymentStatus = (order.payment?.status || order.payment_status || "unpaid").toUpperCase();
    const isCompletable = !["COMPLETED", "CANCELLED", "REFUNDED"].includes(orderStatus);
    const needsTicketCheck = ["PLACED", "IN_PREP", "PREPARING", "READY"].includes(orderStatus);
    const isPaidOrUnpaid = ["PAID", "UNPAID"].includes(paymentStatus);

    if (isCompletable && needsTicketCheck && isPaidOrUnpaid) {
      triggerTicketCheck();
      // Set up polling to check ticket status periodically (every 3 seconds for faster updates)
      const interval = setInterval(() => {
        triggerTicketCheck();
      }, 3000);

      return () => clearInterval(interval);
    } else {
      // If order is SERVED or COMPLETED, we don't need to check tickets anymore
      setAllTicketsBumped(null);
    }
  }, [
    venueId,
    order.id,
    order.order_status,
    order.payment?.status,
    order.payment_status,
    triggerTicketCheck,
  ]);

  // Listen for payment updates to refresh order data
  React.useEffect(() => {
    if (!venueId || !order.id) return;

    const handlePaymentUpdate = (event: CustomEvent) => {
      if (event.detail?.orderId === order.id) {
        // Trigger a refresh by calling onActionComplete
        onActionComplete?.();
      }
    };

    if (typeof window !== "undefined") {
      window.addEventListener("order-payment-updated", handlePaymentUpdate as EventListener);
    }

    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("order-payment-updated", handlePaymentUpdate as EventListener);
      }
    };
  }, [venueId, order.id, onActionComplete]);

  // Listen for real-time order status updates (e.g., when KDS bumps tickets or order is marked served)
  React.useEffect(() => {
    if (!venueId || !order.id) return;

    const supabase = createClient();
    const channel = supabase
      .channel(`order-${order.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "orders",
          filter: `id=eq.${order.id}`,
        },
        (payload) => {
          // When order is updated (including payment_status), refresh the order data
          const updatedOrder = payload.new as
            | { payment_status?: string; order_status?: string }
            | undefined;
          logger.debug("[ORDER CARD] Order updated via real-time", {
            orderId: order.id,
            newPaymentStatus: updatedOrder?.payment_status,
            newOrderStatus: updatedOrder?.order_status,
          });
          // Trigger refresh to get updated order data
          onActionComplete?.();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "kds_tickets",
          filter: `order_id=eq.${order.id}`,
        },
        (payload) => {
          // When KDS ticket status changes, immediately check if all are bumped
          // Log the update for debugging
          logger.debug("[ORDER CARD] KDS ticket updated", {
            orderId: order.id,
            ticketId: (payload.new as { id?: string })?.id,
            newStatus: (payload.new as { status?: string })?.status,
          });

          // Trigger immediate ticket check
          triggerTicketCheck();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "kds_tickets",
          filter: `order_id=eq.${order.id}`,
        },
        (payload) => {
          // When KDS ticket is deleted, check if all are now bumped/removed
          logger.debug("[ORDER CARD] KDS ticket deleted", {
            orderId: order.id,
            ticketId: (payload.old as { id?: string })?.id,
          });

          // Trigger immediate ticket check (if no tickets remain, all_bumped should be true)
          triggerTicketCheck();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [venueId, order.id, onActionComplete]);

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
          .select("venue_name, email, address")
          .eq("venue_id", venueId)
          .single();

        const logoUrl = designSettings?.logo_url;
        const primaryColor =
          designSettings?.detected_primary_color || designSettings?.primary_color || "#8b5cf6";

        setVenueInfo({
          name: venue?.venue_name,
          email: venue?.email,
          address: venue?.address,
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
      if (
        upper === "PAID" ||
        upper === "UNPAID" ||
        upper === "REFUNDED" ||
        upper === "PARTIALLY_PAID"
      ) {
        return upper as Order["payment_status"];
      }
      return "UNPAID";
    };

    // Normalize payment method
    const normalizePaymentMethod = (mode: string): Order["payment_method"] => {
      const normalized = mode.replace("_", " ").toLowerCase();
      if (
        normalized === "demo" ||
        normalized === "stripe" ||
        normalized === "till" ||
        normalized === "cash" ||
        normalized === "card"
      ) {
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
      items:
        order.items?.map((item) => ({
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

        await response.json().catch(() => null);
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

        await response.json().catch(() => null);
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

      // After status update, refresh order data to get updated status and payment info
      await onActionComplete?.();

      // If we just marked as SERVED, reset ticket check state so component can re-evaluate
      // This ensures the payment check happens correctly
      if (nextStatusRaw === "SERVED") {
        setAllTicketsBumped(null);
      }
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

    // Check if order can show "Mark Served" button
    // Requirements:
    // 1. Order status is PLACED, IN_PREP, PREPARING, or READY
    // 2. Payment status is PAID or UNPAID
    // 3. All KDS tickets are bumped (must be explicitly true, not null or false)
    const canMarkServed =
      ["PLACED", "IN_PREP", "PREPARING", "READY"].includes(orderStatus) &&
      (paymentStatus === "PAID" || paymentStatus === "UNPAID") &&
      allTicketsBumped === true; // Only show when explicitly all tickets are bumped

    // If order is PLACED, IN_PREP, PREPARING, or READY, check if all tickets are bumped
    if (["PLACED", "IN_PREP", "PREPARING", "READY"].includes(orderStatus)) {
      if (canMarkServed) {
        // All tickets bumped - can mark as served
        return (
          <div className="mt-4 pt-4 border-t border-slate-200">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="text-sm text-green-600">
                <span className="font-medium">✓ All items ready - Mark as Served</span>
              </div>
              <Button
                size="sm"
                onClick={() => handleStatusUpdate("SERVED")}
                disabled={isProcessing}
                className="bg-green-600 hover:bg-green-700"
              >
                <CheckCircle className="h-4 w-4 mr-1" />
                Mark Served
              </Button>
            </div>
          </div>
        );
      }
      // Still waiting for KDS to bump tickets - show appropriate status message
      const isInPrep = orderStatus === "IN_PREP" || orderStatus === "PREPARING";
      // If we've checked and tickets aren't all bumped, show preparing status
      // If we haven't checked yet or checking, show checking message
      let statusMessage = "Checking kitchen status...";
      if (!checkingTickets) {
        if (allTicketsBumped === false) {
          // Tickets exist but not all bumped - show preparing
          statusMessage = isInPrep ? "Preparing in kitchen" : "Waiting on kitchen";
        } else if (allTicketsBumped === null) {
          // Haven't checked yet or no tickets - show preparing
          statusMessage = isInPrep ? "Preparing in kitchen" : "Waiting on kitchen";
        }
      }

      return (
        <div className="mt-4 pt-4 border-t-2 border-slate-200">
          <div className="flex items-center justify-center gap-2 p-4 bg-blue-50 rounded-lg border-2 border-blue-200">
            <Clock className="h-5 w-5 text-blue-600 animate-pulse" />
            <span className="text-base font-semibold text-blue-700">{statusMessage}</span>
          </div>
        </div>
      );
    }

    // If order is SERVED, check payment status before allowing completion
    // Only show "Mark Completed" when:
    // 1. Order status is SERVED
    // 2. Payment status is PAID (for pay now - instant, for pay later - once Stripe goes through, for pay at till - when staff marks as paid)
    const isServed = orderStatus === "SERVED";
    if (isServed) {
      // CASE 1: Already paid - can mark completed immediately
      // Payment status PAID covers:
      // - Pay Now: Instant (already paid)
      // - Pay Later: Once Stripe payment goes through
      // - Pay at Till: When staff marks it as paid
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
                  <span className="font-medium">Awaiting Payment (Pay Later)</span>
                </div>
                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                  Unpaid - {formatCurrency(order.total_amount, order.currency)}
                </Badge>
              </div>
              <div className="bg-blue-50 rounded-lg p-3 text-sm text-gray-700 space-y-2">
                <p className="font-medium mb-1 flex items-center gap-2">
                  <QrCode className="h-4 w-4" />
                  Customer can rescan QR code to pay
                </p>
                <p className="text-xs text-gray-600">
                  When the customer pays (via QR or staff), this order will automatically unlock
                  completion.
                </p>
                <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-blue-100">
                  <Button
                    size="sm"
                    variant="servio"
                    disabled={isProcessing}
                    className="w-full sm:w-auto"
                    onClick={() => {
                      if (!venueId) return;
                      // Deep-link staff straight into consolidated payments view for this order
                      if (typeof window !== "undefined") {
                        window.location.href = `/dashboard/${venueId}/payments?orderId=${order.id}`;
                      }
                    }}
                  >
                    <CreditCard className="h-4 w-4 mr-2" />
                    Take Payment
                  </Button>
                </div>
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
      className={`rounded-xl border-2 border-slate-300 bg-white shadow-md hover:shadow-lg transition-all ${className}`}
      onMouseEnter={() => setShowHoverRemove(true)}
      onMouseLeave={() => setShowHoverRemove(false)}
    >
      <CardContent className="p-6">
        {/* Header Section - POS Style: Clear hierarchy with proper spacing */}
        <div className="flex items-start justify-between mb-5 pb-4 border-b-2 border-slate-200">
          <div className="flex-1 min-w-0">
            {/* Order ID and Time - Top Row */}
            <div className="flex items-center gap-4 mb-3">
              <Badge variant="outline" className="text-base font-bold px-4 py-1.5 border-2">
                #{order.short_id}
              </Badge>
              <div className="flex items-center gap-2 text-sm font-medium text-slate-600">
                <Clock className="h-4 w-4" />
                <span>{formatOrderTime(order.placed_at)}</span>
              </div>
            </div>

            {/* Entity Badge - Second Row */}
            <div className="mb-3">
              <Badge
                className={`inline-flex items-center text-sm px-4 py-2 font-semibold ${badgeColor}`}
              >
                {icon}
                <span className="ml-2">{label}</span>
              </Badge>
            </div>

            {/* Status Chips - Third Row with proper spacing */}
            <div className="flex items-center gap-2 flex-wrap">
              <OrderStatusChip status={order.order_status} />
              {shouldShowUnpaidChip(order) && <PaymentStatusChip status="unpaid" />}
              {order.payment.status === "paid" && <PaymentStatusChip status="paid" />}
              {order.payment.status === "failed" && <PaymentStatusChip status="failed" />}
              {order.payment.status === "refunded" && <PaymentStatusChip status="refunded" />}
              {/* Payment Method Badge */}
              {(order.payment_method || order.payment?.method) && (
                <Badge
                  variant="outline"
                  className="bg-purple-50 text-purple-700 border-purple-200 text-xs font-semibold px-3 py-1"
                >
                  <CreditCard className="h-3 w-3 mr-1" />
                  {(() => {
                    const method = (
                      order.payment_method ||
                      order.payment?.method ||
                      ""
                    ).toUpperCase();
                    if (method === "PAY_NOW") return "Pay Now";
                    if (method === "PAY_LATER") return "Pay Later";
                    if (method === "PAY_AT_TILL") return "Pay at Till";
                    return method || "Online";
                  })()}
                </Badge>
              )}
            </div>
          </div>

          {/* Total Amount and Action Buttons - Right Side */}
          <div className="flex flex-col items-end gap-3">
            <div className="text-right">
              <div className="text-3xl font-bold text-green-600">
                {formatCurrency(order.total_amount, order.currency)}
              </div>
            </div>
            <div className="flex items-center gap-2">
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
        </div>

        {/* Customer Info - POS Style: Clear section with proper spacing */}
        {order.customer?.name && (
          <div className="mb-4 p-4 bg-slate-50 rounded-lg border-2 border-slate-200">
            <div className="flex items-center gap-3">
              <User className="h-5 w-5 text-slate-700" />
              <div className="flex-1">
                <div className="font-bold text-base text-slate-900">{order.customer.name}</div>
                {order.customer.phone && (
                  <div className="text-sm text-slate-600 mt-1">{order.customer.phone}</div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Items Preview - POS Style: Clear list with proper spacing */}
        {order.items_preview && (
          <div className="mb-5">
            <div className="text-base font-bold text-slate-900 mb-3 pb-2 border-b border-slate-200">
              Order Items
            </div>
            <div className="text-sm text-slate-700 bg-slate-50 p-4 rounded-lg border-2 border-slate-200 font-medium">
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
            orderNumber={order.short_id ?? ""}
            customerName={order.customer_name ?? "Customer"}
            totalAmount={order.total_amount ?? 0}
            venueId={venueId ?? ""}
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
          {order.table_number && venueId && (
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
