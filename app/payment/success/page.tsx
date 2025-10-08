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
  
  // URL parameter fallbacks
  const customerNameParam = searchParams?.get('customerName');
  const totalParam = searchParams?.get('total');
  const venueNameParam = searchParams?.get('venueName');

  // Load demo order data from localStorage
  useEffect(() => {
    console.log('[PAYMENT SUCCESS DEBUG] ===== useEffect STARTED =====');
    console.log('[PAYMENT SUCCESS DEBUG] Timestamp:', new Date().toISOString());
    console.log('[PAYMENT SUCCESS DEBUG] Page just loaded');
    console.log('[PAYMENT SUCCESS DEBUG] Current URL:', window.location.href);
    console.log('[PAYMENT SUCCESS DEBUG] Full search string:', window.location.search);
    
    console.log('[PAYMENT SUCCESS DEBUG] ===== PARAMETERS =====');
    console.log('[PAYMENT SUCCESS DEBUG] isDemo:', isDemo);
    console.log('[PAYMENT SUCCESS DEBUG] orderId:', orderId);
    console.log('[PAYMENT SUCCESS DEBUG] sessionId:', sessionId);
    console.log('[PAYMENT SUCCESS DEBUG] paymentMethod:', paymentMethod);
    console.log('[PAYMENT SUCCESS DEBUG] customerNameParam:', customerNameParam);
    console.log('[PAYMENT SUCCESS DEBUG] totalParam:', totalParam);
    console.log('[PAYMENT SUCCESS DEBUG] venueNameParam:', venueNameParam);
    
    const allParams = Object.fromEntries(new URLSearchParams(window.location.search));
    console.log('[PAYMENT SUCCESS DEBUG] All URL params:', allParams);
    
    if (isDemo && orderId) {
      console.log('[PAYMENT SUCCESS DEBUG] ===== DEMO ORDER LOADING STARTED =====');
      console.log('[PAYMENT SUCCESS DEBUG] Demo order ID:', orderId);
      console.log('[PAYMENT SUCCESS DEBUG] Order ID starts with "demo-":', orderId?.startsWith('demo-'));
      
      // Check all localStorage immediately
      console.log('[PAYMENT SUCCESS DEBUG] ===== CHECKING LOCALSTORAGE =====');
      console.log('[PAYMENT SUCCESS DEBUG] localStorage available:', typeof localStorage !== 'undefined');
      console.log('[PAYMENT SUCCESS DEBUG] localStorage length:', localStorage.length);
      console.log('[PAYMENT SUCCESS DEBUG] All localStorage keys:', Object.keys(localStorage));
      
      console.log('[PAYMENT SUCCESS DEBUG] All localStorage items:');
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        const value = localStorage.getItem(key || '');
        console.log(`[PAYMENT SUCCESS DEBUG]   Key: "${key}"`);
        console.log(`[PAYMENT SUCCESS DEBUG]   Value length: ${value?.length || 0}`);
        console.log(`[PAYMENT SUCCESS DEBUG]   First 100 chars: ${value?.substring(0, 100)}...`);
      }
      
      // Try to get the data immediately (no retry needed for localStorage)
      console.log('[PAYMENT SUCCESS DEBUG] ===== ATTEMPTING TO LOAD DATA =====');
      console.log('[PAYMENT SUCCESS DEBUG] Looking for key: "demo-order-data"');
      
      const storedData = localStorage.getItem("demo-order-data");
      console.log('[PAYMENT SUCCESS DEBUG] localStorage.getItem result:');
      console.log('[PAYMENT SUCCESS DEBUG] - Type:', typeof storedData);
      console.log('[PAYMENT SUCCESS DEBUG] - Is null:', storedData === null);
      console.log('[PAYMENT SUCCESS DEBUG] - Is undefined:', storedData === undefined);
      console.log('[PAYMENT SUCCESS DEBUG] - Data exists:', !!storedData);
      console.log('[PAYMENT SUCCESS DEBUG] - Data length:', storedData?.length || 0);
      console.log('[PAYMENT SUCCESS DEBUG] - First 200 chars:', storedData?.substring(0, 200));
      
      if (storedData) {
        try {
          console.log('[PAYMENT SUCCESS DEBUG] ===== PARSING DATA =====');
          console.log('[PAYMENT SUCCESS DEBUG] About to JSON.parse...');
          
          const data = JSON.parse(storedData);
          
          console.log('[PAYMENT SUCCESS DEBUG] ✅ Parse successful!');
          console.log('[PAYMENT SUCCESS DEBUG] Parsed data type:', typeof data);
          console.log('[PAYMENT SUCCESS DEBUG] Parsed data keys:', Object.keys(data));
          console.log('[PAYMENT SUCCESS DEBUG] Parsed demo order structure:', {
            id: data.id,
            venue_id: data.venue_id,
            customer_name: data.customer_name,
            total_amount: data.total_amount,
            items_count: data.items?.length || 0
          });
          console.log('[PAYMENT SUCCESS DEBUG] Full parsed data:', JSON.stringify(data, null, 2));
          console.log('[PAYMENT SUCCESS DEBUG] Order ID from data:', data.id);
          console.log('[PAYMENT SUCCESS DEBUG] Expected order ID:', orderId);
          console.log('[PAYMENT SUCCESS DEBUG] IDs match:', data.id === orderId);
          
          console.log('[PAYMENT SUCCESS DEBUG] Calling setDemoOrderData...');
          setDemoOrderData(data);
          console.log('[PAYMENT SUCCESS DEBUG] ===== DATA SET SUCCESSFULLY =====');
          
          // Clean up after loading
          console.log('[PAYMENT SUCCESS DEBUG] Cleaning up localStorage...');
          localStorage.removeItem("demo-order-data");
          const verifyRemoved = localStorage.getItem("demo-order-data");
          console.log('[PAYMENT SUCCESS DEBUG] Cleanup verified:', verifyRemoved === null);
        } catch (error) {
          console.error('[PAYMENT SUCCESS DEBUG] ===== PARSING ERROR =====');
          console.error('[PAYMENT SUCCESS DEBUG] Error type:', error instanceof Error ? error.constructor.name : typeof error);
          console.error('[PAYMENT SUCCESS DEBUG] Error message:', error instanceof Error ? error.message : String(error));
          console.error('[PAYMENT SUCCESS DEBUG] Error stack:', error instanceof Error ? error.stack : 'No stack');
          console.error('[PAYMENT SUCCESS DEBUG] Raw data that failed to parse:', storedData);
          console.error('[PAYMENT SUCCESS DEBUG] Attempting to parse first 500 chars:', storedData?.substring(0, 500));
        }
      } else {
        console.error('[PAYMENT SUCCESS DEBUG] ===== NO DATA IN LOCALSTORAGE =====');
        console.error('[PAYMENT SUCCESS DEBUG] localStorage.getItem("demo-order-data") returned null/undefined');
        console.error('[PAYMENT SUCCESS DEBUG] localStorage state:');
        console.error('[PAYMENT SUCCESS DEBUG] - Total keys:', localStorage.length);
        console.error('[PAYMENT SUCCESS DEBUG] - All keys:', Object.keys(localStorage));
        
        // Try to reconstruct from URL parameters as fallback
        console.log('[PAYMENT SUCCESS DEBUG] ===== CHECKING URL PARAMETER FALLBACK =====');
        console.log('[PAYMENT SUCCESS DEBUG] customerNameParam:', customerNameParam);
        console.log('[PAYMENT SUCCESS DEBUG] totalParam:', totalParam);
        console.log('[PAYMENT SUCCESS DEBUG] Has fallback data:', !!(customerNameParam || totalParam));
        
        if (customerNameParam || totalParam) {
          console.log('[PAYMENT SUCCESS DEBUG] ===== USING URL PARAMETER FALLBACK =====');
          const reconstructedData = {
            id: orderId || `demo-${Date.now()}`,
            venue_id: 'demo-cafe',
            venue_name: venueNameParam || 'Servio Café',
            table_number: 1,
            order_status: 'PLACED',
            payment_status: 'PAID',
            payment_method: paymentMethod || 'demo',
            customer_name: customerNameParam || 'Demo Customer',
            customer_phone: '',
            total_amount: parseFloat(totalParam || '0'),
            items: [],
            created_at: new Date().toISOString(),
          };
          console.log('[PAYMENT SUCCESS DEBUG] Reconstructed order from URL params:', JSON.stringify(reconstructedData, null, 2));
          console.log('[PAYMENT SUCCESS DEBUG] Calling setDemoOrderData with reconstructed data...');
          setDemoOrderData(reconstructedData);
          console.log('[PAYMENT SUCCESS DEBUG] ✅ Fallback data set successfully');
        } else {
          console.error('[PAYMENT SUCCESS DEBUG] ❌ No fallback data available in URL parameters');
          console.error('[PAYMENT SUCCESS DEBUG] Customer flow will see error screen');
        }
      }
    } else {
      console.log('[PAYMENT SUCCESS DEBUG] ===== NOT A DEMO ORDER =====');
      console.log('[PAYMENT SUCCESS DEBUG] Reason: isDemo =', isDemo, ', orderId =', orderId);
      console.log('[PAYMENT SUCCESS DEBUG] Will proceed with normal order flow');
    }
    
    console.log('[PAYMENT SUCCESS DEBUG] ===== useEffect COMPLETE =====');
  }, [isDemo, orderId, customerNameParam, totalParam, venueNameParam, paymentMethod]);

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