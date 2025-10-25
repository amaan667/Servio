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
      if (action === 'demo') {
        // Demo payment - just mark as paid
        const response = await fetch('/api/orders/update-payment-status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orderId: checkoutData.orderId,
            paymentStatus: 'PAID',
            paymentMethod: 'demo'
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to update payment status');
        }

        setOrderNumber(checkoutData.orderNumber || checkoutData.orderId);
        setPaymentComplete(true);
        
        toast({
          title: "Payment Successful!",
          description: "Demo payment processed successfully",
        });

        // Clear checkout data
        localStorage.removeItem('servio-checkout-data');
      } else if (action === 'stripe') {
        // Stripe payment - for customer orders, we don't need tier validation
        console.info('[PAYMENT] Processing Stripe payment for customer order');
        
        const response = await fetch('/api/pay/stripe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orderId: checkoutData.orderId,
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

        console.info('[PAYMENT] Stripe checkout session created:', result);
        
        // Redirect to Stripe checkout
        if (result.url) {
          window.location.href = result.url;
        } else {
          throw new Error('No Stripe checkout URL returned');
        }
      } else if (action === 'till') {
        // Till payment - marks order as confirmed, sends to table management
        const response = await fetch('/api/pay/till', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            order_id: checkoutData.orderId,
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
        setOrderNumber(result.order_number || checkoutData.orderNumber || checkoutData.orderId);
        setPaymentComplete(true);
        
        toast({
          title: "Order Confirmed!",
          description: "Order sent to kitchen. Pay at the till when ready.",
        });

        localStorage.removeItem('servio-checkout-data');
        localStorage.removeItem('servio-current-session');
      } else if (action === 'later') {
        // Pay later - keeps payment_status as PAY_LATER
        // When QR scanned again, it will redirect to payment page
        const response = await fetch('/api/pay/later', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            order_id: checkoutData.orderId,
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
        setOrderNumber(result.order_number || checkoutData.orderNumber || checkoutData.orderId);
        
        // Store session for re-scanning
        const sessionId = checkoutData.sessionId || `session_${Date.now()}`;
        localStorage.setItem('servio-current-session', sessionId);
        localStorage.setItem(`servio-order-${sessionId}`, JSON.stringify({
          orderId: checkoutData.orderId,
          venueId: checkoutData.venueId,
          tableNumber: checkoutData.tableNumber,
          customerName: checkoutData.customerName,
          customerPhone: checkoutData.customerPhone,
          cart: checkoutData.cart,
          total: checkoutData.total,
          orderNumber: result.order_number
        }));
        
        setPaymentComplete(true);
        
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

