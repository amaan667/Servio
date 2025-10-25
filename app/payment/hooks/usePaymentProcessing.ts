import { useRouter } from 'next/navigation';
import { toast } from '@/hooks/use-toast';
import { PaymentAction } from './usePaymentState';

export function usePaymentProcessing() {
  const router = useRouter();

  const processPayment = async (
    action: PaymentAction,
    checkoutData: unknown,
    setOrderNumber: (orderNumber: string) => void,
    setPaymentComplete: (complete: boolean) => void,
    setIsProcessing: (processing: boolean) => void,
    setError: (error: string | null) => void
  ) => {
    setIsProcessing(true);
    setError(null);

    try {
      // STEP 1: Create the order in database FIRST (before processing payment)
      console.info('💳 [PAYMENT] Creating order in database...');
      logger.info('💳💳💳 CREATING ORDER AFTER PAYMENT METHOD SELECTED 💳💳💳', {
        paymentMethod: action,
        customer: checkoutData.customerName,
        venue: checkoutData.venueId,
        total: checkoutData.total
      });
      
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
        payment_status: 'UNPAID',
        payment_mode: action === 'till' ? 'pay_at_till' : (action === 'later' ? 'pay_later' : 'online'),
        payment_method: action === 'demo' ? 'demo' : (action === 'till' ? 'till' : null),
        session_id: checkoutData.sessionId,
        source: checkoutData.source || 'qr',
      };

      const createOrderResponse = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderData),
      });

      if (!createOrderResponse.ok) {
        const errorData = await createOrderResponse.json();
        throw new Error(errorData.error || 'Failed to create order');
      }

      const orderResult = await createOrderResponse.json();
      const orderId = orderResult.order?.id;
      const orderNumber = orderResult.order?.order_number || orderId;

      console.info('✅ [PAYMENT] Order created in database:', orderId);
      logger.info('✅✅✅ ORDER CREATED SUCCESSFULLY ✅✅✅', {
        orderId,
        paymentMethod: action,
        requestId: orderResult.requestId
      });

      // STEP 2: Process payment based on selected method
      if (action === 'demo') {
        // Demo payment - just mark as paid
        const response = await fetch('/api/orders/update-payment-status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orderId: orderId,
            paymentStatus: 'PAID',
            paymentMethod: 'demo'
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to update payment status');
        }

        setOrderNumber(orderNumber);
        setPaymentComplete(true);
        
        toast({
          title: "Payment Successful!",
          description: "Demo payment processed successfully",
        });

        // Clear checkout data
        localStorage.removeItem('servio-checkout-data');
      } else if (action === 'stripe') {
        // Stripe payment - redirect to Stripe checkout
        console.info('[PAYMENT] Creating Stripe checkout session...');
        logger.info('💳 Processing Stripe payment', { orderId });
        
        const response = await fetch('/api/pay/stripe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orderId: orderId,
            amount: checkoutData.total,
            customerEmail: checkoutData.customerEmail || 'customer@email.com',
            customerName: checkoutData.customerName,
            venueName: checkoutData.venueName || 'Restaurant'
          }),
        });

        const result = await response.json();

        if (!response.ok) {
          console.error('[PAYMENT] Stripe checkout failed:', result);
          throw new Error(result.error || 'Failed to create checkout session');
        }

        console.info('[PAYMENT] Stripe checkout session created, redirecting...');
        logger.info('✅ Stripe checkout created, redirecting to Stripe', { orderId });
        
        // Redirect to Stripe checkout
        if (result.url) {
          window.location.href = result.url;
        } else {
          throw new Error('No Stripe checkout URL returned');
        }
      } else if (action === 'till') {
        // Till payment - marks order as confirmed
        console.info('[PAYMENT] Processing till payment...');
        logger.info('💵 Processing till payment', { orderId });
        
        const response = await fetch('/api/pay/till', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            order_id: orderId,
            venueId: checkoutData.venueId,
            tableNumber: checkoutData.tableNumber,
            customerName: checkoutData.customerName,
            customerPhone: checkoutData.customerPhone,
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to confirm order for till payment');
        }

        const result = await response.json();
        setOrderNumber(result.order_number || orderNumber);
        setPaymentComplete(true);
        
        console.info('✅ [PAYMENT] Order confirmed for till payment');
        logger.info('✅ Till payment confirmed - order sent to kitchen', { orderId });
        
        toast({
          title: "Order Confirmed!",
          description: "Order sent to kitchen. Pay at the till when ready.",
        });

        localStorage.removeItem('servio-checkout-data');
        localStorage.removeItem('servio-current-session');
      } else if (action === 'later') {
        // Pay later - order confirmed, can pay when re-scanning QR
        console.info('[PAYMENT] Processing pay later...');
        logger.info('⏰ Processing pay later', { orderId });
        
        const response = await fetch('/api/pay/later', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            order_id: orderId,
            venueId: checkoutData.venueId,
            tableNumber: checkoutData.tableNumber,
            customerName: checkoutData.customerName,
            customerPhone: checkoutData.customerPhone,
            sessionId: checkoutData.sessionId || `session_${Date.now()}`
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to confirm order');
        }

        const result = await response.json();
        setOrderNumber(result.order_number || orderNumber);
        
        // Store session for re-scanning
        const sessionId = checkoutData.sessionId || `session_${Date.now()}`;
        localStorage.setItem('servio-current-session', sessionId);
        localStorage.setItem(`servio-order-${sessionId}`, JSON.stringify({
          orderId: orderId,
          venueId: checkoutData.venueId,
          tableNumber: checkoutData.tableNumber,
          customerName: checkoutData.customerName,
          customerPhone: checkoutData.customerPhone,
          cart: checkoutData.cart,
          total: checkoutData.total,
          orderNumber: result.order_number || orderNumber
        }));
        
        setPaymentComplete(true);
        
        console.info('✅ [PAYMENT] Order confirmed for pay later');
        logger.info('✅ Pay later confirmed - order sent to kitchen', { orderId });
        
        toast({
          title: "Order Confirmed!",
          description: "Order sent to kitchen. You can pay later or scan the QR code again to pay online.",
        });

        localStorage.removeItem('servio-checkout-data');
      }
    } catch (err) {

      setError(err.message || 'Payment failed. Please try again.');
      toast({
        title: "Payment Error",
        description: err.message || 'Payment failed. Please try again.',
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return { processPayment };
}

