"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Receipt,
  Search,
  Download,
  Printer,
  Mail,
  MessageSquare,
  Filter,
  Calendar,
  FileText,
} from "lucide-react";
import { supabaseBrowser as createClient } from "@/lib/supabase";
import { Order } from "@/types/order";
import { ReceiptModal } from "@/components/receipt/ReceiptModal";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

interface ReceiptsClientProps {
  venueId: string;
}

interface ReceiptWithVenue extends Order {
  venue_name?: string;
  venue_email?: string;
  venue_address?: string;
  receipt_logo_url?: string;
  receipt_footer_text?: string;
  show_vat_breakdown?: boolean;
}

export default function ReceiptsClient({ venueId }: ReceiptsClientProps) {
  const [receipts, setReceipts] = useState<ReceiptWithVenue[]>([]);
  const [filteredReceipts, setFilteredReceipts] = useState<ReceiptWithVenue[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedReceipt, setSelectedReceipt] = useState<ReceiptWithVenue | null>(null);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [dateFilter, setDateFilter] = useState<"all" | "today" | "week" | "month">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "PAID" | "UNPAID">("all");
  const { toast } = useToast();

  const getShortOrderNumber = (orderId: string) => {
    return orderId.slice(-6).toUpperCase();
  };

  const fetchReceipts = useCallback(async () => {
    try {
      setLoading(true);
      const supabase = createClient();

      // Build query
      let query = supabase
        .from("orders")
        .select("*")
        .eq("venue_id", venueId)
        .order("created_at", { ascending: false });

      // Apply date filter
      if (dateFilter !== "all") {
        const now = new Date();
        let startDate: Date;

        switch (dateFilter) {
          case "today":
            startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            break;
          case "week":
            startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            break;
          case "month":
            startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            break;
          default:
            startDate = new Date(0);
        }

        query = query.gte("created_at", startDate.toISOString());
      }

      const { data: ordersData, error: ordersError } = await query;

      if (ordersError) {
        throw ordersError;
      }

      // Get venue info
      const { data: venueData } = await supabase
        .from("venues")
        .select("venue_name, venue_email, venue_address, receipt_logo_url, receipt_footer_text, show_vat_breakdown")
        .eq("venue_id", venueId)
        .single();

      // Combine order and venue data
      const receiptsWithVenue: ReceiptWithVenue[] = (ordersData || []).map((order) => ({
        ...order,
        venue_name: venueData?.venue_name,
        venue_email: venueData?.venue_email,
        venue_address: venueData?.venue_address,
        receipt_logo_url: venueData?.receipt_logo_url,
        receipt_footer_text: venueData?.receipt_footer_text,
        show_vat_breakdown: venueData?.show_vat_breakdown ?? true,
      }));

      setReceipts(receiptsWithVenue);
    } catch (error) {
      console.error("Error fetching receipts:", error);
      toast({
        title: "Error",
        description: "Failed to load receipts",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [venueId, dateFilter, toast]);

  useEffect(() => {
    fetchReceipts();
  }, [fetchReceipts]);

  // Filter receipts based on search and status
  useEffect(() => {
    let filtered = receipts;

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (receipt) =>
          receipt.id.toLowerCase().includes(query) ||
          getShortOrderNumber(receipt.id).toLowerCase().includes(query) ||
          receipt.customer_name?.toLowerCase().includes(query) ||
          receipt.customer_email?.toLowerCase().includes(query) ||
          receipt.customer_phone?.toLowerCase().includes(query) ||
          receipt.table_number?.toString().includes(query)
      );
    }

    // Apply status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter((receipt) => receipt.payment_status === statusFilter);
    }

    setFilteredReceipts(filtered);
  }, [receipts, searchQuery, statusFilter]);

  const handleViewReceipt = (receipt: ReceiptWithVenue) => {
    setSelectedReceipt(receipt);
    setShowReceiptModal(true);
  };

  const handleDownloadPDF = async (orderId: string) => {
    try {
      const response = await fetch(`/api/receipts/pdf/${orderId}`);
      if (!response.ok) {
        throw new Error("Failed to generate PDF");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `receipt-${getShortOrderNumber(orderId)}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Download started",
        description: "Receipt PDF is downloading",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to download PDF",
        variant: "destructive",
      });
    }
  };

  const handlePrintReceipt = async (receipt: ReceiptWithVenue) => {
    setSelectedReceipt(receipt);
    setShowReceiptModal(true);
    // Print will be handled by ReceiptModal component
    setTimeout(() => {
      window.print();
    }, 500);
  };

  const handleSendEmail = async (receipt: ReceiptWithVenue, email?: string) => {
    const emailToSend = email || receipt.customer_email;
    if (!emailToSend) {
      toast({
        title: "Error",
        description: "No email address available",
        variant: "destructive",
      });
      return;
    }

    try {
      const response = await fetch("/api/receipts/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: receipt.id,
          email: emailToSend,
          venueId: receipt.venue_id,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to send email");
      }

      toast({
        title: "Receipt sent",
        description: `Receipt has been sent to ${emailToSend}`,
      });

      // Refresh receipts to update receipt_sent_at
      fetchReceipts();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to send email",
        variant: "destructive",
      });
    }
  };

  const handleSendSMS = async (receipt: ReceiptWithVenue, phone?: string) => {
    const phoneToSend = phone || receipt.customer_phone;
    if (!phoneToSend) {
      toast({
        title: "Error",
        description: "No phone number available",
        variant: "destructive",
      });
      return;
    }

    try {
      const response = await fetch("/api/receipts/send-sms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: receipt.id,
          phone: phoneToSend,
          venueId: receipt.venue_id,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to send SMS");
      }

      toast({
        title: "Receipt sent",
        description: `Receipt has been sent via SMS to ${phoneToSend}`,
      });

      // Refresh receipts
      fetchReceipts();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to send SMS",
        variant: "destructive",
      });
    }
  };

  const exportToCSV = () => {
    const headers = [
      "Order ID",
      "Order Number",
      "Date",
      "Customer Name",
      "Customer Email",
      "Customer Phone",
      "Table",
      "Items",
      "Total Amount",
      "Payment Status",
      "Payment Method",
      "Order Status",
    ];

    const rows = filteredReceipts.map((receipt) => {
      const items = receipt.items
        ?.map((item) => `${item.item_name} (x${item.quantity})`)
        .join("; ") || "N/A";

      return [
        receipt.id,
        getShortOrderNumber(receipt.id),
        receipt.created_at ? new Date(receipt.created_at).toLocaleString() : "N/A",
        receipt.customer_name || "N/A",
        receipt.customer_email || "N/A",
        receipt.customer_phone || "N/A",
        receipt.table_number?.toString() || "N/A",
        items,
        `£${receipt.total_amount?.toFixed(2) || "0.00"}`,
        receipt.payment_status || "N/A",
        receipt.payment_method || "N/A",
        receipt.order_status || "N/A",
      ];
    });

    const csvContent = [headers, ...rows]
      .map((row) => row.map((cell) => `"${cell}"`).join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `receipts-export-${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);

    toast({
      title: "Export started",
      description: "Receipts CSV is downloading",
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
                <Receipt className="h-8 w-8 text-purple-600" />
                Receipts
              </h1>
              <p className="text-gray-600 mt-2">
                View, manage, and export receipts for all orders
              </p>
            </div>
            <Button onClick={exportToCSV} variant="outline" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Export CSV
            </Button>
          </div>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search by order ID, customer name, email, phone, or table..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* Date Filter */}
              <div>
                <Label htmlFor="date-filter">Date Range</Label>
                <Select value={dateFilter} onValueChange={(value) => setDateFilter(value as typeof dateFilter)}>
                  <SelectTrigger id="date-filter">
                    <Calendar className="h-4 w-4 mr-2" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Time</SelectItem>
                    <SelectItem value="today">Today</SelectItem>
                    <SelectItem value="week">Last 7 Days</SelectItem>
                    <SelectItem value="month">Last 30 Days</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Status Filter */}
              <div>
                <Label htmlFor="status-filter">Payment Status</Label>
                <Select
                  value={statusFilter}
                  onValueChange={(value) => setStatusFilter(value as typeof statusFilter)}
                >
                  <SelectTrigger id="status-filter">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="PAID">Paid</SelectItem>
                    <SelectItem value="UNPAID">Unpaid</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Receipts List */}
        {loading ? (
          <Card>
            <CardContent className="p-8 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading receipts...</p>
            </CardContent>
          </Card>
        ) : filteredReceipts.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Receipt className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">
                {searchQuery || dateFilter !== "all" || statusFilter !== "all"
                  ? "No receipts match your filters"
                  : "No receipts found"}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            <div className="text-sm text-gray-600 mb-4">
              Showing {filteredReceipts.length} of {receipts.length} receipts
            </div>

            {filteredReceipts.map((receipt) => (
              <Card key={receipt.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold text-gray-900">
                          Order #{getShortOrderNumber(receipt.id)}
                        </h3>
                        <Badge
                          variant={
                            receipt.payment_status === "PAID" ? "default" : "secondary"
                          }
                        >
                          {receipt.payment_status || "UNPAID"}
                        </Badge>
                        <Badge variant="outline">{receipt.order_status}</Badge>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600 mb-4">
                        <div>
                          <span className="font-medium">Date:</span>{" "}
                          {receipt.created_at
                            ? new Date(receipt.created_at).toLocaleDateString()
                            : "N/A"}
                        </div>
                        <div>
                          <span className="font-medium">Customer:</span>{" "}
                          {receipt.customer_name || "N/A"}
                        </div>
                        <div>
                          <span className="font-medium">Table:</span>{" "}
                          {receipt.table_number || "N/A"}
                        </div>
                        <div>
                          <span className="font-medium">Total:</span>{" "}
                          <span className="font-semibold text-gray-900">
                            £{receipt.total_amount?.toFixed(2) || "0.00"}
                          </span>
                        </div>
                      </div>

                      {receipt.items && receipt.items.length > 0 && (
                        <div className="text-sm text-gray-600">
                          <span className="font-medium">Items:</span>{" "}
                          {receipt.items.length} item{receipt.items.length !== 1 ? "s" : ""}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col gap-2 ml-4">
                      <Button
                        onClick={() => handleViewReceipt(receipt)}
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
                      <Button
                        onClick={() => handlePrintReceipt(receipt)}
                        variant="outline"
                        size="sm"
                        className="w-full"
                      >
                        <Printer className="h-4 w-4 mr-1" />
                        Print
                      </Button>
                      {receipt.customer_email && (
                        <Button
                          onClick={() => handleSendEmail(receipt)}
                          variant="outline"
                          size="sm"
                          className="w-full"
                        >
                          <Mail className="h-4 w-4 mr-1" />
                          Email
                        </Button>
                      )}
                      {receipt.customer_phone && (
                        <Button
                          onClick={() => handleSendSMS(receipt)}
                          variant="outline"
                          size="sm"
                          className="w-full"
                        >
                          <MessageSquare className="h-4 w-4 mr-1" />
                          SMS
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Receipt Modal */}
        {selectedReceipt && (
          <ReceiptModal
            order={selectedReceipt}
            venueName={selectedReceipt.venue_name}
            venueEmail={selectedReceipt.venue_email}
            venueAddress={selectedReceipt.venue_address}
            isOpen={showReceiptModal}
            onClose={() => {
              setShowReceiptModal(false);
              setSelectedReceipt(null);
            }}
            showVAT={selectedReceipt.show_vat_breakdown}
            isCustomerView={false}
          />
        )}
      </div>
    </div>
  );
}
