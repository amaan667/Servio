"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, XCircle, CreditCard } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Order {
  id: string;
  order_number: string;
  customer_name: string;
  items: Array<{
    item_name: string;
    quantity: number;
    price: number;
  }>;
  total_amount: number;
  payment_status: string;
  payment_mode: string;
  table_number: number | null;
  venue_id: string;
}

export default function PayLaterPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = params?.orderId as string;

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  // Fetch order details
  useEffect(() => {
    if (!orderId) return;

    const fetchOrder = async () => {
      try {
        const response = await fetch(`/api/orders/${orderId}`);
        if (!response.ok) {
          throw new Error("Order not found");
        }

        const data = await response.json();
        if (!data.order) {
          throw new Error("Order not found");
        }

        // Validate this is a pay_later order
        if (data.order.payment_mode !== "pay_later") {
          throw new Error("This order does not support pay later");
        }

        // Check if already paid
        if (data.order.payment_status === "PAID") {
          throw new Error("This order has already been paid");
        }

        setOrder(data.order);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load order");
      } finally {
        setLoading(false);
      }
    };

    fetchOrder();
  }, [orderId]);

  // Handle payment via Stripe
  const handlePayNow = async () => {
    if (!order) return;

    setProcessing(true);
    setError(null);

    try {
      console.info("💳 [PAY LATER] Creating Stripe checkout for order:", orderId);

      // Create Stripe checkout session for this order
      const response = await fetch("/api/stripe/create-customer-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: order.total_amount,
          customerEmail: "", // Optional
          customerName: order.customer_name,
          venueId: order.venue_id,
          venueName: "Restaurant", // Could fetch from venue data
          orderId: order.id, // Pass existing order ID
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to create checkout session");
      }

      const { url } = await response.json();

      console.info("✅ [PAY LATER] Redirecting to Stripe checkout");

      // Redirect to Stripe
      window.location.href = url;
    } catch (err) {
      console.error("❌ [PAY LATER] Payment error:", err);
      setError(err instanceof Error ? err.message : "Failed to process payment");
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center text-center">
              <XCircle className="h-12 w-12 text-red-500 mb-4" />
              <h2 className="text-xl font-semibold mb-2">Unable to Process Payment</h2>
              <p className="text-gray-600 mb-4">{error}</p>
              <Button onClick={() => router.push("/")} variant="outline">
                Go Home
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!order) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-2xl mx-auto py-8">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Complete Your Payment</CardTitle>
              <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
                Payment Pending
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Order Summary */}
            <div>
              <h3 className="font-semibold text-lg mb-2">Order Summary</h3>
              <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Order Number:</span>
                  <span className="font-medium">#{order.order_number}</span>
                </div>
                {order.table_number && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Table:</span>
                    <span className="font-medium">{order.table_number}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Customer:</span>
                  <span className="font-medium">{order.customer_name}</span>
                </div>
              </div>
            </div>

            {/* Order Items */}
            <div>
              <h3 className="font-semibold text-lg mb-2">Items</h3>
              <div className="space-y-2">
                {order.items?.map((item, index) => (
                  <div key={index} className="flex justify-between items-center py-2 border-b">
                    <div className="flex-1">
                      <span className="font-medium">{item.quantity}x</span> {item.item_name}
                    </div>
                    <span className="font-medium">£{(item.price * item.quantity).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Total */}
            <div className="bg-purple-50 rounded-lg p-4">
              <div className="flex justify-between items-center">
                <span className="text-lg font-semibold">Total Amount</span>
                <span className="text-2xl font-bold text-purple-600">
                  £{order.total_amount.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Payment Button */}
            <div className="space-y-3">
              <Button
                onClick={handlePayNow}
                disabled={processing}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white h-12 text-lg"
              >
                {processing ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <CreditCard className="mr-2 h-5 w-5" />
                    Pay £{order.total_amount.toFixed(2)} Now
                  </>
                )}
              </Button>

              <p className="text-sm text-gray-500 text-center">Secure payment powered by Stripe</p>
            </div>

            {/* Help Text */}
            <div className="bg-blue-50 rounded-lg p-4 text-sm text-gray-700">
              <p className="font-medium mb-1">📱 Rescanned QR Code?</p>
              <p>
                You can complete your payment now using card, Apple Pay, or Google Pay. Your order
                will be marked as complete once payment is confirmed.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
