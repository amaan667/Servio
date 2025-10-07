"use client";

import { useSearchParams } from "next/navigation";
import OrderSummary from "@/components/order-summary";
import { useEffect, useState } from "react";

export default function PaymentSuccessPage() {
  const searchParams = useSearchParams();
  const sessionId = searchParams?.get('session_id');
  const orderId = searchParams?.get('orderId');
  const isDemo = searchParams?.get('demo') === '1';
  const [verifiedOrderId, setVerifiedOrderId] = useState<string | undefined>(orderId || undefined);

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

  return (
    <OrderSummary 
      orderId={verifiedOrderId}
      sessionId={sessionId || undefined}
      isDemo={isDemo}
    />
  );
}