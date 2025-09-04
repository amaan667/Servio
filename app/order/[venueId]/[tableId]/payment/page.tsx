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
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center space-x-4">
            {/* Servio Logo */}
            <div className="flex items-center">
              <Image
                src="/assets/servio-logo-updated.png"
                alt="Servio"
                width={200}
                height={60}
                className="h-12 w-auto"
                priority
              />
            </div>
            
            {/* Business Name and Table */}
            <div className="ml-6">
              <h1 className="text-2xl font-bold text-gray-900">Payment</h1>
              <p className="text-gray-600">Table {tableId}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <CreditCard className="mr-2 h-5 w-5" />
              Complete Your Payment
            </CardTitle>
            <CardDescription>
              Your order total: £{pendingOrder.total_amount.toFixed(2)}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Order Summary */}
            <div className="border rounded-lg p-4">
              <h3 className="font-semibold mb-3">Order Summary</h3>
              <div className="space-y-2">
                {pendingOrder.items.map((item, index) => (
                  <div key={index} className="flex justify-between text-sm">
                    <span>{item.quantity}x {item.item_name}</span>
                    <span>£{(item.quantity * item.price).toFixed(2)}</span>
                  </div>
                ))}
                <div className="border-t pt-2 mt-3">
                  <div className="flex justify-between font-semibold">
                    <span>Total</span>
                    <span>£{pendingOrder.total_amount.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Payment Status */}
            {paymentStatus === 'pending' && (
              <div className="text-center">
                <p className="text-gray-600 mb-4">
                  Click the button below to complete your payment
                </p>
                <Button 
                  onClick={handlePayment}
                  className="w-full"
                  size="lg"
                >
                  <CreditCard className="mr-2 h-4 w-4" />
                  Pay £{pendingOrder.total_amount.toFixed(2)}
                </Button>
              </div>
            )}

            {paymentStatus === 'processing' && (
              <div className="text-center">
                <Loader2 className="h-8 w-8 animate-spin text-purple-600 mx-auto mb-4" />
                <p className="text-gray-600">Processing payment...</p>
              </div>
            )}

            {paymentStatus === 'completed' && (
              <div className="text-center">
                <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-4" />
                <p className="text-green-600 font-semibold mb-2">Payment Successful!</p>
                <p className="text-gray-600">Order #{orderId} has been created</p>
                <p className="text-gray-500 text-sm mt-2">Redirecting to order summary...</p>
              </div>
            )}

            {paymentStatus === 'failed' && (
              <div className="text-center">
                <p className="text-red-600 font-semibold mb-4">Payment Failed</p>
                <p className="text-gray-600 mb-4">Please try again or contact support</p>
                <Button 
                  onClick={handlePayment}
                  variant="outline"
                  className="w-full"
                >
                  Try Again
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
