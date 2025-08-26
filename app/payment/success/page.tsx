"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function PaymentSuccessPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isProcessing, setIsProcessing] = useState(true);
  const [orderConfirmed, setOrderConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const sessionId = searchParams?.get('sessionId');
    const returnUrl = searchParams?.get('returnUrl');

    if (!sessionId) {
      setError('Invalid payment session');
      setIsProcessing(false);
      return;
    }

    // Simulate order confirmation (since Stripe is removed)
    const createOrderAfterPayment = async () => {
      try {
        // For now, just simulate success since Stripe is removed
        setOrderConfirmed(true);
      } catch (err) {
        console.error('Error confirming order:', err);
        setError('Failed to confirm order. Please contact support.');
      } finally {
        setIsProcessing(false);
      }
    };

    createOrderAfterPayment();
  }, [searchParams]);

  const handleReturn = () => {
    const returnUrl = searchParams?.get('returnUrl');
    if (returnUrl) {
      window.location.href = returnUrl;
    } else {
      router.push('/');
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-white flex items-center justify-center p-4">
      <Card className="w-full max-w-md text-center">
        <CardContent className="p-8">
          <div className="h-16 w-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check className="h-8 w-8 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Payment Successful!</h2>
          <p className="text-gray-600 mb-6">
            Your order has been confirmed and is being prepared.
          </p>
          
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-green-800">
              You will receive a confirmation shortly. Thank you for your order!
            </p>
          </div>

          <Button onClick={handleReturn} className="w-full">
            Return to Menu
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
