import { toast } from "@/hooks/use-toast";
import { PaymentAction } from "./usePaymentState";

export function usePaymentProcessing() {
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
      // Helper function to create order in database
      const createOrder = async () => {
        const orderData = {
          venue_id: (checkoutData as any).venueId,
          table_number: (checkoutData as any).tableNumber,
          table_id: null,
          // Removed: counter_number, order_type, order_location - don't exist in DB
          customer_name: (checkoutData as any).customerName,
          customer_phone: (checkoutData as any).customerPhone,
          items: (checkoutData as any).cart.map(
            (item: {
              id?: string;
              quantity: number;
              price: number;
              name: string;
              specialInstructions?: string;
            }) => ({
              menu_item_id: item.id || "unknown",
              quantity: item.quantity,
              price: item.price,
              item_name: item.name,
              specialInstructions: item.specialInstructions || null,
            })
          ),
          total_amount: (checkoutData as any).total,
          notes: (checkoutData as any).notes || "",
          order_status: "IN_PREP", // Start as IN_PREP so it shows in Live Orders immediately as "Preparing"
          payment_status: "UNPAID",
          payment_mode:
            action === "till" ? "pay_at_till" : action === "later" ? "pay_later" : "online",
          payment_method: action === "demo" ? "demo" : action === "till" ? "till" : null,
          // NOTE: session_id is NOT a database column - don't send it
          source: (checkoutData as any).source || "qr",
        };

        const createOrderResponse = await fetch("/api/orders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(orderData),
        });

        if (!createOrderResponse.ok) {
          const errorData = await createOrderResponse.json();
          throw new Error(errorData.error || "Failed to create order");
        }

        const orderResult = await createOrderResponse.json();

        return orderResult;
      };

      // Process payment based on selected method
      if (action === "demo") {
        // Create order immediately for demo
        const orderResult = await createOrder();
        const orderId = orderResult.order?.id;
        // Demo payment - just mark as paid
        const response = await fetch("/api/orders/update-payment-status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            orderId: orderId,
            paymentStatus: "PAID",
            paymentMethod: "demo",
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to update payment status");
        }

        // Redirect to order summary page
        window.location.href = `/order-summary?orderId=${orderId}&demo=1`;
      } else if (action === "stripe") {
        // Stripe payment - CREATE ORDER FIRST, then redirect to Stripe

        // Create order first with UNPAID status
        const orderResult = await createOrder();
        const orderId = orderResult.order?.id;

        if (!orderId) {
          throw new Error("Failed to create order before Stripe checkout");
        }

        // Create Stripe checkout session with just the order ID
        const response = await fetch("/api/stripe/create-customer-checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            amount: (checkoutData as any).total,
            customerEmail: (checkoutData as any).customerEmail || "customer@email.com",
            customerName: (checkoutData as any).customerName,
            venueName: (checkoutData as any).venueName || "Restaurant",
            orderId: orderId, // Just pass order ID (small!)
          }),
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || "Failed to create checkout session");
        }

        // Redirect to Stripe checkout
        if (result.url) {
          window.location.href = result.url;
        } else {
          throw new Error("No Stripe checkout URL returned");
        }
      } else if (action === "till") {
        // Till payment - create order immediately, show "Order Confirmed!"
        const orderResult = await createOrder();
        const orderId = orderResult.order?.id;

        const response = await fetch("/api/pay/till", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            order_id: orderId,
            venueId: (checkoutData as any).venueId,
            tableNumber: (checkoutData as any).tableNumber,
            customerName: (checkoutData as any).customerName,
            customerPhone: (checkoutData as any).customerPhone,
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to confirm order for till payment");
        }

        await response.json();

        // Redirect to order summary page
        window.location.href = `/order-summary?orderId=${orderId}`;
      } else if (action === "later") {
        // Pay later - create order immediately, show "Order Confirmed!"
        const orderResult = await createOrder();
        const orderId = orderResult.order?.id;

        const response = await fetch("/api/pay/later", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            order_id: orderId,
            venueId: (checkoutData as any).venueId,
            tableNumber: (checkoutData as any).tableNumber,
            customerName: (checkoutData as any).customerName,
            customerPhone: (checkoutData as any).customerPhone,
            sessionId: (checkoutData as any).sessionId || `session_${Date.now()}`,
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to confirm order");
        }

        const result = await response.json();

        // Store session for re-scanning
        const sessionId = (checkoutData as any).sessionId || `session_${Date.now()}`;
        localStorage.setItem("servio-current-session", sessionId);
        localStorage.setItem(
          `servio-order-${sessionId}`,
          JSON.stringify({
            orderId: orderId,
            venueId: (checkoutData as any).venueId,
            tableNumber: (checkoutData as any).tableNumber,
            customerName: (checkoutData as any).customerName,
            customerPhone: (checkoutData as any).customerPhone,
            cart: (checkoutData as any).cart,
            total: (checkoutData as any).total,
            orderNumber: result.order_number || orderNumber,
          })
        );

        // Redirect to order summary page
        window.location.href = `/order-summary?orderId=${orderId}`;
      }
    } catch (_err) {
      setError(_err.message || "Payment failed. Please try again.");
      toast({
        title: "Payment Error",
        description: _err.message || "Payment failed. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return { processPayment };
}
