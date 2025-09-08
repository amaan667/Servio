"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Check, ArrowLeft, CreditCard, Clock } from "lucide-react";
import { createOrder, updateOrderPaymentStatus } from "@/lib/supabase";
import { CustomerFeedbackForm } from "@/components/customer-feedback-form";
import { OrderTimeline } from "@/components/order-timeline";

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
  tableId?: string | null;
  sessionId?: string | null;
  orderId?: string; // The ID of the already created order
  orderNumber?: string; // The order number for display
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
  const [error, setError] = useState<string | null>(null);

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
    console.log('[PAYMENT DEBUG] ===== PAY NOW HANDLER STARTED =====');
    
    if (!checkoutData || !customerName.trim() || !customerPhone.trim() || !checkoutData.orderId) {
      console.log('[PAYMENT DEBUG] ERROR: Missing required data');
      return;
    }

    setIsProcessing(true);

    try {
      // Step 1: Process payment (order already exists)
      console.log('[PAYMENT DEBUG] Step 1: Processing payment for existing order...');
      
      // Simulate payment processing (in production, this would be Stripe/real payment)
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate payment delay
      
      // For demo purposes, assume payment always succeeds
      const paymentSuccess = true;
      
      if (paymentSuccess) {
        // Step 2: Update payment status to paid
        console.log('[PAYMENT DEBUG] Step 2: Payment successful, updating status...');
        const updateResult = await updateOrderPaymentStatus(
          checkoutData.orderId, 
          'paid', 
          'online'
        );
        
        if (!updateResult.success) {
          console.error('[PAYMENT DEBUG] Failed to update payment status:', updateResult.message);
          throw new Error('Failed to update payment status');
        }
        
        setOrderNumber(checkoutData.orderNumber || "ORD-001");
        setPaymentComplete(true);
        localStorage.removeItem("servio-checkout-data");
      } else {
        // Payment failed - order exists but remains unpaid
        throw new Error('Payment failed');
      }
    } catch (error) {
      console.error('[PAYMENT DEBUG] Payment error:', error);
      setError(error instanceof Error ? error.message : 'Payment failed. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePayAtTill = async () => {
    console.log('[PAY AT TILL DEBUG] ===== PAY AT TILL HANDLER STARTED =====');
    
    if (!checkoutData || !customerName.trim() || !customerPhone.trim() || !checkoutData.orderId) {
      console.log('[PAY AT TILL DEBUG] ERROR: Missing required data');
      return;
    }

    setIsProcessing(true);

    try {
      // Step 1: Update existing order to 'till' payment status
      console.log('[PAY AT TILL DEBUG] Step 1: Updating order for pay at till...');
      
      const updateResult = await updateOrderPaymentStatus(
        checkoutData.orderId, 
        'till', 
        'till'
      );

      if (updateResult.success) {
        console.log('[PAY AT TILL DEBUG] Order updated successfully:', updateResult.data);
        
        setOrderNumber(checkoutData.orderNumber || "ORD-001");
        setPaymentComplete(true);
        localStorage.removeItem("servio-checkout-data");
        
        // Send bill to table management
        await sendBillToTableManagement(updateResult.data);
      } else {
        setError(updateResult.message || 'Failed to update order');
      }
    } catch (err: any) {
      console.error('[PAY AT TILL DEBUG] Error:', err);
      setError(err.message || 'Failed to process order. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePayLater = async () => {
    console.log('[PAY LATER DEBUG] ===== PAY LATER HANDLER STARTED =====');
    
    if (!checkoutData || !customerName.trim() || !customerPhone.trim() || !checkoutData.orderId) {
      console.log('[PAY LATER DEBUG] ERROR: Missing required data');
      return;
    }

    setIsProcessing(true);

    try {
      // Step 1: Update existing order to 'later' payment method (keeps unpaid status)
      console.log('[PAY LATER DEBUG] Step 1: Updating order for pay later...');
      
      const updateResult = await updateOrderPaymentStatus(
        checkoutData.orderId, 
        'unpaid', // Keep as unpaid
        'later'
      );

      if (updateResult.success) {
        console.log('[PAY LATER DEBUG] Order updated successfully:', updateResult.data);
        
        setOrderNumber(checkoutData.orderNumber || "ORD-001");
        setPaymentComplete(true);
        
        // Store session data for later payment detection
        const sessionData = {
          orderId: checkoutData.orderId,
          tableNumber: checkoutData.tableNumber,
          venueId: checkoutData.venueId,
          total: checkoutData.total,
          customerName: customerName.trim(),
          customerPhone: customerPhone.trim(),
          paymentStatus: 'unpaid'
        };
        
        // Store session for table-based orders
        if (checkoutData.tableNumber) {
          localStorage.setItem(`servio-session-${checkoutData.tableNumber}`, JSON.stringify(sessionData));
        }
        
        // Store session for session-based orders
        if (checkoutData.sessionId) {
          localStorage.setItem(`servio-session-${checkoutData.sessionId}`, JSON.stringify(sessionData));
        }
        
        localStorage.removeItem("servio-checkout-data");
      } else {
        setError(updateResult.message || 'Failed to update order');
      }
    } catch (err: any) {
      console.error('[PAY LATER DEBUG] Error:', err);
      setError(err.message || 'Failed to process order. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const sendBillToTableManagement = async (orderData: any) => {
    try {
      console.log('[TABLE MANAGEMENT DEBUG] Sending bill to table management:', orderData);
      
      // Create a bill record for table management
      const billData = {
        venue_id: orderData.venue_id,
        table_number: orderData.table_number,
        customer_name: orderData.customer_name,
        customer_phone: orderData.customer_phone,
        total_amount: orderData.total_amount,
        items: orderData.items,
        payment_method: 'PAY_AT_TILL',
        status: 'PENDING',
        created_at: new Date().toISOString()
      };

      // Store in localStorage for now (in production, this would go to a database)
      const existingBills = JSON.parse(localStorage.getItem('servio-table-bills') || '[]');
      existingBills.push(billData);
      localStorage.setItem('servio-table-bills', JSON.stringify(existingBills));

      console.log('[TABLE MANAGEMENT DEBUG] Bill sent successfully');
    } catch (error) {
      console.error('[TABLE MANAGEMENT DEBUG] Error sending bill:', error);
    }
  };

  const handleFeedbackSubmitted = () => {
    setFeedbackSubmitted(true);
  };

  if (!checkoutData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
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

          {/* Order Timeline */}
          <OrderTimeline
            orderId={orderNumber}
            currentStatus="placed"
            estimatedTime="15-20 minutes"
          />

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
                onChange={(e) => {
                  console.log('[PAYMENT DEBUG] Customer name changed:', e.target.value);
                  setCustomerName(e.target.value);
                }}
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
                onChange={(e) => {
                  console.log('[PAYMENT DEBUG] Customer phone changed:', e.target.value);
                  setCustomerPhone(e.target.value);
                }}
                placeholder="Enter your phone number"
                required
              />
            </div>
          </CardContent>
        </Card>

        {/* Payment Options */}
        <div className="space-y-3">
          {/* Pay Now Button */}
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
              `Pay Now £${checkoutData.total.toFixed(2)}`
            )}
          </Button>

          {/* Pay at Till Button */}
          <Button
            onClick={() => handlePayAtTill()}
            disabled={isProcessing || !customerName.trim() || !customerPhone.trim()}
            variant="outline"
            className="w-full border-2 border-servio-purple text-servio-purple hover:bg-servio-purple hover:text-white"
          >
            <CreditCard className="h-4 w-4 mr-2" />
            Pay at Till £{checkoutData.total.toFixed(2)}
          </Button>

          {/* Pay Later Button */}
          <Button
            onClick={() => handlePayLater()}
            disabled={isProcessing || !customerName.trim() || !customerPhone.trim()}
            variant="outline"
            className="w-full border-2 border-gray-400 text-gray-600 hover:bg-gray-100"
          >
            <Clock className="h-4 w-4 mr-2" />
            Pay Later £{checkoutData.total.toFixed(2)}
          </Button>
        </div>

        {/* Payment Note */}
        <p className="text-xs text-gray-500 text-center">
          Choose your preferred payment method. Pay at Till sends the bill to staff for payment at the counter.
        </p>
      </main>
    </div>
  );
}
