import { toast } from "@/hooks/use-toast";
import { PaymentAction } from "./usePaymentState";
import { CheckoutData } from "@/types/payment";

export function usePaymentProcessing() {
  const processPayment = async (
    action: PaymentAction,
    checkoutData: CheckoutData,
    _setOrderNumber: (orderNumber: string) => void,
    _setPaymentComplete: (complete: boolean) => void,
    setIsProcessing: (processing: boolean) => void,
    setError: (error: string | null) => void
  ) => {
    setIsProcessing(true);
    setError(null);

    try {
      // Helper function to create order in database
      const createOrder = async () => {
        const orderData = {
          venue_id: checkoutData.venueId,
          table_number: checkoutData.tableNumber,
          table_id: null,
          // Removed: counter_number, order_type, order_location - don't exist in DB
          customer_name: checkoutData.customerName,
          customer_phone: checkoutData.customerPhone,
          items: checkoutData.cart.map((item) => ({
            menu_item_id: item.id || "unknown",
            quantity: item.quantity,
            price: item.price,
            item_name: item.name,
            specialInstructions: item.specialInstructions || null,
          })),
          total_amount: checkoutData.total,
          notes: checkoutData.notes || "",
          order_status: "IN_PREP", // Start as IN_PREP so it shows in Live Orders immediately as "Preparing"
          payment_status: "UNPAID",
          payment_mode:
            action === "till" ? "pay_at_till" : action === "later" ? "pay_later" : "online",
          payment_method: action === "demo" ? "demo" : action === "till" ? "till" : null,
          // NOTE: session_id is NOT a database column - don't send it
          source: checkoutData.source || "qr",
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

        // Clear cart after successful order (keep checkout-data for order summary page)
        localStorage.removeItem("servio-order-cart");

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
            amount: checkoutData.total,
            customerEmail: checkoutData.customerEmail || "customer@email.com",
            customerName: checkoutData.customerName,
            venueName: checkoutData.venueName || "Restaurant",
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


        const tillPayload = {
          order_id: orderId,
          venueId: checkoutData.venueId,
          tableNumber: checkoutData.tableNumber,
          customerName: checkoutData.customerName,
          customerPhone: checkoutData.customerPhone,
        };


        const response = await fetch("/api/pay/till", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(tillPayload),
        });

          ok: response.ok,
          status: response.status,
          statusText: response.statusText,
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error("[PAYMENT] ❌ Pay till failed:", {
            status: response.status,
            statusText: response.statusText,
            errorText,
          });
          throw new Error(
            `Failed to confirm order for till payment: ${response.status} - ${errorText}`
          );
        }

        const result = await response.json();

        // Clear cart after successful order (keep checkout-data for order summary page)
        localStorage.removeItem("servio-order-cart");

        // Redirect to order summary page
        window.location.href = `/order-summary?orderId=${orderId}`;
      } else if (action === "later") {
        // Pay later - create order immediately, show "Order Confirmed!"
        const orderResult = await createOrder();
        const orderId = orderResult.order?.id;


        const laterPayload = {
          order_id: orderId,
          venueId: checkoutData.venueId,
          tableNumber: checkoutData.tableNumber,
          customerName: checkoutData.customerName,
          customerPhone: checkoutData.customerPhone,
          sessionId: checkoutData.sessionId || `session_${Date.now()}`,
        };


        const response = await fetch("/api/pay/later", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(laterPayload),
        });

          ok: response.ok,
          status: response.status,
          statusText: response.statusText,
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error("[PAYMENT] ❌ Pay later failed:", {
            status: response.status,
            statusText: response.statusText,
            errorText,
          });
          throw new Error(`Failed to confirm order: ${response.status} - ${errorText}`);
        }

        const result = await response.json();

        // Store session for re-scanning
        const sessionId = checkoutData.sessionId || `session_${Date.now()}`;
        localStorage.setItem("servio-current-session", sessionId);
        localStorage.setItem(
          `servio-order-${sessionId}`,
          JSON.stringify({
            orderId: orderId,
            venueId: checkoutData.venueId,
            tableNumber: checkoutData.tableNumber,
            customerName: checkoutData.customerName,
            customerPhone: checkoutData.customerPhone,
            cart: checkoutData.cart,
            total: checkoutData.total,
            orderNumber: result.order_number || "",
          })
        );

        // Clear cart after successful order (keep checkout-data for order summary page)
        localStorage.removeItem("servio-order-cart");

        // Redirect to order summary page
        window.location.href = `/order-summary?orderId=${orderId}`;
      }
    } catch (_err) {
      setError(_err instanceof Error ? _err.message : "Payment failed. Please try again.");
      toast({
        title: "Payment Error",
        description: _err instanceof Error ? _err.message : "Payment failed. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return { processPayment };
}
