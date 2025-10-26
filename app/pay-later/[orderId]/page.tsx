"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, XCircle, CreditCard, Store, AlertCircle, CheckCircle2, Hash } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

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
  const [switchedToTill, setSwitchedToTill] = useState(false);
  const [switching, setSwitching] = useState(false);

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

  // Handle switching to pay at till
  const handleSwitchToTill = async () => {
    if (!order) return;

    setSwitching(true);
    setError(null);

    try {
      console.info("🏪 [PAY LATER] Customer switching to pay at till:", orderId);

      const response = await fetch(`/api/orders/${orderId}/update-payment-mode`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          new_payment_mode: "pay_at_till",
          venue_id: order.venue_id,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to switch payment method");
      }

      const result = await response.json();
      console.info("✅ [PAY LATER] Successfully switched to till payment:", result);

      // Update local order state
      setOrder({ ...order, payment_mode: "pay_at_till" });
      setSwitchedToTill(true);
    } catch (err) {
      console.error("❌ [PAY LATER] Switch error:", err);
      setError(err instanceof Error ? err.message : "Failed to switch payment method");
    } finally {
      setSwitching(false);
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
              <Badge
                variant="outline"
                className={
                  switchedToTill
                    ? "bg-green-50 text-green-700 border-green-200"
                    : "bg-orange-50 text-orange-700 border-orange-200"
                }
              >
                {switchedToTill ? "Payment at Till" : "Payment Pending"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Success message when switched to till */}
            {switchedToTill && (
              <Alert className="border-green-200 bg-green-50">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <AlertTitle className="text-green-900 font-semibold">
                  Payment Method Updated!
                </AlertTitle>
                <AlertDescription className="text-green-800 space-y-3">
                  <p>Your order is now set to be paid at the till.</p>

                  {/* Customer notification code */}
                  <div className="bg-white rounded-lg border-2 border-green-300 p-4 mt-3">
                    <p className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                      <Hash className="h-4 w-4" />
                      Show this to staff:
                    </p>
                    <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg p-4 border border-purple-200">
                      <div className="text-center space-y-1">
                        <p className="text-xs text-gray-600 uppercase tracking-wide">
                          Order Number
                        </p>
                        <p className="text-3xl font-bold text-purple-600 tracking-wider">
                          #{order.order_number}
                        </p>
                        <p className="text-sm text-gray-700 mt-2">
                          Table {order.table_number || "—"}
                        </p>
                        <p className="text-lg font-semibold text-gray-900 mt-3">
                          £{order.total_amount.toFixed(2)}
                        </p>
                      </div>
                    </div>
                    <p className="text-xs text-gray-600 mt-3 text-center">
                      Staff will use this to find your order at the till
                    </p>
                  </div>

                  <div className="flex items-start gap-2 mt-4 bg-blue-50 rounded-lg p-3 border border-blue-200">
                    <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                    <div className="text-sm text-blue-900">
                      <p className="font-medium mb-1">Next Steps:</p>
                      <ol className="list-decimal list-inside space-y-1 text-blue-800">
                        <li>Take a screenshot of your order number</li>
                        <li>Go to the till/counter</li>
                        <li>Show your order number to staff</li>
                        <li>Complete payment (cash or card)</li>
                      </ol>
                    </div>
                  </div>
                </AlertDescription>
              </Alert>
            )}
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

            {/* Payment Options */}
            {!switchedToTill ? (
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-3">Choose Payment Method:</p>

                  {/* Primary: Pay Online */}
                  <Button
                    onClick={handlePayNow}
                    disabled={processing || switching}
                    className="w-full bg-purple-600 hover:bg-purple-700 text-white h-14 text-lg mb-3"
                  >
                    {processing ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <CreditCard className="mr-2 h-5 w-5" />
                        Pay £{order.total_amount.toFixed(2)} Online Now
                      </>
                    )}
                  </Button>

                  <p className="text-xs text-gray-500 text-center mb-4">
                    Secure payment • Card, Apple Pay, Google Pay
                  </p>

                  {/* Secondary: Switch to Till */}
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-gray-200"></div>
                    </div>
                    <div className="relative flex justify-center text-xs">
                      <span className="bg-white px-2 text-gray-500">or</span>
                    </div>
                  </div>

                  <Button
                    onClick={handleSwitchToTill}
                    disabled={processing || switching}
                    variant="outline"
                    className="w-full h-12 text-base mt-4 border-2 hover:bg-gray-50"
                  >
                    {switching ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Switching...
                      </>
                    ) : (
                      <>
                        <Store className="mr-2 h-5 w-5" />
                        Pay at Till Instead
                      </>
                    )}
                  </Button>

                  <p className="text-xs text-gray-500 text-center mt-2">
                    Changed your mind? Pay in person at the till
                  </p>
                </div>

                {/* Help Text */}
                <div className="bg-blue-50 rounded-lg p-4 text-sm text-gray-700">
                  <p className="font-medium mb-1">📱 Rescanned QR Code?</p>
                  <p>
                    Choose how you&apos;d like to pay. Online payment is instant, or you can switch
                    to paying at the till if you prefer.
                  </p>
                </div>
              </div>
            ) : (
              /* Already switched to till - show confirmation only */
              <div className="text-center py-4">
                <p className="text-gray-600">
                  Your payment preference has been updated. Please proceed to the till to complete
                  your payment.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
