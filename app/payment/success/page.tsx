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
  const [order, setOrder] = useState<any>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);

  // Generate short order number for display
  const getShortOrderNumber = (orderId: string) => {
    // Use last 6 characters of UUID for shorter display
    return orderId.slice(-6).toUpperCase();
  };

  useEffect(() => {
    const sessionId = searchParams?.get('session_id');
    
    if (!sessionId) {
      setError('Invalid payment session - no session ID provided');
      setIsProcessing(false);
      return;
    }

    // Use our new verify endpoint to get the order
    const verifyOrder = async () => {
      try {
        console.log('[PAYMENT SUCCESS] Verifying order for session:', sessionId);
        const res = await fetch(`/api/orders/verify?sessionId=${sessionId}`);
        
        if (res.ok) {
          const data = await res.json();
          console.log('[PAYMENT SUCCESS] Order verified:', data);
          setOrder(data.order);
          setOrderConfirmed(true);
        } else {
          const errorData = await res.json();
          console.error('[PAYMENT SUCCESS] Verification failed:', errorData);
          setError(errorData.error || 'Failed to verify order');
        }
      } catch (error) {
        console.error('[PAYMENT SUCCESS] Error verifying order:', error);
        setError('Failed to verify order. Please contact support.');
      } finally {
        setIsProcessing(false);
      }
    };

    verifyOrder();
  }, [searchParams]);

  if (isProcessing) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center">
            <Loader2 className="h-12 w-12 animate-spin text-green-600 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Finalising your order...
            </h2>
            <p className="text-gray-600">
              Please wait while we confirm your payment and create your order.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center">
            <div className="h-12 w-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-red-600 text-xl">⚠️</span>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Payment Verification Failed
            </h2>
            <p className="text-gray-600 mb-4">{error}</p>
            <Button 
              onClick={() => router.push('/order')}
              className="w-full"
            >
              Return to Order
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!orderConfirmed || !order) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-yellow-50 to-orange-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center">
            <div className="h-12 w-12 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-yellow-600 text-xl">⏳</span>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Order Not Found
            </h2>
            <p className="text-gray-600 mb-4">
              We couldn't find your order. This might be a temporary issue.
            </p>
            <Button 
              onClick={() => router.push('/order')}
              className="w-full"
            >
              Return to Order
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 p-4">
      <div className="max-w-2xl mx-auto">
        {/* Success Header */}
        <Card className="mb-6 border-green-200 bg-green-50">
          <CardContent className="p-6 text-center">
            <div className="h-16 w-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="h-8 w-8 text-green-600" />
            </div>
            <h1 className="text-2xl font-bold text-green-800 mb-2">
              Payment Successful!
            </h1>
            <p className="text-green-700">
              Your order has been confirmed and is being prepared.
            </p>
          </CardContent>
        </Card>

        {/* Order Details */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5" />
              Order Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">Order Number</p>
                <p className="font-semibold">#{getShortOrderNumber(order.id)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Amount</p>
                <p className="font-semibold">£{order.total_amount?.toFixed(2) || '0.00'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Table</p>
                <p className="font-semibold">{order.table_number || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Status</p>
                <p className="font-semibold text-green-600 capitalize">{order.payment_status}</p>
              </div>
            </div>
            
            {order.customer_name && (
              <div>
                <p className="text-sm text-gray-600">Customer</p>
                <p className="font-semibold">{order.customer_name}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Order Items */}
        {order.items && order.items.length > 0 && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Order Items</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {order.items.map((item: any, index: number) => (
                  <div key={index} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-b-0">
                    <div>
                      <p className="font-medium">{item.item_name || `Item ${index + 1}`}</p>
                      <p className="text-sm text-gray-600">Qty: {item.quantity}</p>
                    </div>
                    <p className="font-semibold">£{(item.price * item.quantity).toFixed(2)}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Feedback Section */}
        {!showFeedback && !feedbackSubmitted && (
          <Card className="mb-6">
            <CardContent className="p-6 text-center">
              <Star className="h-8 w-8 text-yellow-500 mx-auto mb-3" />
              <h3 className="text-lg font-semibold mb-2">How was your experience?</h3>
              <p className="text-gray-600 mb-4">
                We'd love to hear your feedback to help us improve our service.
              </p>
              <Button 
                onClick={() => setShowFeedback(true)}
                variant="outline"
                className="w-full"
              >
                Leave Feedback
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Feedback Form */}
        {showFeedback && !feedbackSubmitted && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Share Your Feedback</CardTitle>
            </CardHeader>
            <CardContent>
              <UnifiedFeedbackForm
                venueId={order.venue_id}
                orderId={order.id}
                onSubmit={() => {
                  setFeedbackSubmitted(true);
                  setShowFeedback(false);
                }}
              />
            </CardContent>
          </Card>
        )}

        {/* Thank You Message */}
        {feedbackSubmitted && (
          <Card className="mb-6 border-green-200 bg-green-50">
            <CardContent className="p-6 text-center">
              <Check className="h-8 w-8 text-green-600 mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-green-800 mb-2">
                Thank you for your feedback!
              </h3>
              <p className="text-green-700">
                Your input helps us provide better service.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Action Buttons */}
        <div className="flex gap-4">
          <Button 
            onClick={() => router.push('/order')}
            variant="outline"
            className="flex-1"
          >
            Place Another Order
          </Button>
          <Button 
            onClick={() => window.close()}
            className="flex-1"
          >
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}