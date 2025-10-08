"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Check, 
  ArrowLeft, 
  CreditCard, 
  Clock, 
  Shield,
  Receipt,
  Star,
  Loader2
} from "lucide-react";
import { CustomerFeedbackForm } from "@/components/customer-feedback-form";
import { OrderTimeline } from "@/components/order-timeline";

interface CheckoutData {
  venueId: string;
  venueName?: string;
  tableNumber: number;
  cart: Array<{
    id: string;
    name: string;
    price: number;
    quantity: number;
    specialInstructions?: string;
  }>;
  total: number;
  tableId?: string | null;
  sessionId?: string | null;
  orderId?: string;
  orderNumber?: string;
  customerName?: string;
  customerPhone?: string;
  orderType?: string; // Add orderType for source determination
  isDemo?: boolean; // Add isDemo flag for demo mode detection
}

type PaymentAction = 'demo' | 'stripe' | 'till' | 'later';

export default function PaymentPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [checkoutData, setCheckoutData] = useState<CheckoutData | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentComplete, setPaymentComplete] = useState(false);
  const [orderNumber, setOrderNumber] = useState("");
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paymentAction, setPaymentAction] = useState<PaymentAction | null>(null);
  const [isDemo, setIsDemo] = useState(false);
  
  // Check for demo mode from URL parameter as well
  const isDemoFromUrl = searchParams?.get('demo') === '1';

  useEffect(() => {
    // Debug current URL and search params
    console.log('[PAYMENT DEBUG] Current URL:', window.location.href);
    console.log('[PAYMENT DEBUG] Search params:', Object.fromEntries(searchParams?.entries() || []));
    console.log('[PAYMENT DEBUG] isDemoFromUrl:', isDemoFromUrl);
    
    // Get checkout data from localStorage
    const storedData = localStorage.getItem("servio-checkout-data");
    
    console.log('[PAYMENT DEBUG] Loading checkout data:', storedData);
    
    if (storedData) {
      try {
        const data = JSON.parse(storedData);
        console.log('[PAYMENT DEBUG] Parsed checkout data:', data);
        setCheckoutData(data);
        setIsDemo(data.isDemo || false); // Set demo flag from checkout data
        console.log('[PAYMENT DEBUG] Demo flag set to:', data.isDemo || false);
        
        // If demo mode is detected, show immediate redirect message
        if (data.isDemo || isDemoFromUrl) {
          console.log('[PAYMENT DEBUG] DEMO MODE DETECTED - should redirect immediately');
        }
      } catch (error) {
        console.error('[PAYMENT DEBUG] Error parsing checkout data:', error);
        router.push("/order");
      }
    } else {
      // Redirect back if no checkout data
      router.push("/order");
    }
  }, [router, isDemoFromUrl]);

  const handlePayment = async (action: PaymentAction) => {
    console.log('[PAYMENT DEBUG] handlePayment called with action:', action);
    
    if (!checkoutData) {
      setError('Missing order information. Please try again.');
      return;
    }

    setError(null);
    setIsProcessing(true);
    setPaymentAction(action);

    try {
      // Debug logging for demo mode
      console.log('[PAYMENT DEBUG] Demo mode check:', { 
        isDemo, 
        checkoutDataIsDemo: checkoutData.isDemo, 
        isDemoFromUrl,
        finalDemoCheck: isDemo || checkoutData.isDemo || isDemoFromUrl
      });
      
      // In demo mode, skip all payment processing and go straight to success
      if (isDemo || checkoutData.isDemo || isDemoFromUrl) {
        console.log('[PAYMENT DEBUG] Demo mode detected - skipping payment processing');
        const demoOrderId = `demo-${Date.now()}`;
        
        // Redirect to payment success page immediately
        const successUrl = `/payment/success?orderId=${demoOrderId}&demo=1&paymentMethod=${action}`;
        router.push(successUrl);
        localStorage.removeItem("servio-checkout-data");
        return;
      }

      // Handle different payment types
      if (action === 'stripe') {
        
        // Check if we already have an order ID (we should!)
        if (!checkoutData.orderId) {
          throw new Error('No order ID found. Please try submitting your order again.');
        }

        console.log('[PAYMENT DEBUG] Using existing order ID for Stripe:', checkoutData.orderId);
        
        // Create Stripe checkout session with the existing order ID
        const checkoutResponse = await fetch('/api/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            orderId: checkoutData.orderId, // Use the real order ID that was created
            total: checkoutData.total, 
            currency: 'GBP',
            venueId: checkoutData.venueId,
            tableNumber: checkoutData.tableNumber,
            customerName: checkoutData.customerName || 'Customer',
            customerPhone: checkoutData.customerPhone || '+1234567890',
            items: checkoutData.cart.map(item => ({
              menu_item_id: item.id,
              quantity: item.quantity,
              price: item.price,
              item_name: item.name,
              specialInstructions: item.specialInstructions || null
            })),
            source: checkoutData.orderType === 'counter' ? 'counter' : 'qr'
          }),
        });
        
        const { url, sessionId, error: checkoutErr } = await checkoutResponse.json();
        if (!checkoutResponse.ok || !(url || sessionId)) {
          throw new Error(checkoutErr || 'Checkout failed');
        }

        console.log('[PAYMENT DEBUG] Stripe session created:', sessionId, 'for order:', checkoutData.orderId);

        // Redirect to Stripe checkout - payment will mark existing order as PAID
        if (url) {
          window.location.assign(url);
          return; // Don't continue to order creation
        } else {
          throw new Error('No checkout URL received');
        }
      }

      // For non-Stripe payments (Pay Later, Pay at Till), create the order immediately with UNPAID status
      const orderPayload = {
        venue_id: checkoutData.venueId,
        table_number: checkoutData.tableNumber,
        customer_name: checkoutData.customerName || 'Customer',
        customer_phone: checkoutData.customerPhone || '+1234567890',
        items: checkoutData.cart.map(item => ({
          menu_item_id: item.id,
          quantity: item.quantity,
          price: item.price,
          item_name: item.name,
          specialInstructions: item.specialInstructions || null
        })),
        total_amount: Math.round(checkoutData.total * 100), // Convert to pence
        order_status: 'PLACED',
        payment_status: action === 'till' ? 'TILL' : action === 'later' ? 'PAY_LATER' : 'UNPAID',
        payment_method: action === 'demo' ? 'demo' : action === 'till' ? 'till' : 'later',
        source: checkoutData.orderType === 'counter' ? 'counter' : 'qr', // Set source based on order type
        notes: `${action} payment order`
      };

      const orderResponse = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(orderPayload),
      });

      if (!orderResponse.ok) {
        const errorText = await orderResponse.text();
        console.error('[PAYMENT DEBUG] Order creation failed with status:', orderResponse.status);
        console.error('[PAYMENT DEBUG] Error response:', errorText);
        throw new Error(`Failed to create order: ${orderResponse.status} - ${errorText}`);
      }

      const orderData = await orderResponse.json();
      
      // Additional debugging for the order object
      if (orderData.order) {
        // Debug logging removed for performance
      }

      // Check if we have a valid order ID
      if (!orderData.order?.id) {
        console.error('[PAYMENT DEBUG] ERROR: No order ID in response');
        console.error('[PAYMENT DEBUG] Response structure:', {
          hasOrder: !!orderData.order,
          orderKeys: orderData.order ? Object.keys(orderData.order) : 'no order object',
          fullResponse: JSON.stringify(orderData, null, 2)
        });
        
        // If the order was created but we can't get the ID, try to continue anyway
        // This might be a response parsing issue
        if (orderData.order) {
          console.warn('[PAYMENT DEBUG] Order created but ID missing, attempting to continue...');
          // Try to extract ID from other fields or use a fallback
          const fallbackId = (orderData.order as any).order_id || `temp-${Date.now()}`;
          orderData.order.id = fallbackId;
        } else {
          // Even if we can't get the order ID, the order was created
          // We can still proceed with payment processing
          console.warn('[PAYMENT DEBUG] No order object in response, proceeding with fallback...');
          orderData.order = { id: `temp-${Date.now()}` };
        }
      }

      // Redirect to success page for non-Stripe payments (Stripe redirects to checkout)
      setOrderNumber(orderData.order.id || "ORD-001");
      
      // Redirect to payment success page with order ID and additional data
      const successUrl = `/payment/success?orderId=${orderData.order.id}&demo=0&paymentMethod=${action}`;
      router.push(successUrl);
      
      localStorage.removeItem("servio-checkout-data");

    } catch (error) {
      console.error('[PAYMENT DEBUG] Payment error:', error);
      setError(error instanceof Error ? error.message : 'Payment failed. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFeedbackSubmitted = () => {
    setFeedbackSubmitted(true);
  };

  const getSuccessMessage = () => {
    switch (paymentAction) {
      case 'demo':
      case 'stripe':
        return {
          title: "✅ Payment successful",
          description: "Your order has been confirmed and sent to the kitchen."
        };
      case 'till':
        return {
          title: "📨 Bill sent to the counter",
          description: "Please pay with staff when ready."
        };
      case 'later':
        return {
          title: "⏳ Order placed",
          description: "You can pay later by scanning this table's QR again or at the counter."
        };
      default:
        return {
          title: "✅ Order confirmed",
          description: "Your order has been processed."
        };
    }
  };

  if (!checkoutData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-gray-900" />
          <p className="text-gray-900">Loading checkout...</p>
        </div>
      </div>
    );
  }

  if (paymentComplete) {
    const successMsg = getSuccessMessage();
    
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-white flex items-center justify-center p-4">
        <div className="w-full max-w-md space-y-6">
          {/* Success Banner */}
          <Card className="text-center">
            <CardContent className="p-8">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check className="h-8 w-8 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                {successMsg.title}
              </h2>
              <p className="text-gray-900 mb-4">
                {successMsg.description}
              </p>
              <div className="bg-gray-50 p-4 rounded-lg mb-6">
                <p className="text-sm text-gray-900">Order Number</p>
                <p className="font-bold text-lg text-servio-purple">
                  {orderNumber}
                </p>
                <p className="text-sm text-gray-900 mt-2">
                  {checkoutData.orderType === 'counter' ? 'Counter' : 'Table'} {checkoutData.tableNumber}
                </p>
                <div className="mt-3 pt-3 border-t border-gray-200">
                  <p className="text-sm text-gray-900">Customer</p>
                  <p className="font-medium text-gray-900">{checkoutData.customerName || 'Customer'}</p>
                  <p className="text-sm text-gray-900 mt-1">Phone</p>
                  <p className="font-medium text-gray-900">{checkoutData.customerPhone || 'Not provided'}</p>
                </div>
                <p className="text-lg font-bold text-green-600 mt-3">
                  Total: £{checkoutData.total.toFixed(2)}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Order Timeline */}
          <OrderTimeline
            orderId={orderNumber}
            currentStatus="PLACED"
            estimatedTime="15-20 minutes"
          />

          {/* Feedback Form */}
          {!feedbackSubmitted && (
            <CustomerFeedbackForm
              venueId={checkoutData.venueId}
              orderId={orderNumber}
              customerName={checkoutData.customerName || 'Customer'}
              customerPhone={checkoutData.customerPhone || ''}
              onFeedbackSubmitted={handleFeedbackSubmitted}
            />
          )}

          {/* Action Buttons */}
          <div className="space-y-3">
            {/* Universal Order Summary Button - Available for all payment methods */}
            <Button
              onClick={() => router.push(`/order-summary/${orderNumber}`)}
              className="w-full bg-servio-purple hover:bg-servio-purple-dark"
            >
              <Receipt className="h-4 w-4 mr-2" />
              {paymentAction === 'demo' || paymentAction === 'stripe' ? 'View Receipt' : 'View Order Summary'}
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
              Order Again
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
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-md mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.back()}
              className="text-gray-900 hover:text-gray-900"
            >
              <ArrowLeft className="h-5 w-5" />
              <span className="sr-only">Back</span>
            </Button>
            <h1 className="font-semibold text-lg text-gray-900">Complete Your Order</h1>
            <div className="w-10"></div>
          </div>
          
          {/* Venue Info */}
          <div className="text-center mt-2">
            <p className="text-sm text-gray-900">{checkoutData.venueName || 'Restaurant'}</p>
            <div className="flex items-center justify-center gap-1 mt-1">
              <Shield className="h-3 w-3 text-green-600" />
              <span className="text-xs text-green-600">🔒 Secure checkout</span>
            </div>
          </div>
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
              <span className="text-gray-900">
                Your {checkoutData.orderType === 'counter' ? 'Counter' : 'Table'}: {checkoutData.tableNumber}
              </span>
              <span className="font-medium">
                {checkoutData.cart.reduce((total, item) => total + item.quantity, 0)} items
              </span>
            </div>
            
            {/* Customer Information */}
            <div className="space-y-2 pt-2 border-t">
              <div className="flex justify-between text-sm">
                <span className="text-gray-900">Customer:</span>
                <span className="font-medium">{checkoutData.customerName || 'Customer'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-900">Phone:</span>
                <span className="font-medium">{checkoutData.customerPhone || 'Not provided'}</span>
              </div>
            </div>
            
            <div className="border-t pt-3">
              {checkoutData.cart.map((item, index) => (
                <div key={index} className="flex justify-between text-sm mb-2">
                  <span className="text-gray-900">
                    {item.quantity}× {item.name}
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
            
            <div className="pt-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.back()}
                className="text-xs text-gray-900 hover:text-gray-700"
              >
                Change order
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        )}

        {/* Payment Options */}
        <div className="space-y-3">
          {/* Pay Now Button - Goes directly to Stripe */}
          <Button
            onClick={() => handlePayment('stripe')}
            disabled={isProcessing}
            className="w-full bg-servio-purple hover:bg-servio-purple-dark disabled:bg-gray-300"
          >
            {isProcessing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Processing...
              </>
            ) : (
              `Pay Now £${checkoutData.total.toFixed(2)}`
            )}
          </Button>

          {/* Pay at Till Button */}
          <Button
            onClick={() => handlePayment('till')}
            disabled={isProcessing}
            variant="outline"
            className="w-full border-2 border-servio-purple text-servio-purple hover:bg-servio-purple hover:text-white"
          >
            <CreditCard className="h-4 w-4 mr-2" />
            Pay at Till £{checkoutData.total.toFixed(2)}
          </Button>

          {/* Pay Later Button */}
          <Button
            onClick={() => handlePayment('later')}
            disabled={isProcessing}
            variant="outline"
            className="w-full border-2 border-gray-400 text-gray-900 hover:bg-gray-100"
          >
            <Clock className="h-4 w-4 mr-2" />
            Pay Later £{checkoutData.total.toFixed(2)}
          </Button>
        </div>


        {/* Payment Note */}
        <p className="text-xs text-gray-900 text-center">
          Secure payment processing powered by Stripe. Pay at Till sends the bill to staff for payment at the counter.
        </p>
      </main>
    </div>
  );
}