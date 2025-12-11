"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, CreditCard, Users, AlertCircle, CheckCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface Order {
  id: string;
  customer_name?: string;
  total_amount: number;
  payment_mode?: string;
  items: Array<{
    item_name: string;
    quantity: number;
    price: number;
  }>;
  created_at: string;
}

interface TablePaymentScreenProps {
  venueId: string;
  tableNumber: number | string;
  customerName?: string;
  customerEmail?: string;
  onPaymentComplete?: () => void; // Used by parent component if provided
  onCancel?: () => void;
}

export function TablePaymentScreen({
  venueId,
  tableNumber,
  customerName,
  customerEmail,
  onPaymentComplete: _onPaymentComplete, // Prefixed with _ to indicate intentionally unused
  onCancel,
}: TablePaymentScreenProps) {
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [totalAmount, setTotalAmount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchUnpaidOrders();
  }, [venueId, tableNumber]);

  const fetchUnpaidOrders = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/orders/table/${tableNumber}/unpaid-for-payment?venue_id=${venueId}`
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
    } catch (_err) {
      setError(_err instanceof Error ? _err.message : "Failed to load orders");
    } finally {
      setLoading(false);
    }
  };

  const handlePayAll = async () => {
    if (orders.length === 0) {
      setError("No orders to pay");
      return;
    }

    setProcessing(true);
    setError(null);

    try {
      const orderIds = orders.map((o) => o.id);

      // Create Stripe checkout for all orders
      const response = await fetch("/api/stripe/create-table-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderIds,
          amount: totalAmount,
          customerEmail: customerEmail || "",
          customerName: customerName || "Customer",
          venueName: "Restaurant", // Could fetch from venue
          tableNumber,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to create checkout session");
      }

      const { url } = await response.json();

      if (url) {
        // Redirect to Stripe checkout
        window.location.href = url;
      } else {
        throw new Error("No checkout URL returned");
      }
    } catch (_err) {
      setError(_err instanceof Error ? _err.message : "Failed to process payment");
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-purple-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading unpaid orders...</p>
        </div>
      </div>
    );
  }

  if (error && orders.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">
              <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">Error</h2>
              <p className="text-gray-600 mb-4">{error}</p>
              {onCancel && (
                <Button onClick={onCancel} variant="outline">
                  Go Back
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // No unpaid orders - all settled
  if (orders.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">All Bills Settled</h2>
              <p className="text-gray-600 mb-4">
                There are no unpaid orders for Table {tableNumber}.
              </p>
              {onCancel && (
                <Button onClick={onCancel} variant="outline">
                  Continue Ordering
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Pay for Table {tableNumber}</h1>
          <p className="text-gray-600 mt-2">Complete payment for all unpaid orders</p>
        </div>

        {/* Error */}
        {error && (
          <Alert className="mb-6 border-red-200 bg-red-50">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <AlertTitle className="text-red-900">Error</AlertTitle>
            <AlertDescription className="text-red-800">{error}</AlertDescription>
          </Alert>
        )}

        {/* Summary Card */}
        <Card className="mb-6 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Order Summary</span>
              <Badge variant="outline" className="bg-purple-50 text-purple-700">
                {orders.length} order{orders.length !== 1 ? "s" : ""}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {orders.map((order) => (
                <div
                  key={order.id}
                  className="flex items-start justify-between p-4 bg-gray-50 rounded-lg border border-gray-200"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
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
                      <p className="text-sm text-gray-600 mb-1">{order.customer_name}</p>
                    )}
                    <p className="text-xs text-gray-500">
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

              <div className="pt-4 border-t-2 border-gray-300">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-semibold text-gray-900">Total Amount</span>
                  <span className="text-2xl font-bold text-purple-600">
                    £{totalAmount.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Payment Actions */}
        <Card className="mb-6 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-purple-600" />
              Payment Options
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              onClick={handlePayAll}
              disabled={processing}
              className="w-full h-14 text-lg bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
            >
              {processing ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Users className="h-5 w-5 mr-2" />
                  Pay All Orders - £{totalAmount.toFixed(2)}
                </>
              )}
            </Button>

            {onCancel && (
              <Button onClick={onCancel} variant="outline" className="w-full" disabled={processing}>
                Continue Ordering
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Info */}
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-4">
            <p className="text-sm text-blue-800">
              <strong>Note:</strong> This will pay for all {orders.length} unpaid order
              {orders.length !== 1 ? "s" : ""} at Table {tableNumber} in one transaction.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
