"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Check, ArrowLeft } from "lucide-react";
import { createOrder } from "@/lib/supabase";
import { CustomerFeedbackForm } from "@/components/customer-feedback-form";

interface CheckoutData {
  venueId: string;
  tableNumber: number;
  cart: Array<{
    id: string;
    name: string;
    price: number;
    quantity: number;
  }>;
  total: number;
}

export default function PaymentPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [checkoutData, setCheckoutData] = useState<CheckoutData | null>(null);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentComplete, setPaymentComplete] = useState(false);
  const [orderNumber, setOrderNumber] = useState("");
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);

  useEffect(() => {
    // Get checkout data from localStorage
    const storedData = localStorage.getItem("servio-checkout-data");
    if (storedData) {
      const data = JSON.parse(storedData);
      setCheckoutData(data);
    } else {
      // Redirect back if no checkout data
      router.push("/order");
    }
  }, [router]);

  const handlePayment = async () => {
    if (!checkoutData || !customerName.trim() || !customerPhone.trim()) return;

    setIsProcessing(true);

    try {
      // Simulate payment processing
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Create the order
      const orderResult = await createOrder({
        venue_id: checkoutData.venueId,
        table_number: checkoutData.tableNumber,
        customer_name: customerName.trim(),
        customer_phone: customerPhone.trim(),
        items: checkoutData.cart.map((item) => ({
          menu_item_id: item.id,
          quantity: item.quantity,
          price: item.price,
          item_name: item.name,
        })),
        total_amount: checkoutData.total,
      });

      if (orderResult.success) {
        setOrderNumber(orderResult.data?.order_number?.toString() || "ORD-001");
        setPaymentComplete(true);
        // Clear checkout data
        localStorage.removeItem("servio-checkout-data");
      } else {
        throw new Error(orderResult.message);
      }
    } catch (error) {
      console.error("Payment error:", error);
      const errorMessage = error instanceof Error ? error.message : "Payment failed. Please try again.";
      alert(`Payment failed: ${errorMessage}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFeedbackSubmitted = () => {
    setFeedbackSubmitted(true);
  };

  if (!checkoutData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-servio-purple mx-auto mb-4"></div>
          <p className="text-gray-600">Loading checkout...</p>
        </div>
      </div>
    );
  }

  if (paymentComplete) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-white flex items-center justify-center p-4">
        <div className="w-full max-w-md space-y-6">
          {/* Order Confirmation */}
          <Card className="text-center">
            <CardContent className="p-8">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check className="h-8 w-8 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Payment Successful!
              </h2>
              <p className="text-gray-600 mb-4">
                Your order has been confirmed and sent to the kitchen.
              </p>
              <div className="bg-gray-50 p-4 rounded-lg mb-6">
                <p className="text-sm text-gray-600">Order Number</p>
                <p className="font-bold text-lg text-servio-purple">
                  {orderNumber}
                </p>
                <p className="text-sm text-gray-600 mt-2">
                  Table {checkoutData.tableNumber}
                </p>
                <p className="text-lg font-bold text-green-600">
                  Total: £{checkoutData.total.toFixed(2)}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Feedback Form */}
          {!feedbackSubmitted && (
            <CustomerFeedbackForm
              venueId={checkoutData.venueId}
              orderId={orderNumber}
              customerName={customerName}
              customerPhone={customerPhone}
              onFeedbackSubmitted={handleFeedbackSubmitted}
            />
          )}

          {/* Action Buttons */}
          <div className="space-y-3">
            <Button
              onClick={() =>
                router.push(
                  `/order-tracking/${orderNumber}`,
                )
              }
              className="w-full bg-servio-purple hover:bg-servio-purple-dark"
            >
              Track Your Order
            </Button>
            <Button
              onClick={() =>
                router.push(
                  `/order?venue=${checkoutData.venueId}&table=${checkoutData.tableNumber}`,
                )
              }
              variant="outline"
              className="w-full"
            >
              Place Another Order
            </Button>
            <Button
              onClick={() => router.push("/")}
              variant="outline"
              className="w-full bg-transparent"
            >
              Back to Home
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-servio-purple text-white p-4 sticky top-0 z-30 shadow-md">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.back()}
            className="text-white hover:bg-white/20 rounded-full"
          >
            <ArrowLeft className="h-5 w-5" />
            <span className="sr-only">Back</span>
          </Button>
          <h1 className="font-semibold text-lg">Checkout</h1>
          <div className="w-10"></div>
        </div>
      </header>

      <main className="max-w-md mx-auto p-4 space-y-6">
        {/* Order Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Order Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">
                Table {checkoutData.tableNumber}
              </span>
              <span className="font-medium">
                {checkoutData.cart.reduce((total, item) => total + item.quantity, 0)} items
              </span>
            </div>
            <div className="border-t pt-3">
              {checkoutData.cart.map((item, index) => (
                <div key={index} className="flex justify-between text-sm mb-2">
                  <span className="text-gray-600">
                    {item.quantity}x {item.name}
                  </span>
                  <span className="font-medium">
                    £{(item.price * item.quantity).toFixed(2)}
                  </span>
                </div>
              ))}
              <div className="border-t pt-2 flex justify-between font-semibold">
                <span>Total</span>
                <span className="text-green-600">£{checkoutData.total.toFixed(2)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Customer Information */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Customer Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label htmlFor="customerName" className="block text-sm font-medium text-gray-700 mb-1">
                Full Name *
              </label>
              <Input
                id="customerName"
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Enter your full name"
                required
              />
            </div>
            <div>
              <label htmlFor="customerPhone" className="block text-sm font-medium text-gray-700 mb-1">
                Phone Number *
              </label>
              <Input
                id="customerPhone"
                type="tel"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="Enter your phone number"
                required
              />
            </div>
          </CardContent>
        </Card>

        {/* Payment Button */}
        <Button
          onClick={handlePayment}
          disabled={isProcessing || !customerName.trim() || !customerPhone.trim()}
          className="w-full bg-servio-purple hover:bg-servio-purple-dark disabled:bg-gray-300"
        >
          {isProcessing ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              Processing Payment...
            </>
          ) : (
            `Pay £${checkoutData.total.toFixed(2)}`
          )}
        </Button>

        {/* Payment Note */}
        <p className="text-xs text-gray-500 text-center">
          This is a demo payment. In production, this would integrate with a real payment processor.
        </p>
      </main>
    </div>
  );
}
