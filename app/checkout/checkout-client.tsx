"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { 
  Check, 
  CreditCard, 
  Smartphone, 
  Loader2, 
  ArrowLeft,
  ShoppingCart,
  Receipt,
  X,
  MessageSquare,
  Clock
} from "lucide-react";
import { v4 as uuidv4 } from "uuid";
import { CustomerFeedbackForm } from "@/components/customer-feedback-form";

// Initialize Stripe
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  specialInstructions?: string;
  image?: string;
}

interface CheckoutData {
  venueId: string;
  venueName: string;
  tableNumber: number;
  cart: CartItem[];
  total: number;
  customerName: string;
  customerPhone: string;
}

type CheckoutPhase = 'review' | 'processing' | 'confirmed' | 'feedback' | 'timeline' | 'error';

function CheckoutForm({ 
  checkoutData, 
  onSuccess, 
  onError 
}: { 
  checkoutData: CheckoutData;
  onSuccess: (order: any) => void;
  onError: (error: string) => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      // Convert total from pounds to pence for Stripe
      const totalInPence = Math.round(checkoutData.total * 100);
      console.log('[CHECKOUT DEBUG] ===== AMOUNT CONVERSION DEBUG =====');
      console.log('[CHECKOUT DEBUG] VERSION: 2024-12-19-amount-conversion-fix');
      console.log('[CHECKOUT DEBUG] Original total from checkoutData:', checkoutData.total);
      console.log('[CHECKOUT DEBUG] Original total type:', typeof checkoutData.total);
      console.log('[CHECKOUT DEBUG] Calculated total in pence:', totalInPence);
      console.log('[CHECKOUT DEBUG] Conversion calculation:', `${checkoutData.total} * 100 = ${totalInPence}`);
      console.log('[CHECKOUT DEBUG] Is totalInPence a number?', typeof totalInPence === 'number');
      console.log('[CHECKOUT DEBUG] Is totalInPence valid?', !isNaN(totalInPence) && isFinite(totalInPence));
      
      // Create payment intent
      const requestBody = {
        cartId: checkoutData.cartId,
        venueId: checkoutData.venueId,
        tableNumber: checkoutData.tableNumber,
        items: checkoutData.cart,
        totalAmount: totalInPence, // Convert pounds to pence
        customerName: checkoutData.customerName,
        customerPhone: checkoutData.customerPhone,
      };

      console.log('[CHECKOUT DEBUG] Creating payment intent with body:', requestBody);

      const response = await fetch('/api/payments/create-intent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const { clientSecret } = await response.json();
      console.log('[CHECKOUT DEBUG] Payment intent created, client secret received');

      // Confirm payment
      const { error: stripeError } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/checkout?success=true`,
        },
      });

      if (stripeError) {
        console.error('[CHECKOUT DEBUG] Stripe payment error:', stripeError);
        throw new Error(stripeError.message || 'Payment failed');
      }

      console.log('[CHECKOUT DEBUG] Payment confirmed successfully');
      
      // Create order from paid intent
      const orderResponse = await fetch('/api/orders/createFromPaidIntent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cartId: checkoutData.cartId,
          venueId: checkoutData.venueId,
          tableNumber: checkoutData.tableNumber,
          items: checkoutData.cart,
          totalAmount: totalInPence,
          customerName: checkoutData.customerName,
          customerPhone: checkoutData.customerPhone,
        }),
      });

      if (!orderResponse.ok) {
        throw new Error(`Failed to create order: ${orderResponse.status}`);
      }

      const orderData = await orderResponse.json();
      console.log('[CHECKOUT DEBUG] Order created successfully:', orderData);
      
      onSuccess(orderData);
    } catch (err) {
      console.error('[CHECKOUT DEBUG] Payment error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Payment failed';
      setError(errorMessage);
      onError(errorMessage);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        <div>
          <Label htmlFor="card-element">Payment Information</Label>
          <div className="mt-2 p-4 border rounded-lg">
            <PaymentElement />
          </div>
        </div>
        
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}
      </div>

      <Button
        type="submit"
        disabled={!stripe || isProcessing}
        className="w-full"
      >
        {isProcessing ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Processing Payment...
          </>
        ) : (
          <>
            <CreditCard className="mr-2 h-4 w-4" />
            Pay £{checkoutData.total.toFixed(2)}
          </>
        )}
      </Button>
    </form>
  );
}

export default function CheckoutClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [checkoutData, setCheckoutData] = useState<CheckoutData | null>(null);
  const [phase, setPhase] = useState<CheckoutPhase>('review');
  const [order, setOrder] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [cartId] = useState(() => uuidv4());
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasCheckedData, setHasCheckedData] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const isDemo = searchParams?.get('demo') === '1';

  // Handle client-side mounting to prevent SSR flash
  useEffect(() => {
    console.log('[CHECKOUT DEBUG] ===== MOUNTING USEEFFECT =====');
    console.log('[CHECKOUT DEBUG] Setting isMounted to true');
    setIsMounted(true);
    console.log('[CHECKOUT DEBUG] Component is now mounted on client-side');
  }, []);

  useEffect(() => {
    console.log('[CHECKOUT DEBUG] ===== USEEFFECT STARTED =====');
    console.log('[CHECKOUT DEBUG] Current state - isClient:', isClient, 'isInitialized:', isInitialized, 'isLoading:', isLoading, 'hasCheckedData:', hasCheckedData);
    
    // Ensure we're on the client side
    console.log('[CHECKOUT DEBUG] Setting isClient to true');
    setIsClient(true);
    
    console.log('[CHECKOUT DEBUG] ===== CHECKOUT PAGE LOADING =====');
    console.log('[CHECKOUT DEBUG] VERSION: 2024-12-19-amount-conversion-fix');
    console.log('[CHECKOUT DEBUG] URL:', window.location.href);
    console.log('[CHECKOUT DEBUG] Search params:', window.location.search);
    console.log('[CHECKOUT DEBUG] Is demo mode:', isDemo);
    console.log('[CHECKOUT DEBUG] Cart ID:', cartId);
    console.log('[CHECKOUT DEBUG] Router object:', router);
    console.log('[CHECKOUT DEBUG] Search params object:', searchParams);
    
    // Mark as initialized to prevent content flash
    console.log('[CHECKOUT DEBUG] Setting isInitialized to true');
    setIsInitialized(true);
    
    // Get checkout data from localStorage or URL params
    console.log('[CHECKOUT DEBUG] ===== LOCALSTORAGE DEBUG =====');
    console.log('[CHECKOUT DEBUG] Checking localStorage keys...');
    const pendingData = localStorage.getItem('pending-order-data');
    const checkoutData = localStorage.getItem('servio-checkout-data');
    console.log('[CHECKOUT DEBUG] pending-order-data exists:', !!pendingData);
    console.log('[CHECKOUT DEBUG] servio-checkout-data exists:', !!checkoutData);
    console.log('[CHECKOUT DEBUG] pending-order-data length:', pendingData?.length || 0);
    console.log('[CHECKOUT DEBUG] servio-checkout-data length:', checkoutData?.length || 0);
    
    const storedData = pendingData || checkoutData;
    console.log('[CHECKOUT DEBUG] Using stored data from:', pendingData ? 'pending-order-data' : 'servio-checkout-data');
    console.log('[CHECKOUT DEBUG] Raw stored data:', storedData);
    console.log('[CHECKOUT DEBUG] Stored data length:', storedData?.length || 0);
    
    if (storedData) {
      try {
        const data = JSON.parse(storedData);
        console.log('[CHECKOUT DEBUG] Parsed data:', data);
        console.log('[CHECKOUT DEBUG] Data keys:', Object.keys(data));
        console.log('[CHECKOUT DEBUG] Customer name from data:', data.customerName);
        console.log('[CHECKOUT DEBUG] Customer phone from data:', data.customerPhone);
        console.log('[CHECKOUT DEBUG] Cart from data:', data.cart);
        console.log('[CHECKOUT DEBUG] Total from data:', data.total);
        
        const checkoutData = {
          ...data,
          cartId,
          venueName: data.venueName || 'Restaurant',
        };
        console.log('[CHECKOUT DEBUG] Final checkout data:', checkoutData);
        console.log('[CHECKOUT DEBUG] Setting checkout data state...');
        console.log('[CHECKOUT DEBUG] About to call setCheckoutData, setIsLoading(false), setHasCheckedData(true)');
        setCheckoutData(checkoutData);
        console.log('[CHECKOUT DEBUG] setCheckoutData called');
        setIsLoading(false);
        console.log('[CHECKOUT DEBUG] setIsLoading(false) called');
        setHasCheckedData(true);
        console.log('[CHECKOUT DEBUG] setHasCheckedData(true) called');
        console.log('[CHECKOUT DEBUG] Checkout data state set successfully');
      } catch (error) {
        console.error('[CHECKOUT DEBUG] Error parsing stored data:', error);
        console.error('[CHECKOUT DEBUG] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
        console.log('[CHECKOUT DEBUG] Redirecting to order page due to parse error');
        setHasCheckedData(true);
        router.push('/order');
      }
    } else {
      console.log('[CHECKOUT DEBUG] No stored data found in localStorage');
      console.log('[CHECKOUT DEBUG] Checking for demo mode...');
      
      // Try to get from URL params for demo mode
      const venueId = searchParams?.get('venue') || 'demo-cafe';
      const tableNumber = parseInt(searchParams?.get('table') || '1');
      const demoCart = [
        { id: 'demo-1', name: 'Demo Item 1', price: 12.00, quantity: 1 },
        { id: 'demo-2', name: 'Demo Item 2', price: 8.00, quantity: 2 },
      ];
      
      console.log('[CHECKOUT DEBUG] Demo mode check - isDemo:', isDemo);
      console.log('[CHECKOUT DEBUG] Demo mode check - venueId:', venueId);
      console.log('[CHECKOUT DEBUG] Demo mode check - tableNumber:', tableNumber);
      
      if (isDemo) {
        console.log('[CHECKOUT DEBUG] Setting up demo data');
        const demoCheckoutData = {
          venueId,
          venueName: 'Demo Restaurant',
          tableNumber,
          cart: demoCart,
          total: demoCart.reduce((sum, item) => sum + (item.price * item.quantity), 0),
          customerName: 'Demo Customer',
          customerPhone: '+1234567890',
          cartId,
        };
        console.log('[CHECKOUT DEBUG] Demo checkout data:', demoCheckoutData);
        console.log('[CHECKOUT DEBUG] About to set demo data - setCheckoutData, setIsLoading(false), setHasCheckedData(true)');
        setCheckoutData(demoCheckoutData);
        console.log('[CHECKOUT DEBUG] Demo setCheckoutData called');
        setIsLoading(false);
        console.log('[CHECKOUT DEBUG] Demo setIsLoading(false) called');
        setHasCheckedData(true);
        console.log('[CHECKOUT DEBUG] Demo setHasCheckedData(true) called');
        console.log('[CHECKOUT DEBUG] Demo checkout data set successfully');
      } else {
        console.log('[CHECKOUT DEBUG] No demo mode, no stored data - waiting briefly then redirecting to order page');
        // Add a small delay to allow localStorage to be available
        setTimeout(() => {
          console.log('[CHECKOUT DEBUG] ===== RETRY LOCALSTORAGE DEBUG =====');
          const retryPendingData = localStorage.getItem('pending-order-data');
          const retryCheckoutData = localStorage.getItem('servio-checkout-data');
          console.log('[CHECKOUT DEBUG] Retry - pending-order-data exists:', !!retryPendingData);
          console.log('[CHECKOUT DEBUG] Retry - servio-checkout-data exists:', !!retryCheckoutData);
          console.log('[CHECKOUT DEBUG] Retry - pending-order-data length:', retryPendingData?.length || 0);
          console.log('[CHECKOUT DEBUG] Retry - servio-checkout-data length:', retryCheckoutData?.length || 0);
          
          const retryData = retryPendingData || retryCheckoutData;
          if (retryData) {
            console.log('[CHECKOUT DEBUG] Found data on retry, processing...');
            console.log('[CHECKOUT DEBUG] Retry data source:', retryPendingData ? 'pending-order-data' : 'servio-checkout-data');
            try {
              const data = JSON.parse(retryData);
              console.log('[CHECKOUT DEBUG] Retry parsed data:', data);
              const checkoutData = {
                ...data,
                cartId,
                venueName: data.venueName || 'Restaurant',
              };
              console.log('[CHECKOUT DEBUG] Setting checkout data from retry...');
              console.log('[CHECKOUT DEBUG] About to set retry data - setCheckoutData, setIsLoading(false), setHasCheckedData(true)');
              setCheckoutData(checkoutData);
              console.log('[CHECKOUT DEBUG] Retry setCheckoutData called');
              setIsLoading(false);
              console.log('[CHECKOUT DEBUG] Retry setIsLoading(false) called');
              setHasCheckedData(true);
              console.log('[CHECKOUT DEBUG] Retry setHasCheckedData(true) called');
              console.log('[CHECKOUT DEBUG] Checkout data set from retry successfully');
            } catch (error) {
              console.error('[CHECKOUT DEBUG] Error parsing retry data:', error);
              setHasCheckedData(true);
              router.push('/order');
            }
          } else {
            console.log('[CHECKOUT DEBUG] Still no data after retry - redirecting to order page');
            setHasCheckedData(true);
            router.push('/order');
          }
        }, 100);
      }
    }
  }, [router, searchParams, cartId, isDemo]);

  // Track state changes for debugging
  useEffect(() => {
    console.log('[CHECKOUT DEBUG] ===== STATE CHANGE DETECTED =====');
    console.log('[CHECKOUT DEBUG] isMounted changed to:', isMounted);
    console.log('[CHECKOUT DEBUG] isClient changed to:', isClient);
    console.log('[CHECKOUT DEBUG] isInitialized changed to:', isInitialized);
    console.log('[CHECKOUT DEBUG] isLoading changed to:', isLoading);
    console.log('[CHECKOUT DEBUG] hasCheckedData changed to:', hasCheckedData);
    console.log('[CHECKOUT DEBUG] checkoutData changed to:', !!checkoutData);
    console.log('[CHECKOUT DEBUG] ===== END STATE CHANGE =====');
  }, [isMounted, isClient, isInitialized, isLoading, hasCheckedData, checkoutData]);

  const handlePaymentSuccess = (orderData: any) => {
    console.log('[CHECKOUT DEBUG] Payment success handler called:', orderData);
    setOrder(orderData);
    setPhase('confirmed');
    // Clear stored data
    localStorage.removeItem('pending-order-data');
    localStorage.removeItem('servio-checkout-data');
  };

  const handleFeedbackSubmitted = () => {
    setFeedbackSubmitted(true);
    setPhase('timeline');
  };

  const handleShowFeedback = () => {
    setShowFeedback(true);
    setPhase('feedback');
  };

  const handlePaymentError = (error: string) => {
    console.error('[CHECKOUT DEBUG] Payment error:', error);
    setError(error);
    setPhase('error');
  };

  const handleDemoPayment = async () => {
    try {
      console.log('[CHECKOUT DEBUG] Processing demo payment...');
      setPhase('processing');
      
      // Simulate payment processing
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Create demo order
      const demoOrder = {
        id: `demo-order-${Date.now()}`,
        venueId: checkoutData?.venueId,
        tableNumber: checkoutData?.tableNumber,
        customerName: checkoutData?.customerName,
        customerPhone: checkoutData?.customerPhone,
        items: checkoutData?.cart || [],
        total: checkoutData?.total || 0,
        status: 'confirmed',
        createdAt: new Date().toISOString(),
      };
      
      console.log('[CHECKOUT DEBUG] Demo order created:', demoOrder);
      handlePaymentSuccess(demoOrder);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Demo payment failed';
      handlePaymentError(errorMessage);
    }
  };

  // Log render condition every time
  console.log('[CHECKOUT DEBUG] ===== RENDER CONDITION CHECK =====');
  console.log('[CHECKOUT DEBUG] isMounted:', isMounted);
  console.log('[CHECKOUT DEBUG] isClient:', isClient);
  console.log('[CHECKOUT DEBUG] isInitialized:', isInitialized);
  console.log('[CHECKOUT DEBUG] isLoading:', isLoading);
  console.log('[CHECKOUT DEBUG] hasCheckedData:', hasCheckedData);
  console.log('[CHECKOUT DEBUG] checkoutData exists:', !!checkoutData);
  console.log('[CHECKOUT DEBUG] Should show loading?', !isMounted || !isClient || !isInitialized || isLoading || !hasCheckedData || !checkoutData);
  
  if (!isMounted || !isClient || !isInitialized || isLoading || !hasCheckedData || !checkoutData) {
    console.log('[CHECKOUT DEBUG] RENDERING LOADING SCREEN');
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-servio-purple" />
          <p className="text-gray-600">Loading checkout...</p>
          <p className="text-sm text-gray-500 mt-2">Preparing your order details...</p>
          <p className="text-xs text-gray-400 mt-1">
            {!isMounted ? 'Mounting...' : !isClient ? 'Starting...' : !isInitialized ? 'Initializing...' : !hasCheckedData ? 'Checking for order data...' : 'Loading order details...'}
          </p>
        </div>
      </div>
    );
  }
  
  console.log('[CHECKOUT DEBUG] RENDERING MAIN CHECKOUT CONTENT');

  const getTotalPrice = () => {
    return checkoutData.cart.reduce((total, item) => total + (item.price * item.quantity), 0);
  };

  if (phase === 'confirmed') {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-2xl mx-auto px-4">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="w-8 h-8 text-green-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Order Confirmed!</h1>
            <p className="text-gray-600">Your order has been successfully placed and payment processed.</p>
          </div>

          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Receipt className="w-5 h-5 mr-2" />
                Order Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between">
                  <span className="text-gray-600">Order ID:</span>
                  <span className="font-medium">{order?.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Venue:</span>
                  <span className="font-medium">{checkoutData?.venueName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Table:</span>
                  <span className="font-medium">{checkoutData?.tableNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Customer:</span>
                  <span className="font-medium">{checkoutData?.customerName}</span>
                </div>
                <Separator />
                <div className="flex justify-between text-lg font-semibold">
                  <span>Total:</span>
                  <span>£{order?.total?.toFixed(2) || checkoutData?.total?.toFixed(2)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex space-x-4">
            <Button
              onClick={handleShowFeedback}
              variant="outline"
              className="flex-1"
            >
              <MessageSquare className="w-4 h-4 mr-2" />
              Share Your Experience
            </Button>
            <Button
              onClick={() => router.push(`/order-tracking/${order?.id}`)}
              className="flex-1"
            >
              <Clock className="w-4 h-4 mr-2" />
              Track Your Order
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'feedback') {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-2xl mx-auto px-4">
          <div className="mb-6">
            <Button
              onClick={() => setPhase('confirmed')}
              variant="ghost"
              className="mb-4"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Order
            </Button>
            <h1 className="text-2xl font-bold text-gray-900">Share Your Experience</h1>
            <p className="text-gray-600 mt-2">Help us improve by sharing your feedback</p>
          </div>

          <CustomerFeedbackForm
            orderId={order?.id}
            venueId={checkoutData?.venueId}
            onFeedbackSubmitted={handleFeedbackSubmitted}
          />
        </div>
      </div>
    );
  }

  if (phase === 'timeline') {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-2xl mx-auto px-4">
          <div className="mb-6">
            <Button
              onClick={() => setPhase('confirmed')}
              variant="ghost"
              className="mb-4"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Order
            </Button>
            <h1 className="text-2xl font-bold text-gray-900">Order Timeline</h1>
            <p className="text-gray-600 mt-2">Track your order progress</p>
          </div>

          <div className="text-center py-8">
            <p className="text-gray-600">Order tracking will be available soon!</p>
            <Button
              onClick={() => router.push('/')}
              className="mt-4"
            >
              Return to Home
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'error') {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-2xl mx-auto px-4">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <X className="w-8 h-8 text-red-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Payment Failed</h1>
            <p className="text-gray-600">{error}</p>
          </div>

          <div className="flex space-x-4">
            <Button
              onClick={() => setPhase('review')}
              variant="outline"
              className="flex-1"
            >
              Try Again
            </Button>
            <Button
              onClick={() => router.push('/order')}
              className="flex-1"
            >
              Back to Order
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="mb-6">
          <Button
            onClick={() => router.push('/order')}
            variant="ghost"
            className="mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Order
          </Button>
          <h1 className="text-3xl font-bold text-gray-900">Checkout</h1>
          <p className="text-gray-600 mt-2">Review your order and complete payment</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Order Summary */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <ShoppingCart className="w-5 h-5 mr-2" />
                  Order Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Venue:</span>
                    <span className="font-medium">{checkoutData.venueName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Table:</span>
                    <span className="font-medium">{checkoutData.tableNumber}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Customer:</span>
                    <span className="font-medium">{checkoutData.customerName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Phone:</span>
                    <span className="font-medium">{checkoutData.customerPhone}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Items</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {checkoutData.cart.map((item) => (
                    <div key={item.id} className="flex justify-between items-center">
                      <div>
                        <p className="font-medium">{item.name}</p>
                        <p className="text-sm text-gray-600">Qty: {item.quantity}</p>
                        {item.specialInstructions && (
                          <p className="text-xs text-gray-500">Note: {item.specialInstructions}</p>
                        )}
                      </div>
                      <span className="font-medium">£{(item.price * item.quantity).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
                <Separator className="my-4" />
                <div className="flex justify-between text-lg font-semibold">
                  <span>Total:</span>
                  <span>£{getTotalPrice().toFixed(2)}</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Payment Form */}
          <div>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <CreditCard className="w-5 h-5 mr-2" />
                  Payment
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isDemo ? (
                  <div className="space-y-4">
                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-sm text-blue-800">
                        <strong>Demo Mode:</strong> This is a demonstration. No real payment will be processed.
                      </p>
                    </div>
                    <Button
                      onClick={handleDemoPayment}
                      className="w-full"
                      disabled={phase === 'processing'}
                    >
                      {phase === 'processing' ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Processing Demo Payment...
                        </>
                      ) : (
                        <>
                          <CreditCard className="mr-2 h-4 w-4" />
                          Complete Demo Payment (£{checkoutData.total.toFixed(2)})
                        </>
                      )}
                    </Button>
                  </div>
                ) : (
                  <Elements stripe={stripePromise}>
                    <CheckoutForm
                      checkoutData={checkoutData}
                      onSuccess={handlePaymentSuccess}
                      onError={handlePaymentError}
                    />
                  </Elements>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
