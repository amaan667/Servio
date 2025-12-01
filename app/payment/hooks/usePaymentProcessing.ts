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
          order_status: "PLACED", // Start as PLACED so it shows in Live Orders immediately
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

          // Extract error message from response
          let errorMessage = `Failed to create order (${createOrderResponse.status})`;
          try {
            const responseText = await createOrderResponse.text();
            if (responseText) {
              try {
                const errorData = JSON.parse(responseText);
                // Handle multiple possible error response formats
                if (errorData.message && typeof errorData.message === "string") {
                  errorMessage = errorData.message;
                } else if (errorData.error && typeof errorData.error === "string") {
                  errorMessage = errorData.error;
                } else if (Array.isArray(errorData.details)) {
                  // Handle Zod validation errors with details array
                  const messages = errorData.details
                    .map((detail: { message?: string }) => detail?.message)
                    .filter(Boolean);
                  errorMessage = messages.length > 0 ? messages.join(", ") : errorMessage;
                } else if (typeof errorData === "string") {
                  errorMessage = errorData;
                }
              } catch {
                // If not JSON, use the text directly (limit length)
                errorMessage = responseText.length > 200 ? responseText.substring(0, 200) + "..." : responseText;
              }
            }
          } catch (textError) {
            logger.error("[PAYMENT] ❌ Error parsing order creation error:", textError);
            // Keep default error message
          }
          
          logger.error("[PAYMENT] ❌ Order creation failed:", {
            status: createOrderResponse.status,
            statusText: createOrderResponse.statusText,
            errorMessage,
          });
          
          throw new Error(errorMessage);
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
        let result;
        try {
          const response = await fetch("/api/stripe/create-customer-checkout", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              amount: checkoutData.total,
              customerEmail: checkoutData.customerEmail || "",
              customerName: checkoutData.customerName,
              venueName: checkoutData.venueName || "Restaurant",
              orderId: orderId, // Just pass order ID (small!)
            }),
          });

          const responseText = await response.text();
          
          if (!response.ok) {
            try {
              result = JSON.parse(responseText);
              const errorMsg = result?.error || result?.message || `Failed to create checkout session (${response.status})`;
              throw new Error(errorMsg);
            } catch (parseError) {
              throw new Error(`Failed to create checkout session: ${response.status} ${response.statusText}`);
            }
          }

          try {
            result = JSON.parse(responseText);
          } catch (parseError) {
            throw new Error("Invalid response from server");
          }

          // Redirect to Stripe checkout
          if (result?.data?.url || result?.url) {
            const checkoutUrl = result.data?.url || result.url;
            window.location.href = checkoutUrl;
            return; // Exit early on redirect
          } else {
            throw new Error("No Stripe checkout URL returned from server");
          }
        } catch (fetchError) {
          // Handle network errors and other fetch failures
          logger.error("[PAYMENT] ❌ Stripe checkout fetch error:", {
            error: fetchError instanceof Error ? fetchError.message : String(fetchError),
          });
          
          if (fetchError instanceof TypeError && fetchError.message.includes("fetch")) {
            throw new Error("Network error. Please check your connection and try again.");
          } else if (fetchError instanceof Error) {
            throw fetchError;
          } else {
            throw new Error("Failed to create checkout session. Please try again.");
          }
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
              let errorMessage = `Failed to confirm order for till payment (${response.status})`;
              try {
                const errorText = await response.text();
                if (errorText) {
                  try {
                    const errorJson = JSON.parse(errorText);
                    errorMessage = errorJson.error || errorJson.message || errorMessage;
                  } catch {
                    // If not JSON, use the text directly (limit length)
                    errorMessage = errorText.length > 200 ? errorText.substring(0, 200) + "..." : errorText;
                  }
                }
              } catch (textError) {
                logger.error("[PAYMENT] ❌ Error parsing till payment error:", textError);
              }
              
              logger.error("[PAYMENT] ❌ Pay till failed:", {
                status: response.status,
                statusText: response.statusText,
                errorMessage,
              });
              throw new Error(errorMessage);
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
              let errorMessage = `Failed to confirm order for pay later (${response.status})`;
              try {
                const errorText = await response.text();
                if (errorText) {
                  try {
                    const errorJson = JSON.parse(errorText);
                    errorMessage = errorJson.error || errorJson.message || errorMessage;
                  } catch {
                    // If not JSON, use the text directly (limit length)
                    errorMessage = errorText.length > 200 ? errorText.substring(0, 200) + "..." : errorText;
                  }
                }
              } catch (textError) {
                logger.error("[PAYMENT] ❌ Error parsing pay later error:", textError);
              }
              
              logger.error("[PAYMENT] ❌ Pay later failed:", {
                status: response.status,
                statusText: response.statusText,
                errorMessage,
              });
              throw new Error(errorMessage);
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
      // Properly extract error message to prevent "[object Object]"
      let errorMessage = "Payment failed. Please try again.";
      
      try {
        if (_err instanceof Error) {
          errorMessage = _err.message || "An unexpected error occurred";
        } else if (typeof _err === "string") {
          errorMessage = _err;
        } else if (_err && typeof _err === "object") {
          // Try to extract error message from error object
          const errObj = _err as Record<string, unknown>;
          
          // Check common error message fields
          if (errObj.message && typeof errObj.message === "string") {
            errorMessage = errObj.message;
          } else if (errObj.error && typeof errObj.error === "string") {
            errorMessage = errObj.error;
          } else if (errObj.details && typeof errObj.details === "string") {
            errorMessage = errObj.details;
          } else if (Array.isArray(errObj.details)) {
            // Handle array of error details (e.g., from Zod validation)
            const messages = errObj.details
              .map((detail: unknown) => {
                if (typeof detail === "string") return detail;
                if (detail && typeof detail === "object") {
                  const d = detail as Record<string, unknown>;
                  return d.message || d.error || null;
                }
                return null;
              })
              .filter(Boolean) as string[];
            errorMessage = messages.length > 0 ? messages.join(", ") : errorMessage;
          } else {
            // Last resort: try to stringify, but check if it's an object first
            try {
              const stringified = JSON.stringify(_err);
              // Only use JSON if it's not just "{}" or "[object Object]"
              if (stringified && stringified !== "{}" && !stringified.includes("[object")) {
                errorMessage = `Error: ${stringified.substring(0, 200)}`;
              }
            } catch {
              // If stringify fails, use default message
            }
          }
        }
      } catch (extractionError) {
        // If error extraction itself fails, use default message
        logger.error("[PAYMENT] ❌ Error extracting error message:", extractionError);
      }
      
      // Ensure we never show "[object Object]" - final check
      if (errorMessage.includes("[object Object]") || errorMessage.includes("[object")) {
        errorMessage = "An unexpected error occurred. Please try again.";
      }
      
      logger.error("[PAYMENT] ❌ Payment error caught:", {
        error: _err instanceof Error ? _err.message : String(_err),
        extractedMessage: errorMessage,
      });
      
      setError(errorMessage);
      toast({
        title: "Payment Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return { processPayment };
}
