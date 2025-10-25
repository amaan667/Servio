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
  const [demoOrderData, setDemoOrderData] = useState<unknown>(null);
  
  // URL parameter fallbacks
  const customerNameParam = searchParams?.get('customerName');
  const totalParam = searchParams?.get('total');
  const venueNameParam = searchParams?.get('venueName');

  useEffect(() => {
    // Handle Stripe payment success - CREATE ORDER NOW
    if (sessionId && !orderId && !isDemo) {
      // Check if we have pending order creation
      const checkoutDataStr = localStorage.getItem('servio-checkout-data');
      
      if (checkoutDataStr) {
        try {
          const checkoutData = JSON.parse(checkoutDataStr);
          
          if (checkoutData.pendingOrderCreation) {
            console.info('💳 [STRIPE SUCCESS] Payment successful - creating order in database NOW');
            
            // Create order now that payment succeeded
            const orderData = {
              venue_id: checkoutData.venueId,
              table_number: checkoutData.tableNumber,
              table_id: null,
              counter_number: checkoutData.counterNumber || null,
              order_type: checkoutData.orderType || 'table',
              order_location: checkoutData.orderLocation || checkoutData.tableNumber?.toString() || '1',
              customer_name: checkoutData.customerName,
              customer_phone: checkoutData.customerPhone,
              items: checkoutData.cart.map((item: any) => ({
                menu_item_id: item.id || 'unknown',
                quantity: item.quantity,
                price: item.price,
                item_name: item.name,
                specialInstructions: item.specialInstructions || null,
              })),
              total_amount: checkoutData.total,
              notes: checkoutData.notes || '',
              order_status: 'PLACED',
              payment_status: 'PAID',
              payment_mode: 'online',
              payment_method: 'stripe',
              session_id: checkoutData.sessionId,
              source: checkoutData.source || 'qr',
              stripe_session_id: sessionId,
            };

            fetch('/api/orders', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(orderData),
            })
              .then(async response => {
                const result = await response.json();
                console.info('📦 [STRIPE SUCCESS] Create order response:', {
                  ok: response.ok,
                  status: response.status,
                  hasOrder: !!result.order,
                  orderId: result.order?.id,
                  error: result.error
                });
                
                if (result.ok && result.order?.id) {
                  console.info('✅ [STRIPE SUCCESS] Order created after successful payment:', result.order.id);
                  localStorage.removeItem('servio-checkout-data');
                  
                  // Redirect to unified order summary page
                  window.location.href = `/order-summary?orderId=${result.order.id}`;
                } else {
                  console.error('❌ [STRIPE SUCCESS] Order creation failed:', result.error);
                  // Still redirect to order summary with session ID so user sees something
                  window.location.href = `/order-summary?session_id=${sessionId}`;
                }
              })
              .catch(error => {
                console.error('❌ [STRIPE SUCCESS] Network error creating order:', error);
                // Redirect anyway - maybe order was created but response failed
                window.location.href = `/order-summary?session_id=${sessionId}`;
              });
          }
        } catch (parseError) {
          console.error('❌ [STRIPE SUCCESS] Error parsing checkout data:', parseError);
        }
      } else {
        // Fallback: Try to look up existing order by stripe_session_id
        fetch(`/api/orders/by-session/${sessionId}`)
          .then(response => response.json())
          .then(data => {
            if (data.ok && data.orderId) {
              setVerifiedOrderId(data.orderId);
            }
          })
          .catch(error => {
            console.error('❌ [STRIPE SUCCESS] Error looking up order:', error);
          });
      }
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
      // Error silently handled
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