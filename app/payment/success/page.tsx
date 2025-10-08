"use client";

import { useSearchParams } from "next/navigation";
import OrderSummary from "@/components/order-summary";
import { useEffect, useState } from "react";

export default function PaymentSuccessPage() {
  const searchParams = useSearchParams();
  const sessionId = searchParams?.get('session_id');
  const orderId = searchParams?.get('orderId');
  const isDemo = searchParams?.get('demo') === '1';
  const paymentMethod = searchParams?.get('paymentMethod') || 'demo';
  const [verifiedOrderId, setVerifiedOrderId] = useState<string | undefined>(orderId || undefined);
  const [demoOrderData, setDemoOrderData] = useState<any>(null);

  // Load demo order data from sessionStorage
  useEffect(() => {
    if (isDemo && orderId) {
      const storedData = sessionStorage.getItem("demo-order-data");
      console.log('[PAYMENT SUCCESS] Loading demo order data:', storedData);
      console.log('[PAYMENT SUCCESS] OrderId:', orderId, 'isDemo:', isDemo);
      if (storedData) {
        try {
          const data = JSON.parse(storedData);
          console.log('[PAYMENT SUCCESS] Parsed demo order:', data);
          setDemoOrderData(data);
          // Clean up after loading
          sessionStorage.removeItem("demo-order-data");
        } catch (error) {
          console.error('[PAYMENT SUCCESS] Error parsing demo order data:', error);
        }
      } else {
        console.error('[PAYMENT SUCCESS] No demo order data found in sessionStorage');
      }
    }
  }, [isDemo, orderId]);

  // If we have a sessionId but no orderId, fetch the order from the verify endpoint
  useEffect(() => {
    if (sessionId && !orderId && !isDemo) {
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
  }, [sessionId, orderId, isDemo]);

  // Use the same OrderSummary component for both demo and real orders
  return (
    <OrderSummary 
      orderId={verifiedOrderId}
      sessionId={sessionId || undefined}
      orderData={demoOrderData}
      isDemo={isDemo}
    />
  );
}