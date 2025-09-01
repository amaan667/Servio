"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CreditCard, Check, ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createOrder } from "@/lib/supabase";

interface CheckoutData {
  cart: Array<{
    id: string;
    name: string;
    price: number;
    quantity: number;
    category: string;
    venue_id: string;
  }>;
  total: number;
  venueId: string;
  tableNumber: number;
}

export default function PaymentPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [checkoutData, setCheckoutData] = useState<CheckoutData | null>(null);
  const [customerName, setCustomerName] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentComplete, setPaymentComplete] = useState(false);
  const [orderNumber, setOrderNumber] = useState("");

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
    if (!checkoutData || !customerName.trim()) return;

    setIsProcessing(true);

    try {
      // Simulate payment processing
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Create the order
      const orderResult = await createOrder({
        venue_id: checkoutData.venueId,
        table_number: checkoutData.tableNumber,
        customer_name: customerName.trim(),
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
        <Card className="w-full max-w-md text-center">
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
            <div className="space-y-3">
              <Button
                onClick={() =>
                  router.push(
                    `/order?venue=${checkoutData.venueId}&table=${checkoutData.tableNumber}`,
                  )
                }
                className="w-full bg-servio-purple hover:bg-servio-purple-dark"
              >
                Order More Items
              </Button>
              <Button
                onClick={() => router.push("/")}
                variant="outline"
                className="w-full bg-transparent"
              >
                Back to Home
              </Button>
            </div>
          </CardContent>
        </Card>
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
              <span className="text-gray-600">
                {checkoutData.cart.length} items
              </span>
            </div>
            {checkoutData.cart.map((item) => (
              <div
                key={item.id}
                className="flex justify-between items-center py-2 border-b last:border-b-0"
              >
                <div className="flex items-center space-x-2">
                  <span className="w-6 h-6 bg-servio-purple text-white rounded-full text-xs flex items-center justify-center">
                    {item.quantity}
                  </span>
                  <span className="text-sm">{item.name}</span>
                </div>
                <span className="font-medium">
                  £{(item.price * item.quantity).toFixed(2)}
                </span>
              </div>
            ))}
            <div className="flex justify-between items-center pt-3 border-t font-bold text-lg">
              <span>Total</span>
              <span className="text-green-600">
                £{checkoutData.total.toFixed(2)}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Customer Details */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Customer Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="customerName">Name for Order</Label>
              <Input
                id="customerName"
                type="text"
                placeholder="Enter your name"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="w-full"
              />
            </div>
          </CardContent>
        </Card>

        {/* Payment Method */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center space-x-2">
              <CreditCard className="h-5 w-5" />
              <span>Payment Method</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="cardNumber">Card Number</Label>
              <Input
                id="cardNumber"
                type="text"
                placeholder="1234 5678 9012 3456"
                className="w-full"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="expiry">Expiry Date</Label>
                <Input id="expiry" type="text" placeholder="MM/YY" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cvv">CVV</Label>
                <Input id="cvv" type="text" placeholder="123" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Pay Button */}
        <Button
          onClick={handlePayment}
          disabled={!customerName.trim() || isProcessing}
          className="w-full bg-servio-purple hover:bg-servio-purple-dark text-white py-4 text-lg font-semibold shadow-lg"
        >
          {isProcessing ? (
            <div className="flex items-center space-x-2">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Processing Payment...</span>
            </div>
          ) : (
            <div className="flex items-center justify-center space-x-2">
              <CreditCard className="h-5 w-5" />
              <span>Pay £{checkoutData.total.toFixed(2)}</span>
            </div>
          )}
        </Button>

        <p className="text-xs text-gray-500 text-center">
          This is a demo payment system. No real charges will be made.
        </p>
      </main>
    </div>
  );
}
