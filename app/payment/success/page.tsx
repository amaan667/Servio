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

  // Load demo order data from localStorage
  useEffect(() => {
    console.log('[PAYMENT SUCCESS DEBUG] ===== useEffect STARTED =====');
    console.log('[PAYMENT SUCCESS DEBUG] isDemo:', isDemo);
    console.log('[PAYMENT SUCCESS DEBUG] orderId:', orderId);
    console.log('[PAYMENT SUCCESS DEBUG] Current URL:', window.location.href);
    console.log('[PAYMENT SUCCESS DEBUG] Search params:', Object.fromEntries(new URLSearchParams(window.location.search)));
    
    if (isDemo && orderId) {
      console.log('[PAYMENT SUCCESS DEBUG] ===== DEMO ORDER LOADING STARTED =====');
      
      // Check all localStorage immediately
      console.log('[PAYMENT SUCCESS DEBUG] All localStorage keys on page load:', Object.keys(localStorage));
      console.log('[PAYMENT SUCCESS DEBUG] All localStorage items:');
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        const value = localStorage.getItem(key || '');
        console.log(`[PAYMENT SUCCESS DEBUG] ${key}:`, value?.substring(0, 100) + '...'); // Only show first 100 chars to avoid spamming logs
      }
      
      // Try to get the data immediately (no retry needed for localStorage)
      console.log('[PAYMENT SUCCESS DEBUG] ===== ATTEMPTING TO LOAD DATA =====');
      const storedData = localStorage.getItem("demo-order-data");
      console.log('[PAYMENT SUCCESS DEBUG] Raw stored data:', storedData);
      console.log('[PAYMENT SUCCESS DEBUG] Data exists:', !!storedData);
      console.log('[PAYMENT SUCCESS DEBUG] Data length:', storedData?.length || 0);
      
      if (storedData) {
        try {
          console.log('[PAYMENT SUCCESS DEBUG] ===== PARSING DATA =====');
          const data = JSON.parse(storedData);
          console.log('[PAYMENT SUCCESS DEBUG] Parsed demo order:', data);
          console.log('[PAYMENT SUCCESS DEBUG] Order ID from data:', data.id);
          console.log('[PAYMENT SUCCESS DEBUG] Expected order ID:', orderId);
          
          setDemoOrderData(data);
          console.log('[PAYMENT SUCCESS DEBUG] ===== DATA SET SUCCESSFULLY =====');
          
          // Clean up after loading
          localStorage.removeItem("demo-order-data");
          console.log('[PAYMENT SUCCESS DEBUG] Cleaned up localStorage');
        } catch (error) {
          console.error('[PAYMENT SUCCESS DEBUG] ===== PARSING ERROR =====');
          console.error('[PAYMENT SUCCESS DEBUG] Error parsing demo order data:', error);
          console.error('[PAYMENT SUCCESS DEBUG] Raw data that failed to parse:', storedData);
        }
      } else {
        console.error('[PAYMENT SUCCESS DEBUG] ===== ERROR =====');
        console.error('[PAYMENT SUCCESS DEBUG] No demo order data found in localStorage');
        console.error('[PAYMENT SUCCESS DEBUG] localStorage state:');
        console.error('[PAYMENT SUCCESS DEBUG] Keys:', Object.keys(localStorage));
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          const value = localStorage.getItem(key || '');
          console.error(`[PAYMENT SUCCESS DEBUG] ${key}:`, value?.substring(0, 100) + '...');
        }
      }
    } else {
      console.log('[PAYMENT SUCCESS DEBUG] Not a demo order or no orderId provided');
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