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
        console.info("💳 [PAYMENT] Creating order in database...");
        console.info("💳💳💳 CREATING ORDER NOW 💳💳💳", {
          customer: checkoutData.customerName,
          venue: checkoutData.venueId,
          total: checkoutData.total,
        });

        const orderData = {
          venue_id: checkoutData.venueId,
          table_number: checkoutData.tableNumber,
          table_id: null,
          counter_number: checkoutData.counterNumber || null,
          order_type: checkoutData.orderType || "table",
          order_location: checkoutData.orderLocation || checkoutData.tableNumber?.toString() || "1",
          customer_name: checkoutData.customerName,
          customer_phone: checkoutData.customerPhone,
          items: checkoutData.cart.map(
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
          total_amount: checkoutData.total,
          notes: checkoutData.notes || "",
          order_status: "IN_PREP", // Start as IN_PREP so it shows in Live Orders immediately as "Preparing"
          payment_status: "UNPAID",
          payment_mode:
            action === "till" ? "pay_at_till" : action === "later" ? "pay_later" : "online",
          payment_method: action === "demo" ? "demo" : action === "till" ? "till" : null,
          session_id: checkoutData.sessionId,
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
        console.info("✅ [PAYMENT] Order created in database:", orderResult.order?.id);
        console.info("✅✅✅ ORDER CREATED IN DB ✅✅✅", {
          orderId: orderResult.order?.id,
        });

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
        console.info("[PAYMENT] Stripe selected - creating order then redirecting to Stripe");
        console.info("💳 Creating order BEFORE Stripe checkout...");

        // Create order first with UNPAID status
        const orderResult = await createOrder();
        const orderId = orderResult.order?.id;

        if (!orderId) {
          throw new Error("Failed to create order before Stripe checkout");
        }

        console.info("✅ Order created:", orderId, "- now creating Stripe session...");

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
          console.error("[PAYMENT] Stripe checkout failed:", result);
          throw new Error(result.error || "Failed to create checkout session");
        }

        console.info("[PAYMENT] Redirecting to Stripe...");
        console.info("✅ Stripe session created, redirecting");

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

        console.info("[PAYMENT] Processing till payment...");
        console.info("💵 Processing till payment", { orderId });

        const response = await fetch("/api/pay/till", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            order_id: orderId,
            venueId: checkoutData.venueId,
            tableNumber: checkoutData.tableNumber,
            customerName: checkoutData.customerName,
            customerPhone: checkoutData.customerPhone,
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to confirm order for till payment");
        }

        await response.json();

        console.info("✅ [PAYMENT] Order confirmed for till payment");
        console.info("✅ Till payment confirmed - order sent to kitchen", { orderId });

        // Redirect to order summary page
        window.location.href = `/order-summary?orderId=${orderId}`;
      } else if (action === "later") {
        // Pay later - create order immediately, show "Order Confirmed!"
        const orderResult = await createOrder();
        const orderId = orderResult.order?.id;

        console.info("[PAYMENT] Processing pay later...");
        console.info("⏰ Processing pay later", { orderId });

        const response = await fetch("/api/pay/later", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            order_id: orderId,
            venueId: checkoutData.venueId,
            tableNumber: checkoutData.tableNumber,
            customerName: checkoutData.customerName,
            customerPhone: checkoutData.customerPhone,
            sessionId: checkoutData.sessionId || `session_${Date.now()}`,
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to confirm order");
        }

        const result = await response.json();

        console.info("✅ [PAYMENT] Order confirmed for pay later");
        console.info("✅ Pay later confirmed - order sent to kitchen", { orderId });

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
            orderNumber: result.order_number || orderNumber,
          })
        );

        // Redirect to order summary page
        window.location.href = `/order-summary?orderId=${orderId}`;
      }
    } catch (err) {
      setError(err.message || "Payment failed. Please try again.");
      toast({
        title: "Payment Error",
        description: err.message || "Payment failed. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return { processPayment };
}
