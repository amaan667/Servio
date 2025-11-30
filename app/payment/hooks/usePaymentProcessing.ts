import { logger } from "@/lib/logger";
import { toast } from "@/hooks/use-toast";
import { PaymentAction } from "./usePaymentState";
import { CheckoutData } from "@/types/payment";
import {
  queueOrder,
  queuePayment,
  queueStatusUpdate,
  getOfflineQueue,
} from "@/lib/offline-queue";

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
      // Helper function to create order in database (with offline support)
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
            action === "till" ? "pay_at_till" : action === "later" ? "pay_later" : action === "stripe" ? "online" : "online",
          payment_method: action === "demo" ? "demo" : action === "till" ? "till" : null,
          // NOTE: session_id is NOT a database column - don't send it
          source: checkoutData.source || "qr",
        };

        // Check if offline - queue order if offline
        if (!navigator.onLine) {
          logger.info("[OFFLINE] Queueing order for offline sync");
          const queueId = await queueOrder(orderData, "/api/orders");
          toast({
            title: "Order Queued",
            description: "Your order has been queued and will be processed when you're back online.",
          });
          // Return a mock result so the flow can continue
          return {
            order: {
              id: `queued-${queueId}`,
              order_number: `QUEUED-${Date.now()}`,
              status: "QUEUED",
            },
          };
        }

        // Online - create order immediately
        const createOrderResponse = await fetch("/api/orders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(orderData),
        });

        if (!createOrderResponse.ok) {
          // If network error, queue the order
          if (!navigator.onLine || createOrderResponse.status === 0) {
            logger.info("[OFFLINE] Network error, queueing order");
            const queueId = await queueOrder(orderData, "/api/orders");
            toast({
              title: "Order Queued",
              description: "Your order has been queued and will be processed when you're back online.",
            });
            return {
              order: {
                id: `queued-${queueId}`,
                order_number: `QUEUED-${Date.now()}`,
                status: "QUEUED",
              },
            };
          }

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
        // Demo payment - just mark as paid (with offline support)
        if (!navigator.onLine) {
          await queueStatusUpdate(
            orderId,
            "PAID",
            "/api/orders/update-payment-status",
            "PAID",
            "demo"
          );
          toast({
            title: "Payment Queued",
            description: "Payment status will be updated when you're back online.",
          });
        } else {
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
            // Queue if network error
            if (!navigator.onLine || response.status === 0) {
              await queueStatusUpdate(
                orderId,
                "PAID",
                "/api/orders/update-payment-status",
                "PAID",
                "demo"
              );
              toast({
                title: "Payment Queued",
                description: "Payment status will be updated when you're back online.",
              });
            } else {
              throw new Error("Failed to update payment status");
            }
          }
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
          venue_id: checkoutData.venueId,
          tableNumber: checkoutData.tableNumber,
          customerName: checkoutData.customerName,
          customerPhone: checkoutData.customerPhone,
        };

        // Till payment (with offline support)
        let result;
        if (!navigator.onLine) {
          await queuePayment(tillPayload, "/api/pay/till");
          toast({
            title: "Payment Queued",
            description: "Till payment will be processed when you're back online.",
          });
          // Create mock result for offline flow
          result = { order_number: `QUEUED-${Date.now()}` };
        } else {
          const response = await fetch("/api/pay/till", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(tillPayload),
          });

          if (!response.ok) {
            // Queue if network error
            if (!navigator.onLine || response.status === 0) {
              await queuePayment(tillPayload, "/api/pay/till");
              toast({
                title: "Payment Queued",
                description: "Till payment will be processed when you're back online.",
              });
              result = { order_number: `QUEUED-${Date.now()}` };
            } else {
              const errorText = await response.text();
              logger.error("[PAYMENT] ❌ Pay till failed:", {
                status: response.status,
                statusText: response.statusText,
                errorText,
              });
              throw new Error(
                `Failed to confirm order for till payment: ${response.status} - ${errorText}`
              );
            }
          } else {
            result = await response.json();
          }
        }

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
          venue_id: checkoutData.venueId,
          tableNumber: checkoutData.tableNumber,
          customerName: checkoutData.customerName,
          customerPhone: checkoutData.customerPhone,
          sessionId: checkoutData.sessionId || `session_${Date.now()}`,
        };

        // Pay later (with offline support)
        let result;
        if (!navigator.onLine) {
          await queuePayment(laterPayload, "/api/pay/later");
          toast({
            title: "Payment Queued",
            description: "Pay later will be processed when you're back online.",
          });
          // Create mock result for offline flow
          result = { order_number: `QUEUED-${Date.now()}` };
        } else {
          const response = await fetch("/api/pay/later", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(laterPayload),
          });

          if (!response.ok) {
            // Queue if network error
            if (!navigator.onLine || response.status === 0) {
              await queuePayment(laterPayload, "/api/pay/later");
              toast({
                title: "Payment Queued",
                description: "Pay later will be processed when you're back online.",
              });
              result = { order_number: `QUEUED-${Date.now()}` };
            } else {
              const errorText = await response.text();
              logger.error("[PAYMENT] ❌ Pay later failed:", {
                status: response.status,
                statusText: response.statusText,
                errorText,
              });
              throw new Error(`Failed to confirm order: ${response.status} - ${errorText}`);
            }
          } else {
            result = await response.json();
          }
        }

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
