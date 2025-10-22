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
        // Stripe payment
        const response = await fetch('/api/stripe/create-checkout-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orderId: checkoutData.orderId,
            amount: checkoutData.total,
            customerEmail: checkoutData.customerEmail,
            venueName: checkoutData.venueName
          }),
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || 'Failed to create checkout session');
        }

        // Redirect to Stripe checkout
        window.location.href = result.url;
      } else if (action === 'till') {
        // Till payment
        const response = await fetch('/api/orders/update-payment-status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orderId: checkoutData.orderId,
            paymentStatus: 'PAID',
            paymentMethod: 'till'
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to update payment status');
        }

        setOrderNumber(checkoutData.orderNumber || checkoutData.orderId);
        setPaymentComplete(true);
        
        toast({
          title: "Payment Recorded!",
          description: "Payment will be processed at the till",
        });

        localStorage.removeItem('servio-checkout-data');
      } else if (action === 'later') {
        // Pay later
        const response = await fetch('/api/orders/update-payment-status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orderId: checkoutData.orderId,
            paymentStatus: 'UNPAID',
            paymentMethod: 'later'
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to update order');
        }

        setOrderNumber(checkoutData.orderNumber || checkoutData.orderId);
        setPaymentComplete(true);
        
        toast({
          title: "Order Placed!",
          description: "You can pay later",
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

