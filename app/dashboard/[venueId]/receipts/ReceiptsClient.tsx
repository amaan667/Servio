"use client";

import React, { useEffect, useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Receipt, Download, Mail, MessageSquare, Printer } from "lucide-react";
import { supabaseBrowser as createClient } from "@/lib/supabase";
import { todayWindowForTZ } from "@/lib/time";
import { ReceiptModal } from "@/components/receipt/ReceiptModal";
import { Order } from "@/types/order";
import { detectColorsFromImage } from "@/app/dashboard/[venueId]/menu-management/utils/colorDetection";

type ReceiptsClientProps = {
  venueId: string;
};

interface ReceiptOrder extends Omit<Order, "table_number"> {
  table_label?: string;
  counter_label?: string;
  table_number?: number | string | null;
  created_at: string;
}

interface GroupedReceipts {
  [date: string]: ReceiptOrder[];
}

const ReceiptsClient: React.FC<ReceiptsClientProps> = ({ venueId }) => {
  const [todayReceipts, setTodayReceipts] = useState<ReceiptOrder[]>([]);
  const [historyReceipts, setHistoryReceipts] = useState<ReceiptOrder[]>([]);
  const [groupedHistoryReceipts, setGroupedHistoryReceipts] = useState<GroupedReceipts>({});
  const [loading, setLoading] = useState(true);
  const [selectedReceipt, setSelectedReceipt] = useState<ReceiptOrder | null>(null);
  const [venueInfo, setVenueInfo] = useState<{
    venue_name?: string;
    venue_email?: string;
    venue_address?: string;
    logo_url?: string;
    primary_color?: string;
    show_vat_breakdown?: boolean;
  }>({});
  const [activeTab, setActiveTab] = useState("today");

  const loadReceipts = useCallback(async () => {
    if (!venueId) return;

    setLoading(true);

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

      // Get venue contact info
      const { data: venue } = await supabase
        .from("venues")
        .select("venue_name, venue_email, venue_address, show_vat_breakdown")
        .eq("venue_id", venueId)
        .single();

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

      // Fetch paid orders only
      const { data: ordersData, error: fetchError } = await supabase
        .from("orders")
        .select("*")
        .eq("venue_id", venueId)
        .eq("payment_status", "PAID")
        .order("created_at", { ascending: false });

      if (fetchError) {
        setLoading(false);
        return;
      }

      const allReceipts = (ordersData || []) as ReceiptOrder[];

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

      setLoading(false);
    } catch (error) {
      setLoading(false);
    }
  }, [venueId]);

  // Always load receipts on mount to ensure counts are visible
  useEffect(() => {
    loadReceipts();
  }, [loadReceipts]);

  // Set up real-time subscription - always active regardless of active tab
  useEffect(() => {
    if (!venueId) return;

    const supabase = createClient();
    const channel = supabase
      .channel("receipts-updates")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
          filter: `venue_id=eq.${venueId}`,
        },
        () => {
          loadReceipts();
        }
      )
      .subscribe();

    // Also set up periodic refresh to ensure counts stay updated
    const refreshInterval = setInterval(() => {
      loadReceipts();
    }, 30000); // Refresh every 30 seconds

    return () => {
      supabase.removeChannel(channel);
      clearInterval(refreshInterval);
    };
  }, [venueId, loadReceipts]);

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
    }
  };

  const renderReceiptCard = (receipt: ReceiptOrder) => {
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading receipts...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-4 sm:py-6 lg:py-8">
        {/* Tab Navigation */}
        <section className="mb-6 sm:mb-8">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="today" className="flex items-center gap-2 relative">
                <span className="flex-1 text-left">Today</span>
                <span
                  className={`
                    ml-2 inline-flex min-w-[1.5rem] h-5 px-1.5 items-center justify-center rounded-full text-xs font-semibold transition-all duration-200
                    ${
                      activeTab === "today"
                        ? "bg-white text-servio-purple"
                        : "bg-white/30 text-white"
                    }
                  `}
                >
                  {todayReceipts.length}
                </span>
              </TabsTrigger>
              <TabsTrigger value="history" className="flex items-center gap-2 relative">
                <span className="flex-1 text-left">History</span>
                <span
                  className={`
                    ml-2 inline-flex min-w-[1.5rem] h-5 px-1.5 items-center justify-center rounded-full text-xs font-semibold transition-all duration-200
                    ${
                      activeTab === "history"
                        ? "bg-white text-servio-purple"
                        : "bg-white/30 text-white"
                    }
                  `}
                >
                  {historyReceipts.length}
                </span>
              </TabsTrigger>
            </TabsList>

            {/* Receipts Content */}
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

            <TabsContent value="history" className="mt-6">
              {historyReceipts.length === 0 ? (
                <Card>
                  <CardContent className="p-8 text-center">
                    <Receipt className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                      No Historical Receipts
                    </h3>
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
    </div>
  );
};

export default ReceiptsClient;
