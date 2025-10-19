import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export interface PendingOrderData {
  venueId: string;
  venueName: string;
  tableNumber: number;
  counterNumber?: string;
  orderType?: string;
  orderLocation?: string;
  cart: Array<{
    id: string;
    name: string;
    price: number;
    quantity: number;
    specialInstructions?: string;
  }>;
  total: number;
  customerName: string;
  customerPhone: string;
  orderId?: string;
  isDemo?: boolean;
}

export function useOrderSummary() {
  const router = useRouter();
  const [orderData, setOrderData] = useState<PendingOrderData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isCreatingOrder, setIsCreatingOrder] = useState(false);
  const [orderPlaced, setOrderPlaced] = useState(false);

  useEffect(() => {
    const storedData = localStorage.getItem('servio-pending-order');
    
    console.debug('[ORDER SUMMARY DEBUG] Loading order data:', storedData);
    
    if (storedData) {
      try {
        const data = JSON.parse(storedData);
        console.debug('[ORDER SUMMARY DEBUG] Parsed data:', data);
        console.debug('[ORDER SUMMARY DEBUG] Is demo?', data.isDemo, data.venueId === 'demo-cafe');
        setOrderData(data);
      } catch (error) {
        console.error('Error parsing stored order data:', error);
        router.push('/order');
      }
    } else {
      console.debug('[ORDER SUMMARY DEBUG] No stored data, redirecting to order page');
      router.push('/order');
    }
    setLoading(false);
  }, [router]);

  const handlePayNow = async () => {
    console.debug('[ORDER SUMMARY DEBUG] ===== handlePayNow STARTED =====');
    console.debug('[ORDER SUMMARY DEBUG] Timestamp:', new Date().toISOString());
    console.debug('[ORDER SUMMARY DEBUG] Full orderData:', JSON.stringify(orderData, null, 2));
    
    if (!orderData) {
      console.error('[ORDER SUMMARY DEBUG] No orderData found!');
      alert('Error: No order data available. Please try placing your order again.');
      return;
    }
    
    const isDemo = orderData.isDemo || orderData.venueId === 'demo-cafe';
    
    console.debug('[ORDER SUMMARY DEBUG] ===== DEMO CHECK =====');
    console.debug('[ORDER SUMMARY DEBUG] isDemo calculated:', isDemo);
    
    if (isDemo) {
      console.debug('[ORDER SUMMARY DEBUG] ===== DEMO ORDER DETECTED =====');
      
      const demoOrderId = `demo-${Date.now()}`;
      console.debug('[ORDER SUMMARY DEBUG] Generated demoOrderId:', demoOrderId);
      
      setIsCreatingOrder(true);
      
      try {
        const response = await fetch('/api/orders/create-demo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            venueId: orderData.venueId,
            venueName: orderData.venueName,
            tableNumber: orderData.tableNumber,
            counterNumber: orderData.counterNumber,
            orderType: orderData.orderType,
            orderLocation: orderData.orderLocation,
            cart: orderData.cart,
            total: orderData.total,
            customerName: orderData.customerName,
            customerPhone: orderData.customerPhone,
            orderId: demoOrderId
          }),
        });
        
        const result = await response.json();
        
        if (!response.ok) {
          throw new Error(result.error || 'Failed to create demo order');
        }
        
        console.debug('[ORDER SUMMARY DEBUG] Demo order created successfully:', result);
        
        localStorage.removeItem('servio-pending-order');
        localStorage.setItem('servio-last-order-id', demoOrderId);
        
        setOrderPlaced(true);
        
        setTimeout(() => {
          router.push(`/order-summary/${demoOrderId}`);
        }, 1500);
      } catch (error) {
        console.error('[ORDER SUMMARY DEBUG] Error creating demo order:', error);
        alert('Error creating order. Please try again.');
      } finally {
        setIsCreatingOrder(false);
      }
      
      return;
    }
    
    setIsCreatingOrder(true);
    
    try {
      const response = await fetch('/api/orders/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          venueId: orderData.venueId,
          venueName: orderData.venueName,
          tableNumber: orderData.tableNumber,
          counterNumber: orderData.counterNumber,
          orderType: orderData.orderType,
          orderLocation: orderData.orderLocation,
          cart: orderData.cart,
          total: orderData.total,
          customerName: orderData.customerName,
          customerPhone: orderData.customerPhone
        }),
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to create order');
      }
      
      console.debug('[ORDER SUMMARY DEBUG] Order created successfully:', result);
      
      localStorage.removeItem('servio-pending-order');
      localStorage.setItem('servio-last-order-id', result.orderId);
      
      setOrderPlaced(true);
      
      setTimeout(() => {
        router.push(`/payment?orderId=${result.orderId}&amount=${orderData.total}`);
      }, 1500);
    } catch (error) {
      console.error('[ORDER SUMMARY DEBUG] Error creating order:', error);
      alert('Error creating order. Please try again.');
    } finally {
      setIsCreatingOrder(false);
    }
  };

  return {
    orderData,
    loading,
    isCreatingOrder,
    orderPlaced,
    handlePayNow
  };
}

