"use client";

import React, { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Receipt,
  Download,
  CheckCircle,
  Split,
  Clock,
  User,
  MapPin,
  Undo2,
  TrendingDown,
  AlertTriangle,
} from "lucide-react";
import { supabaseBrowser as createClient } from "@/lib/supabase";
import { todayWindowForTZ } from "@/lib/time";
import { ReceiptModal } from "@/components/receipt/ReceiptModal";
import { Order, type OrderStatus } from "@/types/order";
import { detectColorsFromImage } from "@/app/dashboard/[venueId]/menu-management/utils/colorDetection";
import { BillSplittingDialog } from "@/components/pos/BillSplittingDialog";

type PaymentsClientProps = {
  initialTransactions?: PaymentTransaction[];
  initialStats?: {
    todayRevenue: number;
    pendingPayments: number;
    completedPayments: number;
    refundTotal: number;
    unpaidOrdersCount: number;
    paidOrdersCount: number;
  };
  venueId: string;
};

interface PaymentOrder extends Omit<Order, "table_number"> {
  table_label?: string;
  counter_label?: string;
  table_number?: number | string | null;
  created_at: string;
  payment_mode?: string;
}

interface RefundOrder extends PaymentOrder {
  refund_amount?: number;
  refund_reason?: string;
  refunded_at?: string;
  refund_id?: string;
}

interface PaymentTransaction {
  id: string;
  order_number: string | null;
  customer_name: string | null;
  table_label: string | null;
  counter_label: string | null;
  total_amount: number;
  payment_status: string;
  payment_method: string | null;
  order_status: string;
  created_at: string;
  refunded_at: string | null;
  refund_amount: number | null;
  refund_reason: string | null;
}

interface RefundStats {
  totalRefunds: number;
  totalRefundAmount: number;
  refundRate: number;
  commonReasons: { reason: string; count: number }[];
}

// Refund Dialog Component
function RefundDialog({
  onRefundProcessed,
  isOpen,
  setIsOpen,
}: {
  onRefundProcessed: () => void;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}) {
  const supabase = createClient();
  const [selectedOrder, setSelectedOrder] = useState<PaymentOrder | null>(null);
  const [refundAmount, setRefundAmount] = useState("");
  const [refundReason, setRefundReason] = useState("");
  const [customReason, setCustomReason] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [orders, setOrders] = useState<PaymentOrder[]>([]);

  const refundReasons = [
    "Customer request",
    "Order error",
    "Food quality",
    "Wrong item",
    "Late delivery",
    "Double charge",
    "System error",
    "Other",
  ];

  const loadPaidOrders = async () => {
    try {
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .eq("payment_status", "PAID")
        .in("payment_method", ["PAY_NOW", "PAY_AT_TILL", "PAY_LATER"])
        .order("created_at", { ascending: false })
        .limit(50);

      if (!error && data) {
        setOrders(data as PaymentOrder[]);
      }
    } catch (error) {
      // Error loading orders - handled silently
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadPaidOrders();
    }
  }, [isOpen]);

  const filteredOrders = orders.filter(
    (order) =>
      order.order_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const processRefund = async () => {
    if (!selectedOrder) return;

    setIsProcessing(true);
    try {
      const amount = refundAmount ? parseFloat(refundAmount) : undefined;
      const reason = refundReason === "Other" ? customReason : refundReason;

      const response = await fetch(`/api/orders/${selectedOrder.id}/refund`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount, reason }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to process refund");
      }

      onRefundProcessed();
      setIsOpen(false);
      setSelectedOrder(null);
      setRefundAmount("");
      setRefundReason("");
      setCustomReason("");
    } catch (error) {
      // Refund error - handled by toast notification
      toast({ title: "Error", description: error instanceof Error ? error.message : "Failed to process refund", variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Process Refund</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Order Search */}
          <div>
            <Label htmlFor="search">Search Orders</Label>
            <Input
              id="search"
              placeholder="Order number, customer name, or ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Order Selection */}
          <div>
            <Label>Select Order to Refund</Label>
            <div className="max-h-48 overflow-y-auto border rounded-md">
              {filteredOrders.length === 0 ? (
                <div className="p-4 text-center text-gray-500">No orders found</div>
              ) : (
                filteredOrders.map((order) => (
                  <div
                    key={order.id}
                    className={`p-3 border-b cursor-pointer hover:bg-gray-50 ${
                      selectedOrder?.id === order.id ? "bg-blue-50 border-blue-200" : ""
                    }`}
                    onClick={() => setSelectedOrder(order)}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium">
                          Order #{order.order_number || order.id.slice(-6).toUpperCase()}
                        </p>
                        <p className="text-sm text-gray-600">
                          {order.customer_name || "Customer"} •{" "}
                          {new Date(order.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <p className="font-semibold">£{order.total_amount?.toFixed(2)}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {selectedOrder && (
            <>
              {/* Refund Details */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-medium mb-2">Refund Details</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Order Total:</span>
                    <span className="ml-2 font-medium">
                      £{selectedOrder.total_amount?.toFixed(2)}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600">Payment Method:</span>
                    <span className="ml-2 font-medium">{selectedOrder.payment_method}</span>
                  </div>
                </div>
              </div>

              {/* Refund Amount */}
              <div>
                <Label htmlFor="amount">Refund Amount (leave empty for full refund)</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  placeholder={`Max: £${selectedOrder.total_amount?.toFixed(2)}`}
                  value={refundAmount}
                  onChange={(e) => setRefundAmount(e.target.value)}
                  max={selectedOrder.total_amount}
                />
              </div>

              {/* Refund Reason */}
              <div>
                <Label htmlFor="reason">Refund Reason</Label>
                <Select value={refundReason} onValueChange={setRefundReason}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a reason" />
                  </SelectTrigger>
                  <SelectContent>
                    {refundReasons.map((reason) => (
                      <SelectItem key={reason} value={reason}>
                        {reason}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {refundReason === "Other" && (
                <div>
                  <Label htmlFor="custom-reason">Custom Reason</Label>
                  <Textarea
                    id="custom-reason"
                    placeholder="Please specify the refund reason..."
                    value={customReason}
                    onChange={(e) => setCustomReason(e.target.value)}
                  />
                </div>
              )}

              {/* Process Button */}
              <div className="flex justify-end space-x-3">
                <Button variant="outline" onClick={() => setIsOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={processRefund}
                  disabled={
                    isProcessing || !refundReason || (refundReason === "Other" && !customReason)
                  }
                  className="bg-red-600 hover:bg-red-700"
                >
                  {isProcessing ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Processing...
                    </>
                  ) : (
                    <>
                      <Undo2 className="h-4 w-4 mr-2" />
                      Process Refund
                    </>
                  )}
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface GroupedReceipts {
  [date: string]: PaymentOrder[];
}

const PaymentsClient: React.FC<PaymentsClientProps> = ({ venueId, initialTransactions, initialStats }) => {
  void initialStats; // Initial stats available for future use
  const [unpaidOrders, setUnpaidOrders] = useState<PaymentOrder[]>(initialTransactions?.filter((o: PaymentTransaction) => o.payment_status === "UNPAID") as unknown as PaymentOrder[] || []);
  const [todayReceipts, setTodayReceipts] = useState<PaymentOrder[]>(initialTransactions?.filter((o: PaymentTransaction) => o.payment_status === "PAID") as unknown as PaymentOrder[] || []);
  const [historyReceipts, setHistoryReceipts] = useState<PaymentOrder[]>([]);
  const [groupedHistoryReceipts, setGroupedHistoryReceipts] = useState<GroupedReceipts>({});
  const [selectedReceipt, setSelectedReceipt] = useState<PaymentOrder | null>(null);
  const [selectedOrderForSplit, setSelectedOrderForSplit] = useState<PaymentOrder | null>(null);
  const [isProcessingPayment, setIsProcessingPayment] = useState<string | null>(null);
  const [venueInfo, setVenueInfo] = useState<{
    venue_name?: string;
    email?: string;
    address?: string;
    logo_url?: string;
    primary_color?: string;
    show_vat_breakdown?: boolean;
  }>({});

  // Refund state
  const [refundedOrders, setRefundedOrders] = useState<RefundOrder[]>([]);
  const [refundStats, setRefundStats] = useState<RefundStats>({
    totalRefunds: 0,
    totalRefundAmount: 0,
    refundRate: 0,
    commonReasons: [],
  });
  const [selectedRefundOrder, setSelectedRefundOrder] = useState<RefundOrder | null>(null);
  const [isProcessingRefund, setIsProcessingRefund] = useState(false);
  const [activeTab, setActiveTab] = useState("pay-at-till");
  const [isRefundDialogOpen, setIsRefundDialogOpen] = useState(false);

  // Check URL params for split action / direct order focus
  useEffect(() => {
    if (typeof window === "undefined") return;
    const urlParams = new URLSearchParams(window.location.search);
    const orderId = urlParams.get("orderId");
    const action = urlParams.get("action");

    if (orderId && action === "split") {
      setActiveTab("pay-at-till");
      // Find the order and open split dialog
      const order = unpaidOrders.find((o) => o.id === orderId);
      if (order) {
        setSelectedOrderForSplit(order);
      }
    } else if (orderId) {
      // If we have an orderId but no explicit action, still bring staff to the Payments tab
      setActiveTab("pay-at-till");
    }
  }, [unpaidOrders]);

  // Derived function - no useCallback needed (React Compiler handles this)
  const loadPayments = async () => {
    if (!venueId) return;

    try {
      const supabase = createClient();
      const venueTz = "Europe/London";

      // Get today's time window
      const todayWindowData = todayWindowForTZ(venueTz);
      const todayWindow = {
        startUtcISO: todayWindowData.startUtcISO || new Date().toISOString(),
        endUtcISO: todayWindowData.endUtcISO || new Date().toISOString(),
      };

      // Get logo from menu design settings
      const { data: designSettings } = await supabase
        .from("menu_design_settings")
        .select("logo_url")
        .eq("venue_id", venueId)
        .single();

      // Get venue contact info - handle RLS gracefully
      let venue = null;
      try {
        const { data: venueData, error: venueError } = await supabase
          .from("venues")
          .select("venue_name, email, address, show_vat_breakdown")
          .eq("venue_id", venueId)
          .maybeSingle();

        if (!venueError && venueData) {
          venue = venueData;
        }
      } catch (error) {
        // Silently fail - venue info is optional for payments page
      }

      const logoUrl = designSettings?.logo_url;
      let primaryColor = "#8b5cf6"; // Default fallback

      // Extract colors from logo if it exists
      if (logoUrl) {
        try {
          const colors = await detectColorsFromImage(logoUrl);
          primaryColor = colors.primary;
        } catch {
          // Fallback to default if color detection fails
        }
      }

      setVenueInfo({
        venue_name: venue?.venue_name || undefined,
        email: venue?.email || undefined,
        address: venue?.address || undefined,
        logo_url: logoUrl || undefined,
        primary_color: primaryColor,
        show_vat_breakdown: venue?.show_vat_breakdown ?? true,
      });

      // Fetch unpaid operational orders for TODAY ONLY (cloud-based POS best practice)
      // NOTE: payment_mode differences (offline/deferred) are just presentation; we only care about:
      // - payment_status = UNPAID
      // - payment_method IN (PAY_AT_TILL, PAY_LATER)
      const activeStatuses: OrderStatus[] = [
        "PLACED",
        "ACCEPTED",
        "IN_PREP",
        "READY",
        "SERVING",
        "SERVED",
      ];

      // Use today's window for filtering - cloud POS should focus on today's operations
      const todayStart = new Date(todayWindow.startUtcISO);
      const todayEnd = new Date(todayWindow.endUtcISO);

      // Debug: Log the date range being used (non-production only)
      if (process.env.NODE_ENV !== "production") {
        /* Condition handled */
      }

      const { data: unpaidData, error: unpaidError } = await supabase
        .from("orders")
        .select("*")
        .eq("venue_id", venueId)
        .eq("payment_status", "UNPAID")
        .in("payment_method", ["PAY_AT_TILL", "PAY_LATER"])
        // Only include currently active orders awaiting payment.
        // This clears out old unpaid orders that were already completed or cancelled.
        .in("order_status", activeStatuses)
        // Explicitly exclude completed and cancelled orders (safety check)
        .neq("order_status", "COMPLETED")
        .neq("order_status", "CANCELLED")
        // Filter to TODAY ONLY - cloud POS should focus on current operations
        // Historical orders can be accessed via Receipt History tab
        .gte("created_at", todayStart.toISOString())
        .lt("created_at", todayEnd.toISOString())
        .order("created_at", { ascending: false });

      if (unpaidError) {
        /* Condition handled */
      }

      setUnpaidOrders((unpaidData || []) as PaymentOrder[]);

      // Fetch paid orders for receipts
      const { data: ordersData, error: fetchError } = await supabase
        .from("orders")
        .select("*")
        .eq("venue_id", venueId)
        .eq("payment_status", "PAID")
        .order("created_at", { ascending: false });

      if (fetchError) {
        return;
      }

      const allReceipts = (ordersData || []) as PaymentOrder[];

      // Categorize receipts
      const todayReceiptsList = allReceipts.filter((receipt) => {
        const receiptDate = new Date(receipt.created_at);
        const todayStart = new Date(todayWindow.startUtcISO);
        const todayEnd = new Date(todayWindow.endUtcISO);
        const isToday = receiptDate >= todayStart && receiptDate < todayEnd;

        if (isToday && process.env.NODE_ENV !== "production") {
          /* Condition handled */
        }

        return isToday;
      });

      if (process.env.NODE_ENV !== "production") {
        /* Condition handled */
      }

      const historyReceiptsList = allReceipts.filter(
        (receipt) => new Date(receipt.created_at) < new Date(todayWindow.startUtcISO)
      );

      setTodayReceipts(todayReceiptsList);
      setHistoryReceipts(historyReceiptsList);

      // Group history receipts by date
      const grouped = historyReceiptsList.reduce((acc: GroupedReceipts, receipt) => {
        const date = new Date(receipt.created_at).toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        });
        if (!acc[date]) {
          acc[date] = [];
        }
        acc[date].push(receipt);
        return acc;
      }, {});
      setGroupedHistoryReceipts(grouped);
    } catch (error) {
      // Error handled silently - show empty state
    }
  };

  // Derived function - no useCallback needed (React Compiler handles this)
  const loadRefunds = async () => {
    if (!venueId) return;

    try {
      const supabase = createClient();

      // Get today's window for refund rate calculation
      const todayWindow = todayWindowForTZ("Europe/London");
      const todayStart = todayWindow.startUtcISO ? new Date(todayWindow.startUtcISO) : new Date();
      const todayEnd = todayWindow.endUtcISO ? new Date(todayWindow.endUtcISO) : new Date();

      // Fetch refunded orders
      const { data: refundsData, error: refundsError } = await supabase
        .from("orders")
        .select("*")
        .eq("venue_id", venueId)
        .in("payment_status", ["REFUNDED", "PARTIALLY_REFUNDED"])
        .order("refunded_at", { ascending: false, nullsFirst: false });

      if (refundsError) {
        // Error fetching refunds - handled silently
        return;
      }

      const refundedOrdersList = (refundsData || []) as RefundOrder[];
      setRefundedOrders(refundedOrdersList);

      // Calculate refund statistics
      const totalRefunds = refundedOrdersList.length;
      const totalRefundAmount = refundedOrdersList.reduce(
        (sum, order) => sum + (order.refund_amount || order.total_amount || 0),
        0
      );

      // Get total orders for refund rate calculation
      const { data: allOrders, error: allOrdersError } = await supabase
        .from("orders")
        .select("id")
        .eq("venue_id", venueId)
        .gte("created_at", todayStart.toISOString())
        .lt("created_at", todayEnd.toISOString());

      if (!allOrdersError && allOrders) {
        const totalOrders = allOrders.length;
        const todayRefunds = refundedOrdersList.filter((order) => {
          if (!order.refunded_at) return false;
          const refundDate = new Date(order.refunded_at);
          return refundDate >= todayStart && refundDate < todayEnd;
        }).length;

        const refundRate = totalOrders > 0 ? (todayRefunds / totalOrders) * 100 : 0;

        // Calculate common refund reasons
        const reasonCounts: { [key: string]: number } = {};
        refundedOrdersList.forEach((order) => {
          const reason = order.refund_reason || "Not specified";
          reasonCounts[reason] = (reasonCounts[reason] || 0) + 1;
        });

        const commonReasons = Object.entries(reasonCounts)
          .map(([reason, count]) => ({ reason, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5);

        setRefundStats({
          totalRefunds,
          totalRefundAmount,
          refundRate,
          commonReasons,
        });
      }
    } catch (error) {
      // Error loading refunds - handled silently
    }
  };

  // Predefined refund reasons
  const refundReasons = [
    "Customer request",
    "Order error",
    "Food quality",
    "Wrong item",
    "Late delivery",
    "Double charge",
    "System error",
    "Other",
  ];

  const processRefund = async (orderId: string, amount?: number, reason?: string) => {
    if (isProcessingRefund) return;

    setIsProcessingRefund(true);
    try {
      const response = await fetch(`/api/orders/${orderId}/refund`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount,
          reason: reason || "Not specified",
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to process refund");
      }

      const result = await response.json();

      // Refresh both payments and refunds data
      await loadPayments();
      await loadRefunds();

      setSelectedRefundOrder(null);

      return result;
    } catch (error) {
      // Refund error - rethrow for caller to handle
      throw error;
    } finally {
      setIsProcessingRefund(false);
    }
  };

  // Always load payments on mount
  useEffect(() => {
    loadPayments();
  }, [loadPayments]);

  // Load refunds when refunds tab is active
  useEffect(() => {
    if (activeTab === "refunds") {
      loadRefunds();
    }
  }, [activeTab, loadRefunds]);

  // Set up real-time subscription for payment updates
  useEffect(() => {
    if (!venueId) return;

    const supabase = createClient();
    let debounceTimeout: NodeJS.Timeout | null = null;

    const channel = supabase
      .channel("payments-updates")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
          filter: `venue_id=eq.${venueId}`,
        },
        () => {
          // Debounce to prevent request storm when many updates fire
          if (debounceTimeout) clearTimeout(debounceTimeout);
          debounceTimeout = setTimeout(() => {
            loadPayments();
          }, 2000);
        }
      )
      .subscribe();

    // Listen for custom payment update events (debounced to avoid request storm)
    const paymentUpdateDebounce = { current: null as ReturnType<typeof setTimeout> | null };
    const handlePaymentUpdate = () => {
      if (paymentUpdateDebounce.current) clearTimeout(paymentUpdateDebounce.current);
      paymentUpdateDebounce.current = setTimeout(() => {
        paymentUpdateDebounce.current = null;
        loadPayments();
      }, 1500);
    };

    if (typeof window !== "undefined") {
      window.addEventListener("order-payment-updated", handlePaymentUpdate as EventListener);
    }

    // Also set up periodic refresh
    const refreshInterval = setInterval(() => {
      loadPayments();
    }, 30000); // Refresh every 30 seconds

    return () => {
      if (debounceTimeout) clearTimeout(debounceTimeout);
      if (paymentUpdateDebounce.current) clearTimeout(paymentUpdateDebounce.current);
      supabase.removeChannel(channel);
      clearInterval(refreshInterval);
      if (typeof window !== "undefined") {
        window.removeEventListener("order-payment-updated", handlePaymentUpdate as EventListener);
      }
    };
  }, [venueId]);

  const handleMarkAsPaid = async (orderId: string) => {
      // Generate unique idempotency key for this request
      const idempotencyKey = `${orderId}-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
    try {
      setIsProcessingPayment(orderId);
      const response = await fetch("/api/orders/mark-paid", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-idempotency-key": idempotencyKey,
        },
        credentials: "same-origin",
        body: JSON.stringify({
          orderId,
          venue_id: venueId,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const errorMessage = data?.error?.message || data?.error || "Failed to mark order as paid";
        toast({ title: "Error", description: `Failed to mark order as paid: ${errorMessage}`, variant: "destructive" });
        return;
      }

      // Single refresh; skip dispatching event to avoid duplicate loadPayments and request storm
      await loadPayments();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred";
      toast({ title: "Error", description: errorMessage, variant: "destructive" });
    } finally {
      setIsProcessingPayment(null);
    }
  };

  const handleDownloadPDF = async (orderId: string) => {
    try {
      const response = await fetch(`/api/receipts/pdf/${orderId}`, {
        method: "GET",
      });

      if (!response.ok) {
        throw new Error("Failed to generate PDF");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `receipt-${orderId.slice(-6).toUpperCase()}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      // Error handled silently
    }
  };

  const renderUnpaidOrderCard = (order: PaymentOrder) => {
    const orderNumber = order.id.slice(-6).toUpperCase();
    const date = new Date(order.created_at);
    const formattedTime = date.toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
    });

    const method = String(order.payment_method || "").toUpperCase();
    const isPayLater = method === "PAY_LATER";
    const isServed = order.order_status === "SERVED";
    const locationLabel = order.table_label || order.counter_label;

    return (
      <Card key={order.id} className="border border-slate-200">
        <CardContent className="p-4">
          {/* Overview: order ID, time, total, location, customer */}
          <div className="flex items-start justify-between gap-3 mb-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-slate-900">#{orderNumber}</span>
                <span className="text-sm text-slate-500">{formattedTime}</span>
                <Badge
                  variant="secondary"
                  className={`text-xs ${isPayLater ? "bg-blue-100 text-blue-800" : "bg-orange-100 text-orange-800"}`}
                >
                  {isPayLater ? "Pay Later" : "Pay at Till"}
                </Badge>
                {isServed && (
                  <Badge
                    variant="outline"
                    className="text-xs bg-green-50 text-green-700 border-green-200"
                  >
                    Served
                  </Badge>
                )}
              </div>
              {locationLabel && (
                <div className="flex items-center gap-1.5 mt-1 text-sm text-slate-600">
                  <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
                  <span>{locationLabel}</span>
                </div>
              )}
              {order.customer_name && (
                <div className="flex items-center gap-1.5 mt-0.5 text-sm text-slate-600">
                  <User className="h-3.5 w-3.5 flex-shrink-0" />
                  <span>{order.customer_name}</span>
                </div>
              )}
            </div>
            <div className="text-xl font-bold text-slate-900 flex-shrink-0">
              £{order.total_amount.toFixed(2)}
            </div>
          </div>

          {/* Primary actions: process payment at till and/or split bill */}
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => handleMarkAsPaid(order.id)}
              disabled={isProcessingPayment === order.id}
              size="sm"
              className="bg-green-600 hover:bg-green-700 text-white font-medium"
            >
              {isProcessingPayment === order.id ? (
                <>
                  <Clock className="h-4 w-4 mr-1.5 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-1.5" />
                  Mark as Paid
                </>
              )}
            </Button>
            {!isPayLater && (
              <Button
                onClick={() => setSelectedOrderForSplit(order)}
                variant="outline"
                size="sm"
                className="font-medium"
              >
                <Split className="h-4 w-4 mr-1.5" />
                Split Bill
              </Button>
            )}
          </div>

          <a
            href={venueId ? `/dashboard/${venueId}/live-orders?order=${order.id}` : "#"}
            className="mt-3 inline-block text-xs text-slate-500 hover:text-slate-700 hover:underline"
          >
            View full order in Live Orders
          </a>
        </CardContent>
      </Card>
    );
  };

  const renderReceiptCard = (receipt: PaymentOrder) => {
    const orderNumber = receipt.id.slice(-6).toUpperCase();
    const date = new Date(receipt.created_at);
    const formattedDate = date.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
    const formattedTime = date.toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
    });

    return (
      <Card key={receipt.id} className="hover:shadow-md transition-shadow">
        <CardContent className="p-6">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <Receipt className="h-5 w-5 text-purple-600" />
                <span className="font-semibold text-lg">#{orderNumber}</span>
                <Badge variant="secondary" className="bg-green-100 text-green-800">
                  Paid
                </Badge>
              </div>
              <div className="space-y-1 text-sm text-gray-600">
                {receipt.table_label && (
                  <div>
                    <span className="font-medium">Table:</span> {receipt.table_label}
                  </div>
                )}
                {receipt.counter_label && (
                  <div>
                    <span className="font-medium">Counter:</span> {receipt.counter_label}
                  </div>
                )}
                {receipt.customer_name && (
                  <div>
                    <span className="font-medium">Customer:</span> {receipt.customer_name}
                  </div>
                )}
                <div>
                  <span className="font-medium">Date:</span> {formattedDate} at {formattedTime}
                </div>
                {receipt.payment_method && (
                  <div>
                    <span className="font-medium">Payment:</span>{" "}
                    {receipt.payment_method.replace("_", " ").toUpperCase()}
                  </div>
                )}
              </div>
              <div className="mt-3">
                <span className="text-2xl font-bold text-gray-900">
                  £{receipt.total_amount.toFixed(2)}
                </span>
              </div>
            </div>
            <div className="flex flex-col gap-2 ml-4">
              <Button
                onClick={() => setSelectedReceipt(receipt)}
                variant="outline"
                size="sm"
                className="w-full"
              >
                <Receipt className="h-4 w-4 mr-1" />
                View
              </Button>
              <Button
                onClick={() => handleDownloadPDF(receipt.id)}
                variant="outline"
                size="sm"
                className="w-full"
              >
                <Download className="h-4 w-4 mr-1" />
                PDF
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-4 sm:py-6 lg:py-8">
        {/* Tab Navigation */}
        <section className="mb-6 sm:mb-8">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="pay-at-till" className="flex items-center gap-2 relative">
                <span className="flex-1 text-left">Pay at Till</span>
                <span
                  className={`
                    ml-2 inline-flex min-w-[1.75rem] h-6 px-2 items-center justify-center rounded-full text-xs font-bold transition-all duration-200 border
                    ${
                      activeTab === "pay-at-till"
                        ? "bg-white text-servio-purple border-servio-purple/20 shadow-sm"
                        : "bg-white/40 text-white border-white/30"
                    }
                  `}
                >
                  {
                    unpaidOrders.filter((order) => {
                      const method = String(order.payment_method || "").toUpperCase();
                      return method === "PAY_AT_TILL";
                    }).length
                  }
                </span>
              </TabsTrigger>
              <TabsTrigger value="pay-later" className="flex items-center gap-2 relative">
                <span className="flex-1 text-left">Pay Later</span>
                <span
                  className={`
                    ml-2 inline-flex min-w-[1.75rem] h-6 px-2 items-center justify-center rounded-full text-xs font-bold transition-all duration-200 border
                    ${
                      activeTab === "pay-later"
                        ? "bg-white text-servio-purple border-servio-purple/20 shadow-sm"
                        : "bg-white/40 text-white border-white/30"
                    }
                  `}
                >
                  {
                    unpaidOrders.filter((order) => {
                      const method = String(order.payment_method || "").toUpperCase();
                      return method === "PAY_LATER";
                    }).length
                  }
                </span>
              </TabsTrigger>
              <TabsTrigger value="today" className="flex items-center gap-2 relative">
                <span className="flex-1 text-left">Today's Receipts</span>
                <span
                  className={`
                    ml-2 inline-flex min-w-[1.75rem] h-6 px-2 items-center justify-center rounded-full text-xs font-bold transition-all duration-200 border
                    ${
                      activeTab === "today"
                        ? "bg-white text-servio-purple border-servio-purple/20 shadow-sm"
                        : "bg-white/40 text-white border-white/30"
                    }
                  `}
                >
                  {todayReceipts.length}
                </span>
              </TabsTrigger>
              <TabsTrigger value="history" className="flex items-center gap-2 relative">
                <span className="flex-1 text-left">Receipt History</span>
                <span
                  className={`
                    ml-2 inline-flex min-w-[1.75rem] h-6 px-2 items-center justify-center rounded-full text-xs font-bold transition-all duration-200 border
                    ${
                      activeTab === "history"
                        ? "bg-white text-servio-purple border-servio-purple/20 shadow-sm"
                        : "bg-white/40 text-white border-white/30"
                    }
                  `}
                >
                  {historyReceipts.length}
                </span>
              </TabsTrigger>
              <TabsTrigger value="refunds" className="flex items-center gap-2 relative">
                <Undo2 className="h-4 w-4" />
                <span className="flex-1 text-left">Refunds</span>
                <span
                  className={`
                    ml-2 inline-flex min-w-[1.75rem] h-6 px-2 items-center justify-center rounded-full text-xs font-bold transition-all duration-200 border
                    ${
                      activeTab === "refunds"
                        ? "bg-white text-servio-purple border-servio-purple/20 shadow-sm"
                        : "bg-white/40 text-white border-white/30"
                    }
                  `}
                >
                  {refundedOrders.length}
                </span>
              </TabsTrigger>
            </TabsList>

            {/* Payments - Pay at Till Orders */}
            <TabsContent value="pay-at-till" className="mt-6">
              {unpaidOrders.filter((order) => {
                const method = String(order.payment_method || "").toUpperCase();
                return method === "PAY_AT_TILL";
              }).length === 0 ? (
                <Card>
                  <CardContent className="p-8 text-center">
                    <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No Unpaid Orders</h3>
                    <p className="text-gray-600">No unpaid Pay at Till orders found</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {unpaidOrders
                    .filter((order) => {
                      const method = String(order.payment_method || "").toUpperCase();
                      return method === "PAY_AT_TILL";
                    })
                    .map(renderUnpaidOrderCard)}
                </div>
              )}
            </TabsContent>

            {/* Payments - Pay Later Orders */}
            <TabsContent value="pay-later" className="mt-6">
              {unpaidOrders.filter((order) => {
                const method = String(order.payment_method || "").toUpperCase();
                return method === "PAY_LATER";
              }).length === 0 ? (
                <Card>
                  <CardContent className="p-8 text-center">
                    <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No Unpaid Orders</h3>
                    <p className="text-gray-600">No unpaid Pay Later orders found</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {unpaidOrders
                    .filter((order) => {
                      const method = String(order.payment_method || "").toUpperCase();
                      return method === "PAY_LATER";
                    })
                    .map(renderUnpaidOrderCard)}
                </div>
              )}
            </TabsContent>

            {/* Today's Receipts */}
            <TabsContent value="today" className="mt-6">
              {todayReceipts.length === 0 ? (
                <Card>
                  <CardContent className="p-8 text-center">
                    <Receipt className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No Receipts Today</h3>
                    <p className="text-gray-600">No paid orders found for today</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {todayReceipts.map(renderReceiptCard)}
                </div>
              )}
            </TabsContent>

            {/* Receipt History */}
            <TabsContent value="history" className="mt-6">
              {historyReceipts.length === 0 ? (
                <Card>
                  <CardContent className="p-8 text-center">
                    <Receipt className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No Receipt History</h3>
                    <p className="text-gray-600">No receipts from previous days</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-6">
                  {Object.entries(groupedHistoryReceipts)
                    .sort(([a], [b]) => new Date(b).getTime() - new Date(a).getTime())
                    .map(([date, dateReceipts]) => (
                      <div key={date}>
                        <h3 className="text-lg font-semibold text-gray-900 mb-3 sticky top-0 bg-background py-2">
                          {date}
                        </h3>
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                          {dateReceipts.map(renderReceiptCard)}
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </TabsContent>

            {/* Refunds Section */}
            <TabsContent value="refunds" className="mt-6">
              {/* Refund Statistics */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-600">Total Refunds</p>
                        <p className="text-2xl font-bold text-gray-900">
                          {refundStats.totalRefunds}
                        </p>
                      </div>
                      <Undo2 className="h-8 w-8 text-red-500" />
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-600">Refund Amount</p>
                        <p className="text-2xl font-bold text-gray-900">
                          £{refundStats.totalRefundAmount.toFixed(2)}
                        </p>
                      </div>
                      <TrendingDown className="h-8 w-8 text-orange-500" />
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-600">Today's Rate</p>
                        <p className="text-2xl font-bold text-gray-900">
                          {refundStats.refundRate.toFixed(1)}%
                        </p>
                      </div>
                      <AlertTriangle
                        className={`h-8 w-8 ${refundStats.refundRate > 5 ? "text-red-500" : "text-green-500"}`}
                      />
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div>
                      <p className="text-sm text-gray-600 mb-2">Top Reasons</p>
                      <div className="space-y-1">
                        {refundStats.commonReasons.slice(0, 2).map((reason, index) => (
                          <p key={index} className="text-xs text-gray-700 truncate">
                            {reason.reason} ({reason.count})
                          </p>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Refund Orders List */}
              {refundedOrders.length === 0 ? (
                <Card>
                  <CardContent className="p-8 text-center">
                    <Undo2 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No Refunds</h3>
                    <p className="text-gray-600">No refunded orders found</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {refundedOrders.map((order) => (
                    <Card key={order.id} className="hover:shadow-md transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <p className="font-semibold text-gray-900">
                              Order #{order.order_number || order.id.slice(-6).toUpperCase()}
                            </p>
                            <p className="text-sm text-gray-600">
                              {order.customer_name || "Customer"}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold text-red-600">
                              -£{(order.refund_amount || order.total_amount || 0).toFixed(2)}
                            </p>
                            <p className="text-xs text-gray-500">
                              {order.refunded_at
                                ? new Date(order.refunded_at).toLocaleDateString()
                                : "Unknown"}
                            </p>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600">Reason:</span>
                            <span className="text-gray-900">
                              {order.refund_reason || "Not specified"}
                            </span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600">Status:</span>
                            <span
                              className={`px-2 py-1 rounded-full text-xs font-medium ${
                                order.payment_status === "REFUNDED"
                                  ? "bg-red-100 text-red-800"
                                  : "bg-orange-100 text-orange-800"
                              }`}
                            >
                              {order.payment_status}
                            </span>
                          </div>
                          {order.refund_id && (
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-600">ID:</span>
                              <span className="text-gray-900 font-mono text-xs">
                                {order.refund_id.slice(-8)}
                              </span>
                            </div>
                          )}
                        </div>

                        <div className="mt-3 pt-3 border-t border-gray-200">
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full"
                            onClick={() => setSelectedRefundOrder(order)}
                          >
                            <Receipt className="h-4 w-4 mr-2" />
                            View Receipt
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </section>
      </div>

      {/* Receipt Modal */}
      {selectedReceipt && (
        <ReceiptModal
          order={selectedReceipt as Order}
          venueEmail={venueInfo.email}
          venueAddress={venueInfo.address}
          logoUrl={venueInfo.logo_url}
          primaryColor={venueInfo.primary_color}
          isOpen={!!selectedReceipt}
          onClose={() => setSelectedReceipt(null)}
          showVAT={venueInfo.show_vat_breakdown ?? true}
          isCustomerView={false}
        />
      )}

      {/* Bill Splitting Dialog */}
      {selectedOrderForSplit && (
        <BillSplittingDialog
          isOpen={!!selectedOrderForSplit}
          onClose={() => {
            setSelectedOrderForSplit(null);
            // Clear URL params
            if (typeof window !== "undefined") {
              const url = new URL(window.location.href);
              url.searchParams.delete("orderId");
              url.searchParams.delete("action");
              window.history.replaceState({}, "", url.toString());
            }
          }}
          orders={[selectedOrderForSplit].map((order) => ({
            id: order.id,
            customer_name: order.customer_name || "Customer",
            total_amount: order.total_amount,
            items: (order.items || []).map((item: unknown) => {
              const it = item as {
                menu_item_id?: string;
                quantity: number;
                price: number;
                item_name: string;
                specialInstructions?: string;
              };
              return {
                menu_item_id: it.menu_item_id || "",
                quantity: it.quantity,
                price: it.price,
                item_name: it.item_name,
                specialInstructions: it.specialInstructions,
              };
            }),
          }))}
          venueId={venueId}
          onSplitComplete={() => {
            setSelectedOrderForSplit(null);
            loadPayments();
          }}
        />
      )}

      {/* Refund Dialog */}
      {/* Floating Refund Button + Controlled Dialog (so it always opens correctly) */}
      <Button
        className="fixed bottom-6 right-28 shadow-lg"
        onClick={() => setIsRefundDialogOpen(true)}
      >
        <Undo2 className="h-4 w-4 mr-2" />
        Process Refund
      </Button>
      <RefundDialog
        onRefundProcessed={() => {
          loadRefunds();
          setIsRefundDialogOpen(false);
        }}
        isOpen={isRefundDialogOpen}
        setIsOpen={setIsRefundDialogOpen}
      />

      {/* Receipt Modal for Refunded Orders */}
      {selectedRefundOrder && (
        <ReceiptModal
          order={selectedRefundOrder as Order}
          venueEmail={venueInfo.email}
          venueAddress={venueInfo.address}
          logoUrl={venueInfo.logo_url}
          primaryColor={venueInfo.primary_color}
          isOpen={!!selectedRefundOrder}
          onClose={() => setSelectedRefundOrder(null)}
          showVAT={venueInfo.show_vat_breakdown ?? true}
          isCustomerView={false}
        />
      )}
    </div>
  );
};

export default PaymentsClient;
