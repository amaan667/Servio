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
  X
} from "lucide-react";
import { v4 as uuidv4 } from "uuid";

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

type CheckoutPhase = 'review' | 'processing' | 'confirmed' | 'error';

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
      // Create payment intent
      const response = await fetch('/api/payments/create-intent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cartId: checkoutData.cartId,
          venueId: checkoutData.venueId,
          tableNumber: checkoutData.tableNumber,
          items: checkoutData.cart,
          totalAmount: checkoutData.total,
          customerName: checkoutData.customerName,
          customerPhone: checkoutData.customerPhone,
        }),
      });

      const { clientSecret } = await response.json();

      if (!clientSecret) {
        throw new Error('Failed to create payment intent');
      }

      // Confirm payment
      const result = await stripe.confirmPayment({
        elements,
        clientSecret,
        redirect: 'if_required',
      });

      if (result.error) {
        setError(result.error.message || 'Payment failed');
        onError(result.error.message || 'Payment failed');
        return;
      }

      // Payment succeeded, create order
      const orderResponse = await fetch('/api/orders/createFromPaidIntent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          paymentIntentId: result.paymentIntent.id,
          cartId: checkoutData.cartId,
        }),
      });

      const orderResult = await orderResponse.json();

      if (orderResult.ok) {
        onSuccess(orderResult.order);
      } else {
        throw new Error(orderResult.message || 'Failed to create order');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Payment failed';
      setError(errorMessage);
      onError(errorMessage);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <PaymentElement />
      
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-600 text-sm">{error}</p>
        </div>
      )}

      <Button
        type="submit"
        disabled={!stripe || isProcessing}
        className="w-full bg-servio-purple hover:bg-servio-purple/90"
        size="lg"
      >
        {isProcessing ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Processing Payment...
          </>
        ) : (
          <>
            <CreditCard className="w-4 h-4 mr-2" />
            Pay £{(checkoutData.total / 100).toFixed(2)}
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
  const isDemo = searchParams?.get('demo') === '1';

  useEffect(() => {
    // Get checkout data from localStorage or URL params
    const storedData = localStorage.getItem('pending-order-data');
    if (storedData) {
      const data = JSON.parse(storedData);
      setCheckoutData({
        ...data,
        cartId,
        venueName: data.venueName || 'Restaurant',
      });
    } else {
      // Try to get from URL params for demo mode
      const venueId = searchParams?.get('venue') || 'demo-cafe';
      const tableNumber = parseInt(searchParams?.get('table') || '1');
      const demoCart = [
        { id: 'demo-1', name: 'Demo Item 1', price: 1200, quantity: 1 },
        { id: 'demo-2', name: 'Demo Item 2', price: 800, quantity: 2 },
      ];
      
      if (isDemo) {
        setCheckoutData({
          venueId,
          venueName: 'Demo Restaurant',
          tableNumber,
          cart: demoCart,
          total: demoCart.reduce((sum, item) => sum + (item.price * item.quantity), 0),
          customerName: 'Demo Customer',
          customerPhone: '+1234567890',
          cartId,
        });
      } else {
        router.push('/order');
      }
    }
  }, [router, searchParams, cartId, isDemo]);

  const handlePaymentSuccess = (orderData: any) => {
    setOrder(orderData);
    setPhase('confirmed');
    // Clear stored data
    localStorage.removeItem('pending-order-data');
  };

  const handlePaymentError = (errorMessage: string) => {
    setError(errorMessage);
    setPhase('error');
  };

  const handleDemoPayment = async () => {
    setPhase('processing');
    
    // Simulate payment processing
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    try {
      // Create order directly for demo
      const orderResponse = await fetch('/api/orders/createFromPaidIntent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          paymentIntentId: `demo-${cartId}`,
          cartId,
        }),
      });

      const orderResult = await orderResponse.json();

      if (orderResult.ok) {
        handlePaymentSuccess(orderResult.order);
      } else {
        throw new Error(orderResult.message || 'Failed to create demo order');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Demo payment failed';
      handlePaymentError(errorMessage);
    }
  };

  if (!checkoutData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-servio-purple" />
          <p className="text-gray-600">Loading checkout...</p>
        </div>
      </div>
    );
  }

  const getTotalPrice = () => {
    return checkoutData.cart.reduce((total, item) => total + (item.price * item.quantity), 0);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <Button
            variant="ghost"
            onClick={() => router.back()}
            className="mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Menu
          </Button>
          
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                {phase === 'confirmed' ? 'Order Confirmed!' : 'Checkout'}
              </h1>
              <p className="text-gray-600 mt-1">
                {checkoutData.venueName} • Table {checkoutData.tableNumber}
              </p>
            </div>
            
            {phase === 'processing' && (
              <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                Processing...
              </Badge>
            )}
            
            {phase === 'confirmed' && (
              <Badge variant="secondary" className="bg-green-100 text-green-800">
                <Check className="w-3 h-3 mr-1" />
                Confirmed
              </Badge>
            )}
          </div>
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
              <CardContent className="space-y-4">
                {checkoutData.cart.map((item) => (
                  <div key={item.id} className="flex items-center justify-between py-2">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3">
                        {item.image && (
                          <img
                            src={item.image}
                            alt={item.name}
                            className="w-12 h-12 rounded-lg object-cover"
                          />
                        )}
                        <div>
                          <h4 className="font-medium text-gray-900">{item.name}</h4>
                          <p className="text-sm text-gray-500">Qty: {item.quantity}</p>
                          {item.specialInstructions && (
                            <p className="text-xs text-gray-400 mt-1">
                              Note: {item.specialInstructions}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">
                        £{((item.price * item.quantity) / 100).toFixed(2)}
                      </p>
                    </div>
                  </div>
                ))}
                
                <Separator />
                
                <div className="flex justify-between items-center text-lg font-semibold">
                  <span>Total</span>
                  <span>£{(getTotalPrice() / 100).toFixed(2)}</span>
                </div>
              </CardContent>
            </Card>

            {/* Customer Info */}
            <Card>
              <CardHeader>
                <CardTitle>Customer Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="customerName">Name</Label>
                  <Input
                    id="customerName"
                    value={checkoutData.customerName}
                    readOnly
                    className="bg-gray-50"
                  />
                </div>
                <div>
                  <Label htmlFor="customerPhone">Phone</Label>
                  <Input
                    id="customerPhone"
                    value={checkoutData.customerPhone}
                    readOnly
                    className="bg-gray-50"
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Payment Section */}
          <div className="space-y-6">
            {phase === 'review' && (
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
                      <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <p className="text-yellow-800 text-sm">
                          Demo Mode: Payment will be simulated
                        </p>
                      </div>
                      <Button
                        onClick={handleDemoPayment}
                        className="w-full bg-servio-purple hover:bg-servio-purple/90"
                        size="lg"
                      >
                        <Smartphone className="w-4 h-4 mr-2" />
                        Complete Demo Payment
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
            )}

            {phase === 'processing' && (
              <Card>
                <CardContent className="py-12 text-center">
                  <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4 text-servio-purple" />
                  <h3 className="text-lg font-semibold mb-2">Processing Payment</h3>
                  <p className="text-gray-600">
                    Please wait while we process your payment...
                  </p>
                </CardContent>
              </Card>
            )}

            {phase === 'confirmed' && order && (
              <Card>
                <CardContent className="py-12 text-center">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Check className="w-8 h-8 text-green-600" />
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">
                    Order Confirmed!
                  </h3>
                  <p className="text-gray-600 mb-4">
                    Your order has been placed successfully
                  </p>
                  
                  <div className="bg-gray-50 rounded-lg p-4 mb-6">
                    <div className="flex items-center justify-center mb-2">
                      <Receipt className="w-4 h-4 mr-2 text-gray-500" />
                      <span className="text-sm font-medium text-gray-700">Order Details</span>
                    </div>
                    <p className="text-sm text-gray-600">
                      Order ID: {order.id}
                    </p>
                    <p className="text-sm text-gray-600">
                      Total: £{(order.total_amount / 100).toFixed(2)}
                    </p>
                    <p className="text-sm text-gray-600">
                      Status: {order.order_status}
                    </p>
                  </div>

                  <div className="space-y-3">
                    <Button
                      onClick={() => router.push(`/order/${checkoutData.venueId}/${checkoutData.tableNumber}`)}
                      className="w-full"
                      variant="outline"
                    >
                      Order Again
                    </Button>
                    <Button
                      onClick={() => router.push('/')}
                      className="w-full bg-servio-purple hover:bg-servio-purple/90"
                    >
                      Return to Home
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {phase === 'error' && (
              <Card>
                <CardContent className="py-12 text-center">
                  <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <X className="w-8 h-8 text-red-600" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">
                    Payment Failed
                  </h3>
                  <p className="text-gray-600 mb-6">
                    {error || 'Something went wrong. Please try again.'}
                  </p>
                  
                  <div className="space-y-3">
                    <Button
                      onClick={() => setPhase('review')}
                      className="w-full"
                    >
                      Try Again
                    </Button>
                    <Button
                      onClick={() => router.back()}
                      className="w-full"
                      variant="outline"
                    >
                      Back to Menu
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
