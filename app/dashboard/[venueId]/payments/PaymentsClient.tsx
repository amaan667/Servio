"use client";

import React, { useEffect, useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Receipt, Download, CheckCircle, Split, CreditCard, Clock } from "lucide-react";
import { supabaseBrowser as createClient } from "@/lib/supabase";
import { todayWindowForTZ } from "@/lib/time";
import { ReceiptModal } from "@/components/receipt/ReceiptModal";
import { Order, type OrderStatus } from "@/types/order";
import { detectColorsFromImage } from "@/app/dashboard/[venueId]/menu-management/utils/colorDetection";
import { BillSplittingDialog } from "@/components/pos/BillSplittingDialog";

type PaymentsClientProps = {
  venueId: string;
};

interface PaymentOrder extends Omit<Order, "table_number"> {
  table_label?: string;
  counter_label?: string;
  table_number?: number | string | null;
  created_at: string;
  payment_mode?: string;
}

interface GroupedReceipts {
  [date: string]: PaymentOrder[];
}

const PaymentsClient: React.FC<PaymentsClientProps> = ({ venueId }) => {
  const [payAtTillOrders, setPayAtTillOrders] = useState<PaymentOrder[]>([]);
  const [todayReceipts, setTodayReceipts] = useState<PaymentOrder[]>([]);
  const [historyReceipts, setHistoryReceipts] = useState<PaymentOrder[]>([]);
  const [groupedHistoryReceipts, setGroupedHistoryReceipts] = useState<GroupedReceipts>({});
  const [selectedReceipt, setSelectedReceipt] = useState<PaymentOrder | null>(null);
  const [selectedOrderForSplit, setSelectedOrderForSplit] = useState<PaymentOrder | null>(null);
  const [isProcessingPayment, setIsProcessingPayment] = useState<string | null>(null);
  const [venueInfo, setVenueInfo] = useState<{
    venue_name?: string;
    venue_email?: string;
    venue_address?: string;
    logo_url?: string;
    primary_color?: string;
    show_vat_breakdown?: boolean;
  }>({});
  const [activeTab, setActiveTab] = useState("pay-at-till");

  // Check URL params for split action
  useEffect(() => {
    if (typeof window === "undefined") return;
    const urlParams = new URLSearchParams(window.location.search);
    const orderId = urlParams.get("orderId");
    const action = urlParams.get("action");
    if (orderId && action === "split") {
      setActiveTab("pay-at-till");
      // Find the order and open split dialog
      const order = payAtTillOrders.find((o) => o.id === orderId);
      if (order) {
        setSelectedOrderForSplit(order);
      }
    }
  }, [payAtTillOrders]);

  const loadPayments = useCallback(async () => {
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
          .select("venue_name, venue_email, venue_address, show_vat_breakdown")
          .eq("venue_id", venueId)
          .maybeSingle();

        if (!venueError && venueData) {
          venue = venueData;
        }
      } catch (error) {
        // Silently fail - venue info is optional for payments page
        // Silently fail - venue info is optional
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
        venue_email: venue?.venue_email || undefined,
        venue_address: venue?.venue_address || undefined,
        logo_url: logoUrl || undefined,
        primary_color: primaryColor,
        show_vat_breakdown: venue?.show_vat_breakdown ?? true,
      });

      // Fetch pay-at-till orders (UNPAID with payment_mode = pay_at_till)
      const activeStatuses: OrderStatus[] = [
        "PLACED",
        "ACCEPTED",
        "IN_PREP",
        "READY",
        "SERVING",
        "SERVED",
      ];

      const { data: payAtTillData } = await supabase
        .from("orders")
        .select("*")
        .eq("venue_id", venueId)
        .eq("payment_status", "UNPAID")
        .eq("payment_mode", "pay_at_till")
        // Only include currently active orders awaiting pay-at-till payment.
        // This clears out old unpaid orders that were already completed or cancelled.
        .in("order_status", activeStatuses)
        .order("created_at", { ascending: false });

      setPayAtTillOrders((payAtTillData || []) as PaymentOrder[]);

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
        return receiptDate >= todayStart && receiptDate < todayEnd;
      });

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
  }, [venueId]);

  // Always load payments on mount
  useEffect(() => {
    loadPayments();
  }, [loadPayments]);

  // Set up real-time subscription
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
          // Debounce to prevent excessive calls
          if (debounceTimeout) clearTimeout(debounceTimeout);
          debounceTimeout = setTimeout(() => {
            loadPayments();
          }, 500);
        }
      )
      .subscribe();

    // Also set up periodic refresh
    const refreshInterval = setInterval(() => {
      loadPayments();
    }, 30000); // Refresh every 30 seconds

    return () => {
      if (debounceTimeout) clearTimeout(debounceTimeout);
      supabase.removeChannel(channel);
      clearInterval(refreshInterval);
    };
  }, [venueId, loadPayments]);

  const handleMarkAsPaid = async (orderId: string) => {
    try {
      setIsProcessingPayment(orderId);
      const response = await fetch("/api/orders/payment", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          orderId,
          venue_id: venueId,
          payment_method: "till",
          payment_status: "PAID",
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to mark order as paid");
      }

      await loadPayments();
    } catch (error) {
      // Error handled silently
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

  const renderPayAtTillCard = (order: PaymentOrder) => {
    const orderNumber = order.id.slice(-6).toUpperCase();
    const date = new Date(order.created_at);
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
      <Card key={order.id} className="hover:shadow-md transition-shadow">
        <CardContent className="p-6">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="h-5 w-5 text-orange-600" />
                <span className="font-semibold text-lg">#{orderNumber}</span>
                <Badge variant="secondary" className="bg-orange-100 text-orange-800">
                  Pay at Till
                </Badge>
              </div>
              <div className="space-y-1 text-sm text-gray-600">
                {order.table_label && (
                  <div>
                    <span className="font-medium">Table:</span> {order.table_label}
                  </div>
                )}
                {order.counter_label && (
                  <div>
                    <span className="font-medium">Counter:</span> {order.counter_label}
                  </div>
                )}
                {order.customer_name && (
                  <div>
                    <span className="font-medium">Customer:</span> {order.customer_name}
                  </div>
                )}
                <div>
                  <span className="font-medium">Date:</span> {formattedDate} at {formattedTime}
                </div>
              </div>
              <div className="mt-3">
                <span className="text-2xl font-bold text-gray-900">
                  £{order.total_amount.toFixed(2)}
                </span>
              </div>
            </div>
            <div className="flex flex-col gap-2 ml-4">
              <Button
                onClick={() => handleMarkAsPaid(order.id)}
                disabled={isProcessingPayment === order.id}
                variant="default"
                size="sm"
                className="w-full"
              >
                {isProcessingPayment === order.id ? (
                  <>
                    <Clock className="h-4 w-4 mr-1 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4 mr-1" />
                    Mark as Paid
                  </>
                )}
              </Button>
              <Button
                onClick={() => setSelectedOrderForSplit(order)}
                variant="outline"
                size="sm"
                className="w-full"
              >
                <Split className="h-4 w-4 mr-1" />
                Split Bill
              </Button>
            </div>
          </div>
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
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="pay-at-till" className="flex items-center gap-2 relative">
                <span className="flex-1 text-left">Payments</span>
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
                  {payAtTillOrders.length}
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
            </TabsList>

            {/* Payments - Pay at Till Orders */}
            <TabsContent value="pay-at-till" className="mt-6">
              {payAtTillOrders.length === 0 ? (
                <Card>
                  <CardContent className="p-8 text-center">
                    <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                      No Pay at Till Orders
                    </h3>
                    <p className="text-gray-600">
                      No unpaid orders with pay at till payment method
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {payAtTillOrders.map(renderPayAtTillCard)}
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
          </Tabs>
        </section>
      </div>

      {/* Receipt Modal */}
      {selectedReceipt && (
        <ReceiptModal
          order={selectedReceipt as Order}
          venueEmail={venueInfo.venue_email}
          venueAddress={venueInfo.venue_address}
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
    </div>
  );
};

export default PaymentsClient;
