"use client";

import { useSearchParams } from "next/navigation";
import OrderSummary from "@/components/order-summary";
import DemoOrderSummary from "@/components/demo-order-summary";
import { useEffect, useState } from "react";

export default function PaymentSuccessPage() {
  const searchParams = useSearchParams();
  const sessionId = searchParams?.get('session_id');
  const orderId = searchParams?.get('orderId');
  const isDemo = searchParams?.get('demo') === '1';
  const paymentMethod = searchParams?.get('paymentMethod') || 'demo';
  const [verifiedOrderId, setVerifiedOrderId] = useState<string | undefined>(orderId || undefined);
  const [checkoutData, setCheckoutData] = useState<any>(null);

  // Load checkout data for demo mode
  useEffect(() => {
    if (isDemo) {
      const storedData = localStorage.getItem("servio-checkout-data");
      if (storedData) {
        try {
          const data = JSON.parse(storedData);
          setCheckoutData(data);
        } catch (error) {
          console.error('[PAYMENT SUCCESS] Error parsing checkout data:', error);
        }
      }
    }
  }, [isDemo]);

  // If we have a sessionId but no orderId, fetch the order from the verify endpoint
  useEffect(() => {
    if (sessionId && !orderId) {
      console.log('[PAYMENT SUCCESS] Verifying Stripe session:', sessionId);
      
      fetch(`/api/orders/verify?sessionId=${sessionId}`)
        .then(res => res.json())
        .then(data => {
          if (data.order) {
            console.log('[PAYMENT SUCCESS] Order verified:', data.order.id);
            setVerifiedOrderId(data.order.id);
          } else {
            console.error('[PAYMENT SUCCESS] No order in verify response:', data);
          }
        })
        .catch(err => {
          console.error('[PAYMENT SUCCESS] Failed to verify order:', err);
        });
    }
  }, [sessionId, orderId]);

  // For demo mode, use the demo order summary
  if (isDemo && checkoutData) {
    return (
      <DemoOrderSummary 
        checkoutData={checkoutData}
        paymentMethod={paymentMethod}
      />
    );
  }

  // For real orders, use the regular order summary
  return (
    <OrderSummary 
      orderId={verifiedOrderId}
      sessionId={sessionId || undefined}
      isDemo={isDemo}
    />
  );
}