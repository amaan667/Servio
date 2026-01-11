import { toast } from "@/hooks/use-toast";
import { PaymentAction } from "./usePaymentState";
import { CheckoutData } from "@/types/payment";
import { queueOrder, queueStatusUpdate } from "@/lib/offline-queue";

// Helper function to log to server (appears in Railway logs)
// Uses fetch with fire-and-forget to not block the payment flow
const logToServer = (

  data: Record<string, unknown>
) => {
  // Fire and forget - don't await, don't block
  fetch("/api/log-payment-flow", {

    headers: { "Content-Type": "application/json" },

      event,

      },
    }),
  }).catch(() => {
    // Silently fail - logging shouldn't break the flow

};

export function usePaymentProcessing() {
  const processPayment = async (

    logToServer("info", "PAYMENT_METHOD_SELECTED", {
      action,

    .toISOString(),

      },

    setIsProcessing(true);
    setError(null);

    try {
      // Helper function to create order in database (with offline support)
      const createOrder = async () => {
        

        // Build order payload that exactly matches database schema
        interface OrderItemPayload {

        }

        interface OrderPayload {

        }

        // Determine fulfillment_type and counter_label from checkoutData
        const fulfillmentType =
          checkoutData.source === "counter" ? "counter" : "table";
        const counterLabel =
          fulfillmentType === "counter"
            ? (checkoutData as { counterLabel?: string }).counterLabel ||
              (checkoutData as { counterNumber?: string }).counterNumber ||
              null

          // Note: Email is optional for all payment methods
          // For Pay Now (Stripe), email will be collected in Stripe Checkout
          // If provided upfront, it will be used; otherwise Stripe Checkout collects it

              const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
              if (uuidRegex.test(item.id)) {
                menuItemId = item.id;
              }
            }

            return {

            };
          }),

          order_status: "PLACED", // Default to PLACED so orders show "waiting on kitchen" initially
          payment_status: "UNPAID", // All unpaid orders start as UNPAID, updated to PAID via webhook for Stripe

        };

        // Log to server (appears in Railway) - FULL PAYLOAD - fire and forget
        logToServer("info", "ORDER_DATA_PREPARED", {
          action,

          fullPayload: JSON.stringify(orderData, null, 2),
          items: orderData.items.map((item, idx) => ({

          })),

         => ({

          })),

        // Check if offline - queue order if offline
        if (!navigator.onLine) {
          
          const queueId = await queueOrder(orderData, "/api/orders");
          toast({

          // Return a mock result so the flow can continue
          return {

              id: `queued-${queueId}`,
              order_number: `QUEUED-${Date.now()}`,

            },
          };
        }

        // Online - create order immediately
        // Log EXACT payload being sent - send to server so it appears in Railway logs
        const logPayload = {

            payload: JSON.stringify(orderData, null, 2),

              // Note: is_active is a GENERATED column - not included in payload
            },
            items_detail: orderData.items.map((item, idx) => ({

            })),
          },
        };

        // Send to server so it appears in Railway logs
        fetch("/api/log-payment-flow", {

          headers: { "Content-Type": "application/json" },

        }).catch(() => {
          // Silently handle - error logging failed

        // Also log to browser console for debugging

        .length,

        const createOrderResponse = await fetch("/api/orders", {

          headers: { "Content-Type": "application/json" },

        ),

        if (!createOrderResponse.ok) {
          // If network error, queue the order
          if (!navigator.onLine || createOrderResponse.status === 0) {
            
            const queueId = await queueOrder(orderData, "/api/orders");
            toast({

            return {

                id: `queued-${queueId}`,
                order_number: `QUEUED-${Date.now()}`,

              },
            };
          }

          // Extract error message from response - LOG THE FULL ERROR FIRST
          let errorMessage = `Failed to create order (${createOrderResponse.status})`;
          let fullErrorResponse: unknown = null;

          try {
            const responseText = await createOrderResponse.text();

            if (responseText) {
              try {
                const errorData = JSON.parse(responseText);
                fullErrorResponse = errorData;

                // Handle multiple possible error response formats
                if (errorData.message && typeof errorData.message === "string") {
                  errorMessage = errorData.message;
                } else if (errorData.error && typeof errorData.error === "string") {
                  errorMessage = errorData.error;
                } else if (Array.isArray(errorData.details)) {
                  // Handle Zod validation errors with details array
                  const messages = errorData.details
                    .map((detail: { message?: string; path?: string }) => {
                      const path = detail.path ? `${detail.path}: ` : "";
                      return `${path}${detail.message || ""}`;

                    .filter(Boolean);
                  errorMessage =
                    messages.length > 0 ? `Validation error: ${messages.join("; ")}` : errorMessage;
                } else if (typeof errorData === "string") {
                  errorMessage = errorData;
                }

                // Log validation errors in detail - SEND TO SERVER FOR RAILWAY LOGS
                if (errorData.details && Array.isArray(errorData.details)) {
                  

                  // Send to server for Railway logs
                  fetch("/api/log-payment-flow", {

                    headers: { "Content-Type": "application/json" },

                        payload: JSON.stringify(orderData, null, 2),
                      },
                    }),
                  }).catch(() => {
                    // Silently handle - error logging failed

                }
              } catch {
                // If not JSON, use the text directly (limit length)

                errorMessage =
                  responseText.length > 200 ? responseText.substring(0, 200) + "..." : responseText;
              }
            }
          } catch (textError) {
            

            // Keep default error message
          }

          // SEND COMPREHENSIVE ERROR TO SERVER FOR RAILWAY LOGS
          fetch("/api/log-payment-flow", {

            headers: { "Content-Type": "application/json" },

                errorMessage,
                fullErrorResponse: JSON.stringify(fullErrorResponse, null, 2),

                requestPayload: JSON.stringify(orderData, null, 2),

                },
              },
            }),
          }).catch(() => {
            // Silently handle - error logging failed

          // Comprehensive error logging - send to server so it appears in Railway logs
          const errorLogPayload = {

              errorMessage,
              fullErrorResponse,

              requestPayload: JSON.stringify(orderData, null, 2),

              },
            },
          };

          // Send to server so it appears in Railway logs
          fetch("/api/log-payment-flow", {

            headers: { "Content-Type": "application/json" },

          }).catch(() => {
            // Silently handle - error logging failed

          // Also log to browser console for debugging

          throw new Error(errorMessage);
        }

        
        const orderResult = await createOrderResponse.json();

        // Log success to server (appears in Railway)
        logToServer("info", "ORDER_CREATION_SUCCESS", {

          action,

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

        } else {
          const response = await fetch("/api/orders/update-payment-status", {

            headers: { "Content-Type": "application/json" },

            }),

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
        

        let orderId: string;

        // If orderId exists in checkoutData, use existing order instead of creating new one
        if (checkoutData.orderId) {
          orderId = checkoutData.orderId;

          // Update existing order to PAY_NOW (will be set to PAID by webhook after payment)
          const updateResponse = await fetch("/api/orders/payment", {

            headers: { "Content-Type": "application/json" },

              payment_status: "UNPAID", // Will be updated to PAID by webhook
            }),

          if (!updateResponse.ok) {
            const errorData = await updateResponse.json();
            throw new Error(errorData.error || "Failed to update order payment method");
          }
        } else {
          // Create order first with UNPAID status
          const orderResult = await createOrder();
          orderId = orderResult.order?.id;

          if (!orderId) {
            throw new Error("Failed to create order before Stripe checkout");
          }
        }

        let result;
        try {
          const checkoutPayload = {

            ...(checkoutData.customerEmail && { customerEmail: checkoutData.customerEmail }),

          };

          

          const response = await fetch("/api/checkout", {

            headers: { "Content-Type": "application/json" },

          const responseText = await response.text();

          if (!response.ok) {
            try {
              result = JSON.parse(responseText);
              const errorMsg =
                result?.error ||
                result?.message ||
                `Failed to create checkout session (${response.status})`;
              throw new Error(errorMsg);
            } catch (parseError) {
              throw new Error(
                `Failed to create checkout session: ${response.status} ${response.statusText}`
              );
            }
          }

          try {
            result = JSON.parse(responseText);
          } catch (parseError) {
            throw new Error("Invalid response from server");
          }

          // Redirect to Stripe checkout
          if (result?.url || result?.data?.url) {
            const checkoutUrl = result.url || result.data?.url;

            

            // Clear cart before redirect
            localStorage.removeItem("servio-order-cart");
            localStorage.removeItem("servio-checkout-data");

            window.location.href = checkoutUrl;
            return; // Order created, webhook will mark as PAID after payment
          } else {
            
            throw new Error("No Stripe checkout URL returned from server");
          }
        } catch (fetchError) {
          // Handle network errors and other fetch failures

          if (fetchError instanceof TypeError && fetchError.message.includes("fetch")) {
            throw new Error("Network error. Please check your connection and try again.");
          } else if (fetchError instanceof Error) {
            throw fetchError;
          } else {
            throw new Error("Failed to create checkout session. Please try again.");
          }
        }
      } else if (action === "till") {
        

        let orderId: string;

        // If orderId exists in checkoutData, update existing order instead of creating new one
        if (checkoutData.orderId) {
          // Update existing order to PAY_AT_TILL
          const updateResponse = await fetch("/api/pay/till", {

            headers: { "Content-Type": "application/json" },

            }),

          if (!updateResponse.ok) {
            const errorData = await updateResponse.json();
            throw new Error(errorData.error || "Failed to update order payment method");
          }

          orderId = checkoutData.orderId;
        } else {
          // IMMEDIATELY create order in DB (per spec)
          const orderResult = await createOrder();
          orderId = orderResult.order?.id;

          if (!orderId) {
            throw new Error("Failed to create order");
          }
        }

        // Clear cart
        localStorage.removeItem("servio-order-cart");
        localStorage.removeItem("servio-checkout-data");

        // Redirect to order summary with orderId
        window.location.href = `/order-summary?orderId=${orderId}`;
        return;
      } else if (action === "later") {
        

        // IMMEDIATELY create order in DB (per spec)
        const orderResult = await createOrder();
        const orderId = orderResult.order?.id;

        if (!orderId) {
          throw new Error("Failed to create order");
        }

        // Store session for QR re-scan logic
        const sessionId = checkoutData.sessionId || `session_${Date.now()}`;
        localStorage.setItem("servio-current-session", sessionId);
        localStorage.setItem(
          `servio-order-${sessionId}`,
          JSON.stringify({
            orderId,

        );

        // Clear cart
        localStorage.removeItem("servio-order-cart");
        localStorage.removeItem("servio-checkout-data");

        // Redirect to order summary with orderId
        window.location.href = `/order-summary?orderId=${orderId}`;
        return;
      }

      .toISOString(),

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
        
      }

      // Ensure we never show "[object Object]" - final check
      if (errorMessage.includes("[object Object]") || errorMessage.includes("[object")) {
        errorMessage = "An unexpected error occurred. Please try again.";
      }

      // CRITICAL: Ensure errorMessage is always a string
      if (typeof errorMessage !== "string") {
        errorMessage = "An unexpected error occurred. Please try again.";
      }

      // Final safety check - ensure it's a valid string
      const safeErrorMessage = String(
        errorMessage || "An unexpected error occurred. Please try again."
      ).trim();

      // Remove any "[object Object]" strings that might have slipped through
      const cleanedErrorMessage = safeErrorMessage.replace(
        /\[object\s+Object\]/gi,
        "An unexpected error occurred"
      );

        action,

      .toISOString(),

      // Ensure we set a string, never an object
      setError(cleanedErrorMessage);

      // Ensure toast description is always a string
      const toastDescription =
        typeof cleanedErrorMessage === "string"
          ? cleanedErrorMessage

    } finally {
      .toISOString(),

      setIsProcessing(false);
    }
  };

  return { processPayment };
}
