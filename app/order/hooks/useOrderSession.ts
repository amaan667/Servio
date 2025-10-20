import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { CustomerInfo, OrderParams } from '../types';

export function useOrderSession(orderParams: OrderParams) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [session, setSession] = useState<unknown>(null);
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo>({
    name: "",
    phone: "",
  });
  const [showCheckout, setShowCheckout] = useState(false);

  const updateCustomerInfo = (field: 'name' | 'phone', value: string) => {
    setCustomerInfo(prev => ({ ...prev, [field]: value }));
  };

  useEffect(() => {
    // Log order access
    fetch('/api/log-order-access', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        venueSlug: orderParams.venueSlug,
        tableNumber: orderParams.tableNumber,
        counterNumber: orderParams.counterNumber,
        orderType: orderParams.orderType,
        orderLocation: orderParams.orderLocation,
        isDemo: orderParams.isDemo,
        url: window.location.href
      })
    }).catch(() => {});

    checkForExistingOrder();
  }, [orderParams, searchParams]);

  const checkForExistingOrder = async () => {
    try {
      const sessionParam = searchParams?.get('session');
      
      if (sessionParam) {
        const storedOrderData = localStorage.getItem(`servio-order-${sessionParam}`);
        if (storedOrderData) {
          const orderData = JSON.parse(storedOrderData);
          
          const { data: orderInDb } = await supabase
            .from('orders')
            .select('*')
            .eq('id', orderData.orderId)
            .eq('venue_id', orderParams.venueSlug)
            .in('order_status', ['PLACED', 'ACCEPTED', 'IN_PREP', 'READY', 'OUT_FOR_DELIVERY', 'SERVING'])
            .in('payment_status', ['UNPAID', 'PAY_LATER', 'IN_PROGRESS'])
            .single();

          if (orderInDb) {
            const checkoutData = {
              venueId: orderData.venueId,
              venueName: 'Restaurant',
              tableNumber: orderData.tableNumber,
              customerName: orderData.customerName,
              customerPhone: orderData.customerPhone,
              cart: orderData.cart || [],
              total: orderData.total,
              orderId: orderData.orderId,
              orderNumber: orderData.orderNumber,
              sessionId: sessionParam,
              isDemo: orderParams.isDemo,
            };
            
            localStorage.setItem('servio-checkout-data', JSON.stringify(checkoutData));
            window.location.href = '/payment';
            return;
          } else {
            localStorage.removeItem(`servio-order-${sessionParam}`);
          }
        }
      }
      
      const storedSession = localStorage.getItem('servio-current-session');
      if (storedSession && !sessionParam) {
        const storedOrderData = localStorage.getItem(`servio-order-${storedSession}`);
        if (storedOrderData) {
          const orderData = JSON.parse(storedOrderData);
          
          const { data: sessionOrderInDb } = await supabase
            .from('orders')
            .select('*')
            .eq('id', orderData.orderId)
            .eq('venue_id', orderParams.venueSlug)
            .in('order_status', ['PLACED', 'ACCEPTED', 'IN_PREP', 'READY', 'OUT_FOR_DELIVERY', 'SERVING'])
            .in('payment_status', ['UNPAID', 'PAY_LATER', 'IN_PROGRESS'])
            .single();

          if (sessionOrderInDb) {
            const checkoutData = {
              venueId: orderData.venueId,
              venueName: 'Restaurant',
              tableNumber: orderData.tableNumber,
              customerName: orderData.customerName,
              customerPhone: orderData.customerPhone,
              cart: orderData.cart || [],
              total: orderData.total,
              orderId: orderData.orderId,
              orderNumber: orderData.orderNumber,
              sessionId: storedSession,
              isDemo: orderParams.isDemo,
            };
            
            localStorage.setItem('servio-checkout-data', JSON.stringify(checkoutData));
            window.location.href = '/payment';
            return;
          } else {
            localStorage.removeItem(`servio-order-${storedSession}`);
            localStorage.removeItem('servio-current-session');
          }
        }
      }
    } catch (error) {

    }
  };

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setSession(user ? { user } : null);
    };
    getUser();

    const checkUnpaidOrders = async () => {
      try {
        const { data: activeOrders } = await supabase
          .from('orders')
          .select('*')
          .eq('venue_id', orderParams.venueSlug)
          .eq('table_number', orderParams.tableNumber)
          .in('order_status', ['PLACED', 'ACCEPTED', 'IN_PREP', 'READY', 'OUT_FOR_DELIVERY', 'SERVING'])
          .in('payment_status', ['UNPAID', 'PAY_LATER', 'IN_PROGRESS']);

        if (activeOrders && activeOrders.length > 0) {
          const tableSessionKey = `servio-session-${orderParams.tableNumber}`;
          const tableSessionData = localStorage.getItem(tableSessionKey);
          
          const sessionId = searchParams?.get('sessionId');
          const sessionSessionKey = sessionId ? `servio-session-${sessionId}` : null;
          const sessionSessionData = sessionSessionKey ? localStorage.getItem(sessionSessionKey) : null;
          
          const sessionData = tableSessionData || sessionSessionData;
          
          if (sessionData) {
            try {
              const session = JSON.parse(sessionData);
              
              if (session.paymentStatus === 'unpaid' || session.paymentStatus === 'till') {
                localStorage.setItem('servio-unpaid-order', JSON.stringify(session));
                router.push(`/order-summary?${orderParams.isCounterOrder ? 'counter' : 'table'}=${orderParams.orderLocation}&session=${session.orderId}`);
                return;
              }
              
              setShowCheckout(true);
              setCustomerInfo({
                name: session.customerName,
                phone: session.customerPhone
              });
            } catch (error) {

            }
          }
        } else {
          const tableSessionKey = `servio-session-${orderParams.tableNumber}`;
          localStorage.removeItem(tableSessionKey);
          
          const sessionId = searchParams?.get('sessionId');
          if (sessionId) {
            const sessionSessionKey = `servio-session-${sessionId}`;
            localStorage.removeItem(sessionSessionKey);
          }
        }
      } catch (error) {

      }
    };

    checkUnpaidOrders();

    try {
      if (supabase?.auth?.onAuthStateChange) {
        const result = supabase.auth.onAuthStateChange((_event: unknown, session: unknown) => {
          setSession(session);
        });
        return () => {
          try {
            (result as unknown)?.data?.subscription?.unsubscribe?.();
          } catch {}
        };
      }
    } catch (err) {
      // Auth state change setup failed
    }
    return () => {};
  }, [orderParams, router, searchParams]);

  return {
    session,
    customerInfo,
    showCheckout,
    setShowCheckout,
    updateCustomerInfo,
  };
}

