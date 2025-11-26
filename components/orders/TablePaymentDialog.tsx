"use client";

import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Banknote, CreditCard, Receipt, Users, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface Order {
  id: string;
  customer_name?: string;
  customer_phone?: string;
  total_amount: number;
  payment_mode?: string;
  payment_status: string;
  order_status: string;
  items: Array<{
    item_name: string;
    quantity: number;
    price: number;
  }>;
  created_at: string;
}

interface TablePaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tableNumber: number | string;
  venueId: string;
  onSuccess: () => void;
}

export function TablePaymentDialog({
  open,
  onOpenChange,
  tableNumber,
  venueId,
  onSuccess,
}: TablePaymentDialogProps) {
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [totalAmount, setTotalAmount] = useState(0);
  const [selectedMethod, setSelectedMethod] = useState<"cash" | "card" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  // Fetch unpaid orders when dialog opens
  useEffect(() => {
    if (open && tableNumber && venueId) {
      fetchUnpaidOrders();
    } else {
      // Reset state when closed
      setOrders([]);
      setTotalAmount(0);
      setSelectedMethod(null);
      setError(null);
      setWarning(null);
    }
  }, [open, tableNumber, venueId]);

  const fetchUnpaidOrders = async () => {
    setFetching(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/orders/table/${tableNumber}/unpaid?venue_id=${venueId}`
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to fetch orders");
      }

      const data = await response.json();

      if (!data.ok || !data.orders) {
        throw new Error("Invalid response from server");
      }

      setOrders(data.orders || []);
      setTotalAmount(data.totalAmount || 0);

      // Check for mixed payment modes
      const paymentModes = [...new Set(data.orders.map((o: Order) => o.payment_mode).filter(Boolean))];
      if (paymentModes.length > 1) {
        setWarning(
          `This table has orders with different payment modes: ${paymentModes.join(", ")}. All will be paid together.`
        );
      }

      // Check if any orders are already paid (shouldn't happen but safety check)
      const alreadyPaid = data.orders.filter((o: Order) => o.payment_status === "PAID");
      if (alreadyPaid.length > 0) {
        setWarning(
          `${alreadyPaid.length} order(s) are already paid and will be skipped.`
        );
      }
    } catch (_err) {
      setError(_err instanceof Error ? _err.message : "Failed to load orders");
    } finally {
      setFetching(false);
    }
  };

  const handlePayTable = async () => {
    if (!selectedMethod) {
      setError("Please select a payment method");
      return;
    }

    if (orders.length === 0) {
      setError("No unpaid orders found for this table");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Filter out already paid orders (safety check)
      const unpaidOrderIds = orders
        .filter((o) => o.payment_status !== "PAID")
        .map((o) => o.id);

      if (unpaidOrderIds.length === 0) {
        setError("All orders are already paid");
        setLoading(false);
        return;
      }

      const response = await fetch("/api/orders/pay-multiple", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          order_ids: unpaidOrderIds,
          payment_method: selectedMethod,
          venue_id: venueId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to process payment");
      }

      // Success - close dialog and refresh
      onOpenChange(false);
      onSuccess();
    } catch (_err) {
      setError(_err instanceof Error ? _err.message : "Failed to process payment");
    } finally {
      setLoading(false);
    }
  };

  const unpaidOrders = orders.filter((o) => o.payment_status !== "PAID");
  const unpaidTotal = unpaidOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Pay Entire Table {tableNumber}
          </DialogTitle>
          <DialogDescription>
            Pay all unpaid orders for this table in one transaction
          </DialogDescription>
        </DialogHeader>

        {fetching ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
            <span className="ml-3 text-gray-600">Loading orders...</span>
          </div>
        ) : (
          <div className="space-y-4 py-4">
            {/* Summary */}
            <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
              <div className="flex justify-between items-center mb-2">
                <span className="font-semibold text-gray-900">Total Unpaid Orders:</span>
                <Badge variant="outline" className="bg-white">
                  {unpaidOrders.length}
                </Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-semibold text-gray-900">Total Amount:</span>
                <span className="text-2xl font-bold text-purple-600">£{unpaidTotal.toFixed(2)}</span>
              </div>
            </div>

            {/* Warnings */}
            {warning && (
              <Alert className="border-yellow-200 bg-yellow-50">
                <AlertCircle className="h-4 w-4 text-yellow-600" />
                <AlertTitle className="text-yellow-900">Notice</AlertTitle>
                <AlertDescription className="text-yellow-800">{warning}</AlertDescription>
              </Alert>
            )}

            {/* Error */}
            {error && (
              <Alert className="border-red-200 bg-red-50">
                <AlertCircle className="h-4 w-4 text-red-600" />
                <AlertTitle className="text-red-900">Error</AlertTitle>
                <AlertDescription className="text-red-800">{error}</AlertDescription>
              </Alert>
            )}

            {/* Orders List */}
            {unpaidOrders.length > 0 ? (
              <div>
                <h4 className="text-sm font-medium mb-3 text-gray-900">Orders to Pay:</h4>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {unpaidOrders.map((order) => (
                    <div
                      key={order.id}
                      className="flex items-start justify-between p-3 bg-gray-50 rounded-lg border border-gray-200"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-gray-900">
                            Order #{order.id.slice(-6).toUpperCase()}
                          </span>
                          {order.payment_mode && (
                            <Badge variant="outline" className="text-xs">
                              {order.payment_mode.replace("_", " ")}
                            </Badge>
                          )}
                        </div>
                        {order.customer_name && (
                          <p className="text-sm text-gray-600">{order.customer_name}</p>
                        )}
                        <p className="text-xs text-gray-500 mt-1">
                          {order.items?.length || 0} item(s) •{" "}
                          {new Date(order.created_at).toLocaleTimeString("en-GB", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="font-semibold text-gray-900">
                          £{order.total_amount.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-600">
                <Receipt className="h-12 w-12 mx-auto mb-3 text-gray-400" />
                <p>No unpaid orders found for this table</p>
              </div>
            )}

            {/* Payment Method Selection */}
            {unpaidOrders.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-3 text-gray-900">Select Payment Method</h4>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setSelectedMethod("cash")}
                    className={`flex flex-col items-center justify-center p-4 rounded-lg border-2 transition-all ${
                      selectedMethod === "cash"
                        ? "border-purple-600 bg-purple-50"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <Banknote
                      className={`h-8 w-8 mb-2 ${
                        selectedMethod === "cash" ? "text-purple-600" : "text-gray-400"
                      }`}
                    />
                    <span
                      className={`font-medium ${
                        selectedMethod === "cash" ? "text-purple-600" : "text-gray-700"
                      }`}
                    >
                      Cash
                    </span>
                  </button>

                  <button
                    onClick={() => setSelectedMethod("card")}
                    className={`flex flex-col items-center justify-center p-4 rounded-lg border-2 transition-all ${
                      selectedMethod === "card"
                        ? "border-purple-600 bg-purple-50"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <CreditCard
                      className={`h-8 w-8 mb-2 ${
                        selectedMethod === "card" ? "text-purple-600" : "text-gray-400"
                      }`}
                    />
                    <span
                      className={`font-medium ${
                        selectedMethod === "card" ? "text-purple-600" : "text-gray-700"
                      }`}
                    >
                      Card
                    </span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          {unpaidOrders.length > 0 && (
            <Button
              onClick={handlePayTable}
              disabled={loading || !selectedMethod || fetching}
              variant="servio"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Receipt className="mr-2 h-4 w-4" />
                  Pay £{unpaidTotal.toFixed(2)}
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}





