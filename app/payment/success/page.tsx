"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Check, Loader2, Receipt, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import UnifiedFeedbackForm from "@/components/UnifiedFeedbackForm";

export default function PaymentSuccessPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isProcessing, setIsProcessing] = useState(true);
  const [orderConfirmed, setOrderConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [tableNumber, setTableNumber] = useState<string | null>(null);
  const [total, setTotal] = useState<string | null>(null);
  const [venueId, setVenueId] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState<string | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<string | null>(null);
  const [orderType, setOrderType] = useState<string | null>(null);

  // Generate short order number for display
  const getShortOrderNumber = (orderId: string) => {
    // Use last 6 characters of UUID for shorter display
    return orderId.slice(-6).toUpperCase();
  };

  useEffect(() => {
    const orderIdParam = searchParams?.get('orderId');
    const sessionIdParam = searchParams?.get('session_id');
    const tableNumberParam = searchParams?.get('tableNumber');
    const totalParam = searchParams?.get('total');
    const venueIdParam = searchParams?.get('venueId');
    const customerNameParam = searchParams?.get('customerName');
    const paymentMethodParam = searchParams?.get('paymentMethod');
    const orderTypeParam = searchParams?.get('orderType');

    if (!orderIdParam) {
      setError('Invalid payment session - no order ID provided');
      setIsProcessing(false);
      return;
    }

    setOrderId(orderIdParam);
    setTableNumber(tableNumberParam || null);
    setTotal(totalParam || null);
    setVenueId(venueIdParam || null);
    setCustomerName(customerNameParam || null);
    setPaymentMethod(paymentMethodParam || null);
    setOrderType(orderTypeParam || null);

    // Verify payment and get order details
    const verifyPaymentAndGetOrder = async () => {
      try {
        // For Stripe payments, verify the payment first
        if (paymentMethodParam === 'stripe' && sessionIdParam) {
          console.log('[PAYMENT SUCCESS] Verifying Stripe payment...');
          
          // Try verification with retry logic since webhook might be delayed
          let verifyResponse;
          let verifyData;
          let retryCount = 0;
          const maxRetries = 3;
          
          while (retryCount < maxRetries) {
            verifyResponse = await fetch(`/api/checkout/verify?orderId=${orderIdParam}&sessionId=${sessionIdParam}`);
            verifyData = await verifyResponse.json();
            
            if (verifyResponse.ok && verifyData.paid) {
              console.log('[PAYMENT SUCCESS] Payment verified successfully');
              break;
            }
            
            retryCount++;
            if (retryCount < maxRetries) {
              console.log(`[PAYMENT SUCCESS] Verification failed, retrying... (${retryCount}/${maxRetries})`);
              await new Promise(resolve => setTimeout(resolve, 2000));
            }
          }
          
          if (!verifyResponse.ok || !verifyData.paid) {
            console.error('[PAYMENT SUCCESS] Payment verification failed after retries:', verifyData);
            setError('Payment verification failed. Please contact support.');
            setIsProcessing(false);
            return;
          }
          
          // Update order ID if verification returned a different one
          if (verifyData.orderId && verifyData.orderId !== orderIdParam) {
            setOrderId(verifyData.orderId);
          }
        }
        
        // Order is confirmed, show success
        setOrderConfirmed(true);
      } catch (err) {
        console.error('[PAYMENT SUCCESS] Error verifying payment:', err);
        setError('Failed to verify payment. Please contact support.');
      } finally {
        setIsProcessing(false);
      }
    };

    verifyPaymentAndGetOrder();
  }, [searchParams]);

  const handleReturn = () => {
    const returnUrl = searchParams?.get('returnUrl');
    if (returnUrl) {
      window.location.href = returnUrl;
    } else {
      // Construct the correct return URL to the table's menu page
      if (venueId && tableNumber && orderType) {
        const menuUrl = orderType === 'counter' 
          ? `/order?venue=${venueId}&counter=${tableNumber}`
          : `/order?venue=${venueId}&table=${tableNumber}`;
        router.push(menuUrl);
      } else {
        // Fallback to home page if we don't have the necessary parameters
        router.push('/');
      }
    }
  };

  const getSuccessMessage = () => {
    switch (paymentMethod) {
      case 'demo':
      case 'stripe':
        return {
          title: "Payment Successful!",
          description: "Your order has been confirmed and is being prepared.",
          icon: "✅"
        };
      case 'till':
        return {
          title: "Bill Sent to Till!",
          description: "Please pay with staff when ready. Your order is being prepared.",
          icon: "📨"
        };
      case 'later':
        return {
          title: "Order Created!",
          description: "You can pay later by scanning this table's QR again or at the till.",
          icon: "⏳"
        };
      default:
        return {
          title: "Order Confirmed!",
          description: "Your order has been processed and is being prepared.",
          icon: "✅"
        };
    }
  };

  if (isProcessing) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-full max-w-md text-center">
          <CardContent className="p-8">
            <Loader2 className="h-12 w-12 animate-spin text-green-600 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Processing Payment</h2>
            <p className="text-gray-600">Please wait while we confirm your order...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-full max-w-md text-center">
          <CardContent className="p-8">
            <div className="h-12 w-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-red-600 text-xl">!</span>
            </div>
            <h2 className="text-xl font-semibold mb-2 text-red-600">Payment Error</h2>
            <p className="text-gray-600 mb-4">{error}</p>
            <Button onClick={handleReturn} className="w-full">
              Return to Order
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const successMessage = getSuccessMessage();

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-white flex items-center justify-center p-4">
      <Card className="w-full max-w-md text-center">
        <CardContent className="p-8">
          <div className="h-16 w-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check className="h-8 w-8 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">{successMessage.title}</h2>
          <p className="text-gray-600 mb-6">
            {successMessage.description}
          </p>
          
          {/* Order Details */}
          <div className="bg-gray-50 p-4 rounded-lg mb-6">
            <p className="text-sm text-gray-600">Order Number</p>
            <p className="font-bold text-lg text-servio-purple mb-2">
              #{orderId ? getShortOrderNumber(orderId) : 'N/A'}
            </p>
            {tableNumber && (
              <>
                <p className="text-sm text-gray-600">
                  {orderType === 'counter' ? 'Counter' : 'Table'}
                </p>
                <p className="font-medium text-gray-900 mb-2">
                  {orderType === 'counter' ? `Counter ${tableNumber}` : `Table ${tableNumber}`}
                </p>
              </>
            )}
            {total && (
              <>
                <p className="text-sm text-gray-600">Total</p>
                <p className="font-bold text-lg text-green-600">£{parseFloat(total).toFixed(2)}</p>
              </>
            )}
          </div>
          
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-green-800">
              You will receive a confirmation shortly. Thank you for your order!
            </p>
          </div>

          <div className="space-y-3">
            <Button 
              onClick={() => setShowFeedback(true)}
              className="w-full bg-purple-600 hover:bg-purple-700"
            >
              <Star className="h-4 w-4 mr-2" />
              Leave Feedback
            </Button>
            <Button 
              onClick={() => router.push(`/order-summary/${orderId}`)}
              className="w-full bg-servio-purple hover:bg-servio-purple-dark"
            >
              <Receipt className="h-4 w-4 mr-2" />
              View Order Summary
            </Button>
            <Button onClick={handleReturn} variant="outline" className="w-full">
              Return to Menu
            </Button>
          </div>
        </CardContent>
      </Card>
      
      {/* Feedback Form Modal */}
      {showFeedback && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Feedback</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowFeedback(false)}
                >
                  ✕
                </Button>
              </div>
            </div>
            <div className="p-4">
              {venueId && (
                <UnifiedFeedbackForm
                  venueId={venueId}
                  orderId={orderId || undefined}
                  customerName={customerName || undefined}
                  onSubmit={() => setShowFeedback(false)}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
