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
import { Textarea } from "@/components/ui/textarea";
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
  AlertCircle,
  Star,
  Send
} from "lucide-react";
import { v4 as uuidv4 } from "uuid";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { RealTimeOrderTimeline } from "@/components/real-time-order-timeline";
// import OrderFeedbackForm from "@/components/OrderFeedbackForm";

// Initialize Stripe
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

// Debug Stripe initialization
if (typeof window !== 'undefined') {
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
  orderType?: string; // Add orderType for source determination
}

type CheckoutPhase = 'review' | 'processing' | 'confirmed' | 'feedback' | 'timeline' | 'complete' | 'error';

// Simple Feedback Form Component
function FeedbackForm({ venueId, orderId, onFeedbackComplete }: { venueId: string; orderId?: string; onFeedbackComplete?: () => void }) {
  const [questions, setQuestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [answers, setAnswers] = useState<{[key: string]: any}>({});
  const [showForm, setShowForm] = useState(true);

  // Generic feedback questions
  const genericQuestions = [
    {
      id: 'generic-food-quality',
      prompt: 'How would you rate the food quality?',
      type: 'stars'
    },
    {
      id: 'generic-service',
      prompt: 'How would you rate the service?',
      type: 'stars'
    },
    {
      id: 'generic-value',
      prompt: 'How would you rate the value for money?',
      type: 'stars'
    },
    {
      id: 'generic-overall',
      prompt: 'How would you rate your overall experience?',
      type: 'stars'
    },
    {
      id: 'generic-comments',
      prompt: 'Any additional comments or suggestions?',
      type: 'paragraph'
    }
  ];

  useEffect(() => {
    fetchQuestions();
  }, [venueId]);

  const fetchQuestions = async () => {
    try {
      const response = await fetch(`/api/feedback/questions/public?venueId=${venueId}`);
      
      if (response.ok) {
        const data = await response.json();
        const activeQuestions = data.questions || [];
        
        if (activeQuestions.length === 0) {
          setQuestions(genericQuestions);
        } else {
          setQuestions(activeQuestions);
        }
      } else {
        setQuestions(genericQuestions);
      }
    } catch (error) {
      console.error('[FEEDBACK] Error fetching questions:', error);
      setQuestions(genericQuestions);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const feedbackAnswers = questions.map(question => {
        const answer = answers[question.id];
        
        switch (question.type) {
          case 'stars':
            return {
              question_id: question.id,
              type: 'stars',
              answer_stars: answer || 0,
              order_id: orderId
            };
          case 'paragraph':
            return {
              question_id: question.id,
              type: 'paragraph',
              answer_text: answer || '',
              order_id: orderId
            };
          default:
            return null;
        }
      }).filter(answer => {
        if (!answer) return false;
        if (answer.type === 'stars') return answer.answer_stars > 0;
        if (answer.type === 'paragraph') return answer.answer_text.trim() !== '';
        return false;
      });

      if (feedbackAnswers.length === 0) {
        alert('Please answer at least one question');
        return;
      }


      const response = await fetch('/api/feedback-responses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          venue_id: venueId,
          order_id: orderId,
          answers: feedbackAnswers
        })
      });


      if (response.ok) {
        alert('Thank you for your feedback!');
        setShowForm(false);
        setAnswers({});
        // Complete feedback immediately - no artificial delay
        onFeedbackComplete?.();
      } else {
        const errorText = await response.text();
        console.error('[FEEDBACK] Error response:', errorText);
        alert(`Failed to submit feedback: ${errorText}`);
      }
    } catch (error) {
      console.error('Error submitting feedback:', error);
      alert('Failed to submit feedback. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-4">
        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-purple-600" />
        <p className="text-sm text-gray-900">Loading feedback form...</p>
      </div>
    );
  }

  if (!showForm) {
    return (
      <div className="text-center py-6">
        <MessageSquare className="w-12 h-12 text-gray-700 mx-auto mb-4" />
        <p className="text-gray-900 mb-4">We'd love to hear about your experience!</p>
        <Button onClick={() => setShowForm(true)}>
          <MessageSquare className="w-4 h-4 mr-2" />
          Leave Feedback
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {questions.map((question) => (
        <div key={question.id} className="space-y-3">
          <label className="block text-sm font-medium text-gray-700">
            {question.prompt}
          </label>
          
          {question.type === 'stars' ? (
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setAnswers(prev => ({ ...prev, [question.id]: star }))}
                  className="transition-colors hover:scale-110"
                >
                  <Star
                    className={`h-6 w-6 ${
                      star <= (answers[question.id] || 0)
                        ? 'text-yellow-400 fill-current'
                        : 'text-gray-600'
                    }`}
                  />
                </button>
              ))}
            </div>
          ) : question.type === 'paragraph' ? (
            <Textarea
              value={answers[question.id] || ''}
              onChange={(e) => setAnswers(prev => ({ ...prev, [question.id]: e.target.value }))}
              placeholder="Share your thoughts..."
              rows={3}
              maxLength={600}
            />
          ) : null}
        </div>
      ))}
      
      <div className="flex gap-3 pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={() => setShowForm(false)}
          disabled={submitting}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Submitting...
            </>
          ) : (
            <>
              <Send className="mr-2 h-4 w-4" />
              Submit Feedback
            </>
          )}
        </Button>
      </div>
    </form>
  );
}

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
    
    if (stripe && elements) {
      setIsLoading(false);
      
      // Debug payment methods availability
    } else {
    }
  }, [stripe, elements, checkoutData, isLoading]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    

    if (!stripe || !elements) {
      console.error('[STRIPE PAYMENT SUBMISSION] Missing Stripe or Elements:', {
        stripe: !!stripe,
        elements: !!elements
      });
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      // Convert total from pounds to pence for Stripe
      const totalInPence = Math.round(checkoutData.total * 100);
      
      // Create payment intent
      const requestBody = {
        cartId: checkoutData.cartId || `cart-${Date.now()}`, // Use cartId from checkoutData or generate one
        venueId: checkoutData.venueId,
        tableNumber: checkoutData.tableNumber,
        items: checkoutData.cart,
        totalAmount: totalInPence,
        customerName: checkoutData.customerName,
        customerPhone: checkoutData.customerPhone,
      };

      // Debug: Log the complete request body to identify missing fields

      // Validate required fields before making API call
      const missingFields = [];
      if (!requestBody.cartId) missingFields.push('cartId');
      if (!requestBody.venueId) missingFields.push('venueId');
      if (requestBody.tableNumber === undefined) missingFields.push('tableNumber');
      if (!requestBody.items || requestBody.items.length === 0) missingFields.push('items');
      if (!requestBody.totalAmount || requestBody.totalAmount <= 0) missingFields.push('totalAmount');
      if (!requestBody.customerName) missingFields.push('customerName');
      if (!requestBody.customerPhone) missingFields.push('customerPhone');

      if (missingFields.length > 0) {
        console.error('[STRIPE PAYMENT INTENT] Missing required fields:', missingFields);
        throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
      }


      const startTime = Date.now();

      const response = await fetch('/api/payments/create-intent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      const endTime = Date.now();

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[STRIPE PAYMENT INTENT] API error response:', errorText);
        
        // Try to parse error as JSON for better error message
        let errorMessage = `HTTP error! status: ${response.status}`;
        try {
          const errorJson = JSON.parse(errorText);
          if (errorJson.error) {
            errorMessage = errorJson.error;
          }
        } catch (e) {
          // If not JSON, use the text as is
          if (errorText) {
            errorMessage = errorText;
          }
        }
        
        throw new Error(errorMessage);
      }

      const responseData = await response.json();
      
      const { clientSecret } = responseData;

      // Confirm payment
      
      const confirmationStartTime = Date.now();
      
      // Submit elements before confirming payment
      const { error: submitError } = await elements.submit();
      if (submitError) {
        console.error("[STRIPE PAYMENT CONFIRMATION] Elements submit error:", submitError);
        throw new Error(submitError.message || "Failed to submit payment form");
      }
      const { error: stripeError } = await stripe.confirmPayment({
        clientSecret,
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/checkout?success=true`,
        },
      });
      const confirmationEndTime = Date.now();
      

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

      // Payment confirmed - webhook will create the order
      // Just show success state and let the redirect handler fetch the order
      console.log('[STRIPE PAYMENT] Payment confirmed, redirecting to success page...');
      // Stripe will redirect automatically with payment_intent in URL
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
      setError(errorMessage);
      onError(errorMessage);
    } finally {
      setIsProcessing(false);
    }
  };

  // Show loading state while Stripe Elements are loading
  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="text-center py-8">
          <p className="text-gray-900">Loading secure payment form...</p>
          <p className="text-sm text-gray-900 mt-2">Please wait while we initialize Stripe</p>
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
                layout: 'tabs',
                paymentMethodOrder: ['card', 'paypal'],
                fields: {
                  billingDetails: 'auto'
                }
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
          // Debug logging removed for performance
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
  // Always use demo mode unless explicitly disabled
  const isDemo = searchParams?.get('demo') !== '0';

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

  // Real-time subscription is now handled by the OrderTimeline component

  // Handle payment success from URL parameters
  useEffect(() => {
    if (!isMounted) return;
    
    const success = searchParams?.get('success');
    const paymentIntent = searchParams?.get('payment_intent');
    const redirectStatus = searchParams?.get('redirect_status');
    
    // Handle both success=true and redirect_status=succeeded
    const isPaymentSuccessful = (success === 'true' && paymentIntent) || redirectStatus === 'succeeded';
    
    if (isPaymentSuccessful && checkoutData) {
      
      // Wait for webhook to create the order, then fetch it
      const waitForOrder = async () => {
        try {
          setPaymentStatus('success');
          console.log('[PAYMENT SUCCESS] Payment successful, waiting for webhook to create order...');
          
          // Poll for the order created by the webhook
          let retries = 0;
          const maxRetries = 10;
          let orderFound = false;
          
          while (retries < maxRetries && !orderFound) {
            await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds between attempts
            
            // Try to find the order by payment intent
            const response = await fetch(`/api/orders/search?venue_id=${checkoutData.venueId}&payment_intent=${paymentIntent}`);
            
            if (response.ok) {
              const data = await response.json();
              if (data.orders && data.orders.length > 0) {
                const orderData = data.orders[0];
                
                // Set the order data and progress to feedback phase
                setOrder({
                  id: orderData.id,
                  orderId: orderData.id,
                  status: orderData.order_status,
                  total: orderData.total_amount / 100,
                  createdAt: orderData.created_at,
                  venueId: orderData.venue_id,
                  tableNumber: orderData.table_number,
                  customerName: orderData.customer_name
                });
                
                setPhase('feedback');
                orderFound = true;
                
                // Clear stored data since order is now created in database
                localStorage.removeItem('pending-order-data');
                localStorage.removeItem('servio-checkout-data');
                
                console.log('[PAYMENT SUCCESS] Order found and loaded:', orderData.id);
                break;
              }
            }
            
            retries++;
            console.log(`[PAYMENT SUCCESS] Waiting for order... Attempt ${retries}/${maxRetries}`);
          }
          
          if (!orderFound) {
            console.error('[PAYMENT SUCCESS] Order not found after polling');
            setError('Payment successful but order not found. Please contact support with payment intent: ' + paymentIntent);
            setPhase('error');
          }
          
        } catch (error) {
          console.error('[PAYMENT SUCCESS] Error fetching order:', error);
          setError('Payment successful but failed to load order. Please contact support.');
          setPhase('error');
        }
      };

      waitForOrder();
      
      // Clear URL parameters to avoid re-triggering
      const url = new URL(window.location.href);
      url.searchParams.delete('success');
      url.searchParams.delete('payment_intent');
      url.searchParams.delete('payment_intent_client_secret');
      url.searchParams.delete('redirect_status');
      window.history.replaceState({}, document.title, url.toString());
    }
  }, [isMounted, searchParams, checkoutData]);

  useEffect(() => {
    if (!isMounted) return;

    
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
    
    if (method === 'stripe') {
      // For now, redirect to simulation even if stripe is selected
      // This ensures all payments are demo payments
      setPaymentMethod('simulation');
    } else {
      setPaymentMethod(method);
    }
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
    
    setOrder(orderData);
    setPhase('feedback');
    setPaymentStatus('success');
    
    // Clear stored data since order is now created in database
    localStorage.removeItem('pending-order-data');
    localStorage.removeItem('servio-checkout-data');
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
    
    setError(error);
    setPhase('error');
    setPaymentStatus('failed');
  };

  const simulatePayment = async () => {
    setPaymentStatus('processing');
    setPhase('processing');
    
    try {
      // Simulate payment processing delay
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Always use demo flow for all orders
      const shouldUseDemoFlow = true; // Always true - all payments are demo
      if (shouldUseDemoFlow) {
        const demoOrderId = `demo-order-${Date.now()}`;
        
        setPaymentStatus('success');
        setOrder({
          id: demoOrderId,
          orderId: demoOrderId,
          status: 'PLACED',
          total: checkoutData?.total || 0,
          createdAt: new Date().toISOString(),
          venueId: 'demo-cafe',
          tableNumber: checkoutData?.tableNumber || 1,
          customerName: checkoutData?.customerName || 'Demo Customer'
        });
        
        // Clear stored data
        localStorage.removeItem('pending-order-data');
        localStorage.removeItem('servio-checkout-data');
        localStorage.removeItem('servio-pending-order');
        
        // Redirect to success page with orderId
        router.push(`/payment/success?orderId=${demoOrderId}&demo=1`);
        return;
      }
      
      // For real venues, create actual order
      const totalInPence = Math.round((checkoutData?.total || 0) * 100);
      
      const orderRequestBody = {
        venue_id: checkoutData?.venueId,
        table_number: checkoutData?.tableNumber,
        customer_name: checkoutData?.customerName,
        customer_phone: checkoutData?.customerPhone,
        items: (checkoutData?.cart || []).map(item => ({
          menu_item_id: item.id,
          quantity: item.quantity,
          price: item.price,
          item_name: item.name,
          specialInstructions: item.specialInstructions || null
        })),
        total_amount: totalInPence,
        order_status: 'PLACED',
        payment_status: 'PAID',
        source: checkoutData?.orderType === 'counter' ? 'counter' : 'qr',
        notes: 'Simulated payment order'
      };
      
      const orderResponse = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(orderRequestBody),
      });

      if (!orderResponse.ok) {
        const orderErrorText = await orderResponse.text();
        console.error('[ORDER CREATION] Order creation failed:', orderErrorText);
        throw new Error(`Failed to create order: ${orderResponse.status}`);
      }

      const orderData = await orderResponse.json();
      
      setPaymentStatus('success');
      setOrder({
        id: orderData.order?.id,
        orderId: orderData.order?.id,
        status: orderData.order?.order_status,
        total: orderData.order?.total_amount ? orderData.order.total_amount / 100 : checkoutData?.total,
        createdAt: orderData.order?.created_at,
        venueId: orderData.order?.venue_id,
        tableNumber: orderData.order?.table_number,
        customerName: orderData.order?.customer_name
      });
      setPhase('feedback');
      
      localStorage.removeItem('pending-order-data');
      localStorage.removeItem('servio-checkout-data');
        
    } catch (error) {
      console.error('[PAYMENT] Error during payment:', error);
      setPaymentStatus('failed');
      setPhase('error');
      setError(error instanceof Error ? error.message : 'Payment failed. Please try again.');
    }
  };

  const getTotalPrice = () => {
    return checkoutData?.cart.reduce((total, item) => total + (item.price * item.quantity), 0) || 0;
  };

  const handleTimelineComplete = () => {
    setPhase('complete');
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
          color: 'text-gray-900',
          bgColor: 'bg-gray-50',
          text: 'Select payment method'
        };
    }
  };

  if (!isMounted || isLoading) {
    return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <p className="text-gray-900">Loading checkout...</p>
        <p className="text-sm text-gray-900 mt-2">Preparing your order details...</p>
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
          <p className="text-gray-900 mb-4">{error}</p>
          <Button onClick={() => {
            if (checkoutData && 'venueId' in checkoutData && 'tableNumber' in checkoutData) {
              const data = checkoutData as CheckoutData;
              router.push(`/order?venue=${data.venueId}&table=${data.tableNumber}`);
            } else {
              router.push('/order');
            }
          }}>
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
            <p className="text-gray-900">Your order has been successfully placed and payment processed.</p>
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
                  <span className="text-gray-900">Order ID:</span>
                  <span className="font-medium">{order?.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-900">Venue:</span>
                  <span className="font-medium">{checkoutData?.venueName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-900">Table:</span>
                  <span className="font-medium">{checkoutData?.tableNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-900">Customer:</span>
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
              onClick={() => router.push(`/order-summary/${order?.id}`)}
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

  if (phase === 'complete') {
    return (
      <div className="min-h-screen bg-gray-50">
        {/* Header with Logo */}
        <div className="bg-white shadow-sm border-b">
          <div className="max-w-4xl mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                {/* Servio Logo */}
                <div className="flex items-center">
                  <Image
                    src="/assets/servio-logo-updated.png"
                    alt="Servio"
                    width={300}
                    height={90}
                    className="h-12 sm:h-14 md:h-16 lg:h-18 xl:h-20 w-auto"
                    priority
                  />
                </div>
              </div>
              <Button
                onClick={() => {
                  if (checkoutData && 'venueId' in checkoutData && 'tableNumber' in checkoutData) {
                    const data = checkoutData as CheckoutData;
                    router.push(`/order?venue=${data.venueId}&table=${data.tableNumber}`);
                  } else {
                    router.push('/order');
                  }
                }}
                variant="ghost"
                className="flex items-center"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Order
              </Button>
            </div>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-4 py-8">
          {/* Payment Success Message */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="w-8 h-8 text-green-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Payment Successful!</h1>
            <p className="text-gray-900">Your order has been confirmed and payment processed.</p>
          </div>

          {/* Order Summary */}
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
                  <span className="text-gray-900">Order ID:</span>
                  <span className="font-medium">{order?.id}</span>
            </div>
                <div className="flex justify-between">
                  <span className="text-gray-900">Venue:</span>
                  <span className="font-medium">{checkoutData?.venueName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-900">Table:</span>
                  <span className="font-medium">{checkoutData?.tableNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-900">Customer:</span>
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

          {/* Feedback Form */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center">
                <MessageSquare className="w-5 h-5 mr-2" />
                Share Your Experience
              </CardTitle>
            </CardHeader>
            <CardContent>
              <FeedbackForm 
                venueId={checkoutData?.venueId || ''} 
                orderId={order?.id || ''} 
                onFeedbackComplete={() => setPhase('timeline')}
              />
            </CardContent>
          </Card>

          {/* Order Timeline */}
          <RealTimeOrderTimeline 
            orderId={order?.id || ''} 
            venueId={checkoutData?.venueId || ''} 
          />
        </div>
      </div>
    );
  }

  if (phase === 'feedback') {
    return (
      <div className="min-h-screen bg-gray-50">
        {/* Header with Logo */}
        <div className="bg-white shadow-sm border-b">
          <div className="max-w-4xl mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                {/* Servio Logo */}
                <div className="flex items-center">
                  <Image
                    src="/assets/servio-logo-updated.png"
                    alt="Servio"
                    width={300}
                    height={90}
                    className="h-12 sm:h-14 md:h-16 lg:h-18 xl:h-20 w-auto"
                    priority
                  />
                </div>
              </div>
              <Button
                onClick={() => {
                  if (checkoutData && 'venueId' in checkoutData && 'tableNumber' in checkoutData) {
                    const data = checkoutData as CheckoutData;
                    router.push(`/order?venue=${data.venueId}&table=${data.tableNumber}`);
                  } else {
                    router.push('/order');
                  }
                }}
                variant="ghost"
                className="flex items-center"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Order
              </Button>
            </div>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-4 py-8">
          {/* Payment Success Message */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="w-8 h-8 text-green-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Payment Successful!</h1>
            <p className="text-gray-900">Your order has been confirmed and payment processed.</p>
          </div>

          {/* Order Summary */}
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
                  <span className="text-gray-900">Order ID:</span>
                  <span className="font-medium">{order?.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-900">Venue:</span>
                  <span className="font-medium">{checkoutData?.venueName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-900">Table:</span>
                  <span className="font-medium">{checkoutData?.tableNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-900">Customer:</span>
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

          {/* Feedback Form */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center">
                <MessageSquare className="w-5 h-5 mr-2" />
                Share Your Experience
              </CardTitle>
            </CardHeader>
            <CardContent>
              <FeedbackForm 
                venueId={checkoutData?.venueId || ''} 
                orderId={order?.id || ''} 
                onFeedbackComplete={() => setPhase('timeline')}
              />
            </CardContent>
          </Card>

          {/* Order Timeline */}
          <RealTimeOrderTimeline 
            orderId={order?.id || ''} 
            venueId={checkoutData?.venueId || ''} 
          />
        </div>
      </div>
    );
  }

  if (phase === 'timeline') {
    return (
      <div className="min-h-screen bg-gray-50">
        {/* Header with Logo */}
        <div className="bg-white shadow-sm border-b">
          <div className="max-w-4xl mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                {/* Servio Logo */}
                <div className="flex items-center">
                  <Image
                    src="/assets/servio-logo-updated.png"
                    alt="Servio"
                    width={300}
                    height={90}
                    className="h-12 sm:h-14 md:h-16 lg:h-18 xl:h-20 w-auto"
                    priority
                  />
                </div>
              </div>
              <Button
                onClick={() => {
                  if (checkoutData && 'venueId' in checkoutData && 'tableNumber' in checkoutData) {
                    const data = checkoutData as CheckoutData;
                    router.push(`/order?venue=${data.venueId}&table=${data.tableNumber}`);
                  } else {
                    router.push('/order');
                  }
                }}
                variant="ghost"
                className="flex items-center"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Order
              </Button>
            </div>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-4 py-8">
          {/* Order Timeline */}
          <RealTimeOrderTimeline 
            orderId={order?.id || ''} 
            venueId={checkoutData?.venueId || ''} 
            className="mb-6"
          />

          {/* Action Buttons */}
          <div className="flex space-x-4">
            <Button
              onClick={() => router.push(`/order-summary/${order?.id}`)}
              className="flex-1"
            >
              <Clock className="w-4 h-4 mr-2" />
              Track Your Order
            </Button>
            <Button
              onClick={handleTimelineComplete}
              variant="outline"
              className="flex-1"
            >
              <Check className="w-4 h-4 mr-2" />
              Complete
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
            <p className="text-gray-900">{error}</p>
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
              onClick={() => {
                if (checkoutData && 'venueId' in checkoutData && 'tableNumber' in checkoutData) {
                  const data = checkoutData as CheckoutData;
                  router.push(`/order?venue=${data.venueId}&table=${data.tableNumber}`);
                } else {
                  router.push('/order');
                }
              }}
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
    <div className="min-h-screen bg-gray-50">
      {/* Demo Mode Banner */}
      {isDemo && (
        <div className="bg-gradient-to-r from-purple-600 to-purple-800 text-white py-3 px-4 shadow-md">
          <div className="max-w-4xl mx-auto flex items-center justify-center space-x-3">
            <div className="h-2 w-2 bg-green-400 rounded-full animate-pulse"></div>
            <span className="text-sm font-medium">💡 Demo Mode Active — Payments are simulated • No real charges</span>
          </div>
        </div>
      )}
      
      {/* Header with Logo */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              {/* Servio Logo */}
              <div className="flex items-center">
                <Image
                  src="/assets/servio-logo-updated.png"
                  alt="Servio"
                  width={300}
                  height={90}
                  className="h-20 sm:h-24 md:h-28 lg:h-32 xl:h-36 w-auto"
                  priority
                />
              </div>
            </div>
          <Button
              onClick={() => {
                if (checkoutData && 'venueId' in checkoutData && 'tableNumber' in checkoutData) {
                  const data = checkoutData as CheckoutData;
                  router.push(`/order?venue=${data.venueId}&table=${data.tableNumber}`);
                } else {
                  router.push('/order');
                }
              }}
            variant="ghost"
              className="flex items-center"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Order
          </Button>
          </div>
        </div>
      </div>
      
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Checkout</h1>
          <p className="text-gray-900 mt-2">Review your order and complete payment</p>
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
                    <span className="text-gray-900">Venue:</span>
                    <span className="font-medium">{checkoutData?.venueName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-900">Table:</span>
                    <span className="font-medium">{checkoutData?.tableNumber}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-900">Customer:</span>
                    <span className="font-medium">{checkoutData?.customerName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-900">Phone:</span>
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
                    <p className="text-sm text-gray-900">Qty: {item.quantity}</p>
                        {item.specialInstructions && (
                          <p className="text-xs text-gray-900">Note: {item.specialInstructions}</p>
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
                      <p className="text-sm text-gray-900">
                        {isDemo || checkoutData?.venueId === 'demo-cafe' ? 'Demo Payment' : 'Secure payment processing'}
                      </p>
                    </div>
                    {isDemo || checkoutData?.venueId === 'demo-cafe' ? (
                      <div className="space-y-4">
                        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 text-center">
                          <p className="text-sm text-purple-900 font-medium">
                            💡 Demo Mode - Payment will be simulated
                          </p>
                        </div>
                        <Button
                          onClick={simulatePayment}
                          disabled={false}
                          className="w-full h-16 bg-purple-600 hover:bg-purple-700 text-white text-lg"
                        >
                          <CreditCard className="h-6 w-6 mr-2" />
                          Complete Demo Order
                        </Button>
                      </div>
                    ) : (
                      <div className="text-center">
                        <Button
                          onClick={() => handlePaymentMethodSelect('stripe')}
                          className="h-20 w-full flex-col gap-2 bg-purple-600 hover:bg-purple-700"
                        >
                          <CreditCard className="h-6 w-6" />
                          <span className="text-sm">Pay with Stripe</span>
                          <span className="text-xs text-purple-100">Secure payment processing</span>
                        </Button>
                      </div>
                    )}
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
                            <div className="w-6 h-6 bg-servio-purple rounded"></div>
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
                          <div className="w-12 h-8 bg-servio-purple rounded flex items-center justify-center text-white text-xs font-bold">
                            Apple
                          </div>
                          <div className="w-12 h-8 bg-blue-600 rounded flex items-center justify-center text-white text-xs font-bold">
                            Google
                          </div>
                        </div>
                        <p className="text-sm text-gray-900">
                          Tap your phone or watch to complete payment
                        </p>
                      </div>
                    )}

                    {/* Pay Button */}
                    {simulationMethod && (
                      <Button 
                        onClick={simulatePayment}
                        className="w-full bg-purple-600 hover:bg-purple-700"
                        disabled={false}
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
                    <p className="text-sm text-gray-900">Processing your payment...</p>
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

                <div className="text-xs text-gray-900 text-center pt-2 border-t">
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
