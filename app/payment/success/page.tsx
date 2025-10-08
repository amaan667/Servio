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
    console.log('[PAYMENT SUCCESS DEBUG] ===== useEffect STARTED =====');
    console.log('[PAYMENT SUCCESS DEBUG] isDemo:', isDemo);
    console.log('[PAYMENT SUCCESS DEBUG] orderId:', orderId);
    console.log('[PAYMENT SUCCESS DEBUG] Current URL:', window.location.href);
    console.log('[PAYMENT SUCCESS DEBUG] Search params:', Object.fromEntries(new URLSearchParams(window.location.search)));
    
    if (isDemo && orderId) {
      console.log('[PAYMENT SUCCESS DEBUG] ===== DEMO ORDER LOADING STARTED =====');
      
      // Check all sessionStorage immediately
      console.log('[PAYMENT SUCCESS DEBUG] All sessionStorage keys on page load:', Object.keys(sessionStorage));
      console.log('[PAYMENT SUCCESS DEBUG] All sessionStorage items:');
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        const value = sessionStorage.getItem(key || '');
        console.log(`[PAYMENT SUCCESS DEBUG] ${key}:`, value);
      }
      
      // Try multiple times to get the data (in case of timing issues)
      let attempts = 0;
      const maxAttempts = 10; // Increased attempts
      
      const tryLoadData = () => {
        console.log(`[PAYMENT SUCCESS DEBUG] ===== ATTEMPT ${attempts + 1} =====`);
        const storedData = sessionStorage.getItem("demo-order-data");
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
            sessionStorage.removeItem("demo-order-data");
            console.log('[PAYMENT SUCCESS DEBUG] Cleaned up sessionStorage');
          } catch (error) {
            console.error('[PAYMENT SUCCESS DEBUG] ===== PARSING ERROR =====');
            console.error('[PAYMENT SUCCESS DEBUG] Error parsing demo order data:', error);
            console.error('[PAYMENT SUCCESS DEBUG] Raw data that failed to parse:', storedData);
          }
        } else if (attempts < maxAttempts) {
          // Try again after a short delay
          attempts++;
          console.log(`[PAYMENT SUCCESS DEBUG] No data found, retrying in 200ms (attempt ${attempts}/${maxAttempts})`);
          setTimeout(tryLoadData, 200);
        } else {
          console.error('[PAYMENT SUCCESS DEBUG] ===== FINAL ERROR =====');
          console.error('[PAYMENT SUCCESS DEBUG] No demo order data found in sessionStorage after', maxAttempts, 'attempts');
          console.error('[PAYMENT SUCCESS DEBUG] Final sessionStorage state:');
          console.error('[PAYMENT SUCCESS DEBUG] Keys:', Object.keys(sessionStorage));
          for (let i = 0; i < sessionStorage.length; i++) {
            const key = sessionStorage.key(i);
            const value = sessionStorage.getItem(key || '');
            console.error(`[PAYMENT SUCCESS DEBUG] ${key}:`, value);
          }
        }
      };
      
      tryLoadData();
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