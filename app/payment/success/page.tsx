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

  useEffect(() => {
    // Handle Stripe payment success with session_id but no orderId
    if (sessionId && !orderId && !isDemo) {
      // Look up order by stripe_session_id
      fetch(`/api/orders/by-session/${sessionId}`)
        .then(response => response.json())
        .then(data => {
          if (data.ok && data.orderId) {
            setVerifiedOrderId(data.orderId);
          }
        })
        .catch(error => {

        });
    }
    
    if (isDemo && orderId) {
      // Check localStorage for demo order data
      const storedData = localStorage.getItem("demo-order-data");
      
      if (storedData) {
        try {
          const data = JSON.parse(storedData);
          setDemoOrderData(data);
          
          // Clean up after loading
          localStorage.removeItem("demo-order-data");
        } catch (error) {

        }
      } else {
        // Fallback: try to reconstruct order from URL parameters
        if (customerNameParam && totalParam && venueNameParam) {
          const reconstructedData = {
            id: orderId || `demo-${Date.now()}`,
            venue_id: 'demo-cafe',
            venue_name: venueNameParam || 'Demo Café',
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
          setDemoOrderData(reconstructedData);
        }
      }
    }
  }, [isDemo, orderId, customerNameParam, totalParam, venueNameParam, paymentMethod, sessionId]);

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