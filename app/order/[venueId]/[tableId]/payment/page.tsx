"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, CreditCard, CheckCircle } from "lucide-react";
import Image from "next/image";

interface PendingOrderData {
  venue_id: string;
  table_number: number;
  customer_name: string;
  customer_phone: string;
  items: Array<{
    menu_item_id: string | null;
    quantity: number;
    price: number;
    item_name: string;
    special_instructions: string | null;
  }>;
  total_amount: number;
  notes: string;
}

export default function PaymentPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const params = useParams();
  const venueId = params?.venueId as string;
  const tableId = params?.tableId as string;
  
  const [pendingOrder, setPendingOrder] = useState<PendingOrderData | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<'pending' | 'processing' | 'completed' | 'failed'>('pending');
  const [orderId, setOrderId] = useState<string | null>(null);

  useEffect(() => {
    // Get pending order data from localStorage
    const storedOrderData = localStorage.getItem('pending-order-data');
    if (storedOrderData) {
      try {
        const orderData = JSON.parse(storedOrderData);
        setPendingOrder(orderData);
        // Automatically start payment processing
        handlePayment();
      } catch (error) {
        console.error('Error parsing stored order data:', error);
        router.replace('/order');
      }
    } else {
      router.replace('/order');
    }
  }, [router]);

  const handlePayment = async () => {
    if (!pendingOrder) return;
    
    setPaymentStatus('processing');
    
    try {
      // Simulate payment processing
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Payment successful - now create the order
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(pendingOrder),
      });
      
      const out = await res.json().catch(() => ({} as any));
      
      if (!res.ok || !out?.ok) {
        throw new Error(out?.error || 'Failed to create order after payment');
      }
      
      // Payment and order creation successful
      setOrderId(out?.order?.id);
      setPaymentStatus('completed');
      
      // Clear pending order data
      localStorage.removeItem('pending-order-data');
      
      // Redirect to order summary after a short delay
      setTimeout(() => {
        router.replace(`/order/${venueId}/${tableId}/summary/${out?.order?.id}`);
      }, 2000);
      
    } catch (error) {
      console.error('Payment failed:', error);
      setPaymentStatus('failed');
    }
  };

  if (!pendingOrder) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <Card className="w-full max-w-md text-center">
        <CardContent className="p-8">
          {paymentStatus === 'processing' && (
            <>
              <Loader2 className="h-12 w-12 animate-spin text-purple-600 mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">Processing Payment</h2>
              <p className="text-gray-600">Please wait while we process your order...</p>
            </>
          )}

          {paymentStatus === 'completed' && (
            <>
              <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">Payment Successful!</h2>
              <p className="text-gray-600">Order #{orderId} has been created</p>
              <p className="text-gray-500 text-sm mt-2">Redirecting to order summary...</p>
            </>
          )}

          {paymentStatus === 'failed' && (
            <>
              <div className="h-12 w-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-red-600 text-xl">!</span>
              </div>
              <h2 className="text-xl font-semibold mb-2 text-red-600">Payment Failed</h2>
              <p className="text-gray-600 mb-4">Please try again or contact support</p>
              <Button 
                onClick={handlePayment}
                variant="outline"
                className="w-full"
              >
                Try Again
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
