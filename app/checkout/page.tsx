"use client";

import React, { useState, useEffect } from "react";
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
  Loader2, 
  ArrowLeft,
  ShoppingCart,
  Receipt,
  X,
  MessageSquare,
  Clock,
  Lock,
  CheckCircle,
  AlertCircle
} from "lucide-react";
import { v4 as uuidv4 } from "uuid";

// Initialize Stripe
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

// Debug Stripe initialization
if (typeof window !== 'undefined') {
  console.log('[STRIPE DEBUG] Publishable key available:', !!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);
  console.log('[STRIPE DEBUG] Publishable key starts with:', process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.substring(0, 7));
}

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
  cartId?: string;
}

type CheckoutPhase = 'review' | 'processing' | 'confirmed' | 'feedback' | 'timeline' | 'error';

// Stripe Payment Form Component
function StripePaymentForm({ 
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
  const [isLoading, setIsLoading] = useState(true);

  // Debug Stripe and Elements loading
  useEffect(() => {
    console.log('[STRIPE ELEMENTS INIT] Stripe Elements initialization check');
    console.log('[STRIPE ELEMENTS INIT] Stripe loaded:', !!stripe);
    console.log('[STRIPE ELEMENTS INIT] Elements loaded:', !!elements);
    console.log('[STRIPE ELEMENTS INIT] Checkout data available:', !!checkoutData);
    console.log('[STRIPE ELEMENTS INIT] Current loading state:', isLoading);
    
    if (stripe && elements) {
      console.log('[STRIPE ELEMENTS INIT] Both Stripe and Elements are ready');
      console.log('[STRIPE ELEMENTS INIT] Setting loading to false');
      setIsLoading(false);
      console.log('[STRIPE ELEMENTS INIT] Stripe Elements initialization complete');
    } else {
      console.log('[STRIPE ELEMENTS INIT] Still waiting for Stripe Elements to load');
      if (!stripe) console.log('[STRIPE ELEMENTS INIT] Stripe not yet loaded');
      if (!elements) console.log('[STRIPE ELEMENTS INIT] Elements not yet loaded');
    }
  }, [stripe, elements, checkoutData, isLoading]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    
    console.log('[STRIPE PAYMENT SUBMISSION] Payment form submitted');
    console.log('[STRIPE PAYMENT SUBMISSION] Timestamp:', new Date().toISOString());
    console.log('[STRIPE PAYMENT SUBMISSION] Stripe available:', !!stripe);
    console.log('[STRIPE PAYMENT SUBMISSION] Elements available:', !!elements);
    console.log('[STRIPE PAYMENT SUBMISSION] Checkout data:', {
      venueId: checkoutData.venueId,
      venueName: checkoutData.venueName,
      tableNumber: checkoutData.tableNumber,
      customerName: checkoutData.customerName,
      customerPhone: checkoutData.customerPhone,
      cartId: checkoutData.cartId,
      total: checkoutData.total,
      itemsCount: checkoutData.cart.length,
      items: checkoutData.cart.map(item => ({
        id: item.id,
        name: item.name,
        price: item.price,
        quantity: item.quantity
      }))
    });

    if (!stripe || !elements) {
      console.error('[STRIPE PAYMENT SUBMISSION] Missing Stripe or Elements:', {
        stripe: !!stripe,
        elements: !!elements
      });
      return;
    }

    console.log('[STRIPE PAYMENT SUBMISSION] Starting payment processing...');
    setIsProcessing(true);
    setError(null);

    try {
      // Convert total from pounds to pence for Stripe
      const totalInPence = Math.round(checkoutData.total * 100);
      console.log('[STRIPE PAYMENT INTENT] Creating payment intent');
      console.log('[STRIPE PAYMENT INTENT] Original amount (GBP):', checkoutData.total);
      console.log('[STRIPE PAYMENT INTENT] Converted amount (pence):', totalInPence);
      console.log('[STRIPE PAYMENT INTENT] Conversion rate: 1 GBP = 100 pence');
      
      // Create payment intent
      const requestBody = {
        cartId: checkoutData.cartId,
        venueId: checkoutData.venueId,
        tableNumber: checkoutData.tableNumber,
        items: checkoutData.cart,
        totalAmount: totalInPence,
        customerName: checkoutData.customerName,
        customerPhone: checkoutData.customerPhone,
      };

      console.log('[STRIPE PAYMENT INTENT] Request body prepared:', {
        cartId: requestBody.cartId,
        venueId: requestBody.venueId,
        tableNumber: requestBody.tableNumber,
        totalAmount: requestBody.totalAmount,
        customerName: requestBody.customerName,
        customerPhone: requestBody.customerPhone,
        itemsCount: requestBody.items.length
      });

      console.log('[STRIPE PAYMENT INTENT] Making API call to /api/payments/create-intent');
      const startTime = Date.now();
      
      const response = await fetch('/api/payments/create-intent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      const endTime = Date.now();
      console.log('[STRIPE PAYMENT INTENT] API call completed in:', endTime - startTime, 'ms');
      console.log('[STRIPE PAYMENT INTENT] Response status:', response.status);
      console.log('[STRIPE PAYMENT INTENT] Response ok:', response.ok);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[STRIPE PAYMENT INTENT] API error response:', errorText);
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const responseData = await response.json();
      console.log('[STRIPE PAYMENT INTENT] Response data received:', {
        hasClientSecret: !!responseData.clientSecret,
        clientSecretLength: responseData.clientSecret?.length,
        otherFields: Object.keys(responseData).filter(key => key !== 'clientSecret')
      });
      
      const { clientSecret } = responseData;
      console.log('[STRIPE PAYMENT INTENT] Client secret extracted successfully');

      // Confirm payment
      console.log('[STRIPE PAYMENT CONFIRMATION] Starting payment confirmation');
      console.log('[STRIPE PAYMENT CONFIRMATION] Return URL:', `${window.location.origin}/checkout?success=true`);
      console.log('[STRIPE PAYMENT CONFIRMATION] Client secret available:', !!clientSecret);
      
      const confirmationStartTime = Date.now();
      const { error: stripeError } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/checkout?success=true`,
        },
      });
      const confirmationEndTime = Date.now();
      
      console.log('[STRIPE PAYMENT CONFIRMATION] Confirmation completed in:', confirmationEndTime - confirmationStartTime, 'ms');

      if (stripeError) {
        console.error('[STRIPE PAYMENT CONFIRMATION] Payment error occurred:', {
          type: stripeError.type,
          code: stripeError.code,
          message: stripeError.message,
          decline_code: stripeError.decline_code,
          payment_intent: stripeError.payment_intent
        });
        throw new Error(stripeError.message || 'Payment failed');
      }

      console.log('[STRIPE PAYMENT CONFIRMATION] Payment confirmed successfully');
      console.log('[STRIPE PAYMENT CONFIRMATION] No Stripe errors detected');
      
      // Create order from paid intent
      console.log('[STRIPE ORDER CREATION] Starting order creation from paid intent');
      console.log('[STRIPE ORDER CREATION] Payment confirmed, now creating order record');
      
      const orderRequestBody = {
        cartId: checkoutData.cartId,
        venueId: checkoutData.venueId,
        tableNumber: checkoutData.tableNumber,
        items: checkoutData.cart,
        totalAmount: totalInPence,
        customerName: checkoutData.customerName,
        customerPhone: checkoutData.customerPhone,
      };
      
      console.log('[STRIPE ORDER CREATION] Order request body:', {
        cartId: orderRequestBody.cartId,
        venueId: orderRequestBody.venueId,
        tableNumber: orderRequestBody.tableNumber,
        totalAmount: orderRequestBody.totalAmount,
        customerName: orderRequestBody.customerName,
        customerPhone: orderRequestBody.customerPhone,
        itemsCount: orderRequestBody.items.length
      });
      
      console.log('[STRIPE ORDER CREATION] Making API call to /api/orders/createFromPaidIntent');
      const orderStartTime = Date.now();
      
      const orderResponse = await fetch('/api/orders/createFromPaidIntent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(orderRequestBody),
      });

      const orderEndTime = Date.now();
      console.log('[STRIPE ORDER CREATION] Order API call completed in:', orderEndTime - orderStartTime, 'ms');
      console.log('[STRIPE ORDER CREATION] Order response status:', orderResponse.status);
      console.log('[STRIPE ORDER CREATION] Order response ok:', orderResponse.ok);

      if (!orderResponse.ok) {
        const orderErrorText = await orderResponse.text();
        console.error('[STRIPE ORDER CREATION] Order creation failed:', {
          status: orderResponse.status,
          error: orderErrorText
        });
        throw new Error(`Failed to create order: ${orderResponse.status}`);
      }

      const orderData = await orderResponse.json();
      console.log('[STRIPE ORDER CREATION] Order created successfully:', {
        orderId: orderData.id,
        status: orderData.status,
        total: orderData.total,
        createdAt: orderData.createdAt,
        hasAllRequiredFields: !!(orderData.id && orderData.status && orderData.total)
      });
      
      console.log('[STRIPE PAYMENT FLOW] Complete payment flow successful');
      console.log('[STRIPE PAYMENT FLOW] Calling onSuccess callback with order data');
      onSuccess(orderData);
    } catch (err) {
      console.error('[STRIPE PAYMENT ERROR] Payment flow failed:', {
        error: err,
        errorMessage: err instanceof Error ? err.message : 'Payment failed',
        errorType: err instanceof Error ? err.constructor.name : typeof err,
        timestamp: new Date().toISOString(),
        checkoutData: {
          venueId: checkoutData.venueId,
          total: checkoutData.total,
          cartId: checkoutData.cartId
        }
      });
      
      const errorMessage = err instanceof Error ? err.message : 'Payment failed';
      console.log('[STRIPE PAYMENT ERROR] Setting error state and calling onError callback');
      setError(errorMessage);
      onError(errorMessage);
    } finally {
      console.log('[STRIPE PAYMENT FLOW] Payment processing completed, setting isProcessing to false');
      setIsProcessing(false);
    }
  };

  // Show loading state while Stripe Elements are loading
  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="text-center py-8">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-purple-600" />
          <p className="text-gray-600">Loading secure payment form...</p>
          <p className="text-sm text-gray-500 mt-2">Please wait while we initialize Stripe</p>
        </div>
      </div>
    );
  }

  // Show error if Stripe failed to load
  if (!stripe || !elements) {
    return (
      <div className="space-y-4">
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center">
            <AlertCircle className="w-5 h-5 text-red-600 mr-2" />
            <div>
              <h3 className="text-sm font-medium text-red-800">Payment System Error</h3>
              <p className="text-sm text-red-700 mt-1">
                Unable to load secure payment form. Please try again or use demo mode.
              </p>
            </div>
          </div>
        </div>
        <Button
          onClick={() => onError('Stripe failed to load')}
          variant="outline"
          className="w-full"
        >
          Try Demo Mode Instead
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        <div>
          <Label htmlFor="card-element">Payment Information</Label>
          <div className="mt-2 p-4 border rounded-lg">
            <PaymentElement 
              options={{
                layout: 'tabs'
              }}
            />
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
        className="w-full bg-purple-600 hover:bg-purple-700"
        onClick={() => {
          console.log('[STRIPE PAYMENT BUTTON] Real payment button clicked');
          console.log('[STRIPE PAYMENT BUTTON] Button state:', {
            stripeAvailable: !!stripe,
            isProcessing: isProcessing,
            elementsAvailable: !!elements,
            totalAmount: checkoutData.total,
            buttonDisabled: !stripe || isProcessing
          });
          console.log('[STRIPE PAYMENT BUTTON] About to submit payment form');
        }}
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

export default function CheckoutPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [checkoutData, setCheckoutData] = useState<CheckoutData | null>(null);
  const [phase, setPhase] = useState<CheckoutPhase>('review');
  const [order, setOrder] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [cartId] = useState(() => uuidv4());
  const [isLoading, setIsLoading] = useState(true);
  const [isMounted, setIsMounted] = useState(false);
  const isDemo = searchParams?.get('demo') === '1';

  // Payment method selection
  const [paymentMethod, setPaymentMethod] = useState<'stripe' | 'simulation' | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<'pending' | 'processing' | 'success' | 'failed'>('pending');
  
  // Simulation states (for demo mode)
  const [simulationMethod, setSimulationMethod] = useState<'card' | 'digital-wallet' | null>(null);
  const [cardDetails, setCardDetails] = useState({
    number: '',
    expiry: '',
    cvv: '',
    name: ''
  });
  const [showCardForm, setShowCardForm] = useState(false);

  // Handle client-side mounting
  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!isMounted) return;

    console.log('[CHECKOUT] Loading checkout data...');
    
    // Get checkout data from localStorage
    const pendingData = localStorage.getItem('pending-order-data');
    const checkoutData = localStorage.getItem('servio-checkout-data');
    const storedData = pendingData || checkoutData;
    
    if (storedData) {
      try {
        const data = JSON.parse(storedData);
        const checkoutData = {
          ...data,
          cartId,
          venueName: data.venueName || 'Restaurant',
        };
        setCheckoutData(checkoutData);
        setIsLoading(false);
      } catch (error) {
        console.error('[CHECKOUT] Error parsing stored data:', error);
        setError('Invalid order data');
        setIsLoading(false);
      }
    } else if (isDemo) {
      // Demo mode - create demo data
      const demoCart = [
        { id: 'demo-1', name: 'Demo Item 1', price: 12.00, quantity: 1 },
        { id: 'demo-2', name: 'Demo Item 2', price: 8.00, quantity: 2 },
      ];
      const demoCheckoutData = {
        venueId: 'demo-cafe',
        venueName: 'Servio Café',
        tableNumber: 1,
        cart: demoCart,
        total: demoCart.reduce((sum, item) => sum + (item.price * item.quantity), 0),
        customerName: 'Demo Customer',
        customerPhone: '+1234567890',
        cartId,
      };
      setCheckoutData(demoCheckoutData);
      setIsLoading(false);
    } else {
      setError('No order data found');
      setIsLoading(false);
    }
  }, [isMounted, cartId, isDemo]);

  const handlePaymentMethodSelect = (method: 'stripe' | 'simulation') => {
    console.log('[PAYMENT METHOD SELECTION] User selected payment method:', method);
    console.log('[PAYMENT METHOD SELECTION] Checkout data available:', !!checkoutData);
    console.log('[PAYMENT METHOD SELECTION] Total amount:', checkoutData?.total);
    console.log('[PAYMENT METHOD SELECTION] Cart items count:', checkoutData?.cart?.length);
    console.log('[PAYMENT METHOD SELECTION] Customer info:', {
      name: checkoutData?.customerName,
      phone: checkoutData?.customerPhone,
      venue: checkoutData?.venueName,
      table: checkoutData?.tableNumber
    });
    
    if (method === 'stripe') {
      console.log('[STRIPE PAYMENT SELECTED] Real payment method chosen');
      console.log('[STRIPE PAYMENT SELECTED] Stripe publishable key available:', !!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);
      console.log('[STRIPE PAYMENT SELECTED] Stripe publishable key prefix:', process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.substring(0, 7));
    } else {
      console.log('[SIMULATION PAYMENT SELECTED] Demo mode chosen');
    }
    
    setPaymentMethod(method);
  };

  const handleSimulationMethodSelect = (method: 'card' | 'digital-wallet') => {
    setSimulationMethod(method);
    if (method === 'card') {
      setShowCardForm(true);
    } else {
      setShowCardForm(false);
    }
  };

  const handleStripePaymentSuccess = (orderData: any) => {
    console.log('[STRIPE PAYMENT SUCCESS] Payment completed successfully');
    console.log('[STRIPE PAYMENT SUCCESS] Order data received:', {
      orderId: orderData.id,
      status: orderData.status,
      total: orderData.total,
      createdAt: orderData.createdAt,
      venueId: orderData.venueId,
      tableNumber: orderData.tableNumber,
      customerName: orderData.customerName
    });
    console.log('[STRIPE PAYMENT SUCCESS] Setting order state and transitioning to confirmed phase');
    
    setOrder(orderData);
    setPhase('confirmed');
    setPaymentStatus('success');
    
    console.log('[STRIPE PAYMENT SUCCESS] Clearing stored checkout data from localStorage');
    // Clear stored data
    localStorage.removeItem('pending-order-data');
    localStorage.removeItem('servio-checkout-data');
    console.log('[STRIPE PAYMENT SUCCESS] Checkout data cleared, payment flow complete');
  };

  const handleStripePaymentError = (error: string) => {
    console.error('[STRIPE PAYMENT ERROR] Payment failed with error:', error);
    console.error('[STRIPE PAYMENT ERROR] Error details:', {
      errorMessage: error,
      timestamp: new Date().toISOString(),
      checkoutData: {
        venueId: checkoutData?.venueId,
        total: checkoutData?.total,
        cartId: checkoutData?.cartId,
        customerName: checkoutData?.customerName
      }
    });
    console.log('[STRIPE PAYMENT ERROR] Setting error state and transitioning to error phase');
    
    setError(error);
    setPhase('error');
    setPaymentStatus('failed');
  };

  const simulatePayment = async () => {
    setPaymentStatus('processing');
    setPhase('processing');
    
    // Simulate payment processing delay
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Simulate 95% success rate
    const isSuccess = Math.random() > 0.05;
    
    if (isSuccess) {
      setPaymentStatus('success');
      
      // Create order data
      const orderData = {
        id: `order-${Date.now()}`,
        venueId: checkoutData?.venueId,
        tableNumber: checkoutData?.tableNumber,
        customerName: checkoutData?.customerName,
        customerPhone: checkoutData?.customerPhone,
        items: checkoutData?.cart || [],
        total: checkoutData?.total || 0,
        status: 'confirmed',
        createdAt: new Date().toISOString(),
      };
      
      setOrder(orderData);
      setPhase('confirmed');
      
      // Clear stored data
      localStorage.removeItem('pending-order-data');
      localStorage.removeItem('servio-checkout-data');
    } else {
      setPaymentStatus('failed');
      setError('Payment failed. Please try again.');
      setPhase('error');
    }
  };

  const getTotalPrice = () => {
    return checkoutData?.cart.reduce((total, item) => total + (item.price * item.quantity), 0) || 0;
  };

  const getStatusDisplay = () => {
    switch (paymentStatus) {
      case 'processing':
        return {
          icon: Clock,
          color: 'text-blue-600',
          bgColor: 'bg-blue-50',
          text: 'Processing payment...'
        };
      case 'success':
        return {
          icon: CheckCircle,
          color: 'text-green-600',
          bgColor: 'bg-green-50',
          text: 'Payment successful!'
        };
      case 'failed':
        return {
          icon: AlertCircle,
          color: 'text-red-600',
          bgColor: 'bg-red-50',
          text: 'Payment failed. Please try again.'
        };
      default:
        return {
          icon: Clock,
          color: 'text-gray-600',
          bgColor: 'bg-gray-50',
          text: 'Select payment method'
        };
    }
  };

  if (!isMounted || isLoading) {
    return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-purple-600" />
        <p className="text-gray-600">Loading checkout...</p>
        <p className="text-sm text-gray-500 mt-2">Preparing your order details...</p>
      </div>
    </div>
    );
  }

  if (error && !checkoutData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <X className="w-8 h-8 text-red-600 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Error</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <Button onClick={() => router.push('/order')}>
            Back to Order
          </Button>
        </div>
      </div>
    );
  }

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
              onClick={() => setPhase('feedback')}
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

          <Card>
            <CardContent className="p-6">
              <div className="text-center py-8">
                <MessageSquare className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">Feedback form will be available soon!</p>
                <Button
                  onClick={() => router.push('/')}
                  className="mt-4"
                >
                  Return to Home
                </Button>
              </div>
            </CardContent>
          </Card>
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
              onClick={() => {
                setPhase('review');
                setPaymentStatus('pending');
                setError(null);
              }}
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
                  <div className="flex justify-between">
                    <span className="text-gray-600">Phone:</span>
                    <span className="font-medium">{checkoutData?.customerPhone}</span>
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
                  {checkoutData?.cart.map((item) => (
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
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Payment
                  <Badge variant="secondary" className="ml-auto">
                    £{getTotalPrice().toFixed(2)}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Payment Status */}
                <div className={`p-3 rounded-lg ${getStatusDisplay().bgColor}`}>
                  <div className="flex items-center gap-2">
                    {React.createElement(getStatusDisplay().icon, { className: `h-4 w-4 ${getStatusDisplay().color}` })}
                    <span className={`text-sm ${getStatusDisplay().color}`}>
                      {getStatusDisplay().text}
                    </span>
                  </div>
                </div>

                {/* Payment Method Selection */}
                {paymentStatus === 'pending' && !paymentMethod && (
                  <div className="space-y-3">
                    <div className="text-center mb-4">
                      <p className="text-sm text-gray-600">Choose your payment method</p>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <Button
                        variant="outline"
                        onClick={() => handlePaymentMethodSelect('stripe')}
                        className="h-20 flex-col gap-2"
                      >
                        <CreditCard className="h-6 w-6" />
                        <span className="text-sm">Real Payment</span>
                        <span className="text-xs text-gray-500">Stripe</span>
                      </Button>
                      
                      <Button
                        variant="outline"
                        onClick={() => handlePaymentMethodSelect('simulation')}
                        className="h-20 flex-col gap-2"
                      >
                        <div className="flex gap-1">
                          <div className="w-6 h-6 bg-black rounded"></div>
                          <div className="w-6 h-6 bg-blue-600 rounded"></div>
                        </div>
                        <span className="text-sm">Demo Mode</span>
                        <span className="text-xs text-gray-500">Simulation</span>
                      </Button>
                    </div>
                  </div>
                )}

                {/* Stripe Payment Form */}
                {paymentMethod === 'stripe' && paymentStatus === 'pending' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold">Secure Payment</h3>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setPaymentMethod(null)}
                      >
                        Change Method
                      </Button>
                    </div>
                    <Elements 
                      stripe={stripePromise} 
                      options={{ 
                        mode: 'payment',
                        amount: Math.round(checkoutData!.total * 100), // Convert to pence
                        currency: 'gbp'
                      }}
                    >
                      <StripePaymentForm
                        checkoutData={checkoutData!}
                        onSuccess={handleStripePaymentSuccess}
                        onError={handleStripePaymentError}
                      />
                    </Elements>
                  </div>
                )}

                {/* Simulation Payment Methods */}
                {paymentMethod === 'simulation' && paymentStatus === 'pending' && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold">Demo Payment</h3>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setPaymentMethod(null)}
                      >
                        Change Method
                      </Button>
                    </div>
                    
                    {!simulationMethod && (
                      <div className="grid grid-cols-2 gap-3">
                        <Button
                          variant="outline"
                          onClick={() => handleSimulationMethodSelect('card')}
                          className="h-20 flex-col gap-2"
                        >
                          <CreditCard className="h-6 w-6" />
                          <span className="text-sm">Credit Card</span>
                        </Button>
                        
                        <Button
                          variant="outline"
                          onClick={() => handleSimulationMethodSelect('digital-wallet')}
                          className="h-20 flex-col gap-2"
                        >
                          <div className="flex gap-1">
                            <div className="w-6 h-6 bg-black rounded"></div>
                            <div className="w-6 h-6 bg-blue-600 rounded"></div>
                          </div>
                          <span className="text-sm">Digital Wallet</span>
                        </Button>
                      </div>
                    )}

                    {/* Card Form */}
                    {showCardForm && (
                      <div className="space-y-3 p-4 border rounded-lg bg-gray-50">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label htmlFor="card-number">Card Number</Label>
                            <Input
                              id="card-number"
                              placeholder="1234 5678 9012 3456"
                              value={cardDetails.number}
                              onChange={(e) => setCardDetails({...cardDetails, number: e.target.value})}
                              maxLength={19}
                            />
                          </div>
                          <div>
                            <Label htmlFor="expiry">Expiry</Label>
                            <Input
                              id="expiry"
                              placeholder="MM/YY"
                              value={cardDetails.expiry}
                              onChange={(e) => setCardDetails({...cardDetails, expiry: e.target.value})}
                              maxLength={5}
                            />
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label htmlFor="cvv">CVV</Label>
                            <Input
                              id="cvv"
                              placeholder="123"
                              value={cardDetails.cvv}
                              onChange={(e) => setCardDetails({...cardDetails, cvv: e.target.value})}
                              maxLength={4}
                            />
                          </div>
                          <div>
                            <Label htmlFor="name">Name on Card</Label>
                            <Input
                              id="name"
                              placeholder="John Doe"
                              value={cardDetails.name}
                              onChange={(e) => setCardDetails({...cardDetails, name: e.target.value})}
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Digital Wallet Simulation */}
                    {simulationMethod === 'digital-wallet' && !showCardForm && (
                      <div className="p-4 border rounded-lg bg-gray-50 text-center">
                        <div className="flex justify-center gap-4 mb-4">
                          <div className="w-12 h-8 bg-black rounded flex items-center justify-center text-white text-xs font-bold">
                            Apple
                          </div>
                          <div className="w-12 h-8 bg-blue-600 rounded flex items-center justify-center text-white text-xs font-bold">
                            Google
                          </div>
                        </div>
                        <p className="text-sm text-gray-600">
                          Tap your phone or watch to complete payment
                        </p>
                      </div>
                    )}

                    {/* Pay Button */}
                    {simulationMethod && (
                      <Button 
                        onClick={simulatePayment}
                        className="w-full bg-purple-600 hover:bg-purple-700"
                        disabled={paymentStatus !== 'pending'}
                      >
                        <Lock className="h-4 w-4 mr-2" />
                        Pay £{getTotalPrice().toFixed(2)}
                      </Button>
                    )}
                  </div>
                )}

                {/* Processing State */}
                {paymentStatus === 'processing' && (
                  <div className="text-center py-4">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-2"></div>
                    <p className="text-sm text-gray-600">Processing your payment...</p>
                  </div>
                )}

                {/* Failed State */}
                {paymentStatus === 'failed' && (
                  <div className="space-y-3">
                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                      <p className="text-sm text-red-700">
                        Payment failed. Please try again.
                      </p>
                    </div>
                    <Button 
                      onClick={() => setPaymentStatus('pending')}
                      variant="outline"
                      className="w-full"
                    >
                      Try Again
                    </Button>
                  </div>
                )}

                <div className="text-xs text-gray-500 text-center pt-2 border-t">
                  {paymentMethod === 'simulation' ? (
                    <>
                      <p>This is a payment simulation for demo purposes</p>
                      <p>No real charges will be made</p>
                    </>
                  ) : (
                    <>
                      <p>Powered by Stripe - Secure payment processing</p>
                      <p>Your payment information is encrypted and secure</p>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
