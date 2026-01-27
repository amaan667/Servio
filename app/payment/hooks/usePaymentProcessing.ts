
import { toast } from "@/hooks/use-toast";
import { PaymentAction } from "./usePaymentState";
import { CheckoutData } from "@/types/payment";
import { queueOrder, queueStatusUpdate } from "@/lib/offline-queue";
import { safeRemoveItem, safeSetItem } from "@/app/order/utils/safeStorage";

// Helper function to log to server (appears in Railway logs)
// Uses fetch with fire-and-forget to not block the payment flow
const logToServer = (
  level: "info" | "warn" | "error",
  event: string,
  data: Record<string, unknown>
) => {
  // Fire and forget - don't await, don't block
  fetch("/api/log-payment-flow", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      level,
      event,
      data: {
        ...data,
        timestamp: new Date().toISOString(),
      },
    }),
  }).catch(() => {
    // Silently fail - logging shouldn't break the flow
  });
};

export function usePaymentProcessing() {
  const processPayment = async (
    action: PaymentAction,
    checkoutData: CheckoutData,
    _setOrderNumber: (orderNumber: string) => void,
    _setPaymentComplete: (complete: boolean) => void,
    setIsProcessing: (processing: boolean) => void,
    setError: (error: string | null) => void
  ) => {

    // Log to server (appears in Railway) - fire and forget
    logToServer("info", "PAYMENT_METHOD_SELECTED", {
      action,
      venueId: checkoutData.venueId,
      tableNumber: checkoutData.tableNumber,
      customerName: checkoutData.customerName,
      customerPhone: checkoutData.customerPhone,
      total: checkoutData.total,
      cartItemCount: checkoutData.cart?.length || 0,
    });

    setIsProcessing(true);
    setError(null);

    try {
      // Helper function to create order in database (with offline support)
      const createOrder = async () => {

        // Build order payload that exactly matches database schema
        interface OrderItemPayload {
          menu_item_id: string | null;
          quantity: number;
          price: number;
          item_name: string;
          special_instructions: string | null;
        }

        interface OrderPayload {
          venue_id: string;
          customer_name: string;
          customer_phone: string;
          customer_email: string | null;
          table_number: string | null;
          table_id: null;
          fulfillment_type?: "table" | "counter" | "delivery" | "pickup";
          counter_label?: string | null;
          qr_type?: "TABLE_FULL_SERVICE" | "TABLE_COLLECTION" | "COUNTER";
          requires_collection?: boolean;
          items: OrderItemPayload[];
          total_amount: number;
          notes: string | null;
          order_status: string;
          payment_status: string;
          payment_mode: string;
          payment_method: string;
          // Note: is_active is a GENERATED column - do NOT include it in the payload
        }

        // Determine fulfillment_type and counter_label from checkoutData
        const fulfillmentType =
          checkoutData.source === "counter" ? "counter" : "table";
        const counterLabel =
          fulfillmentType === "counter"
            ? (checkoutData as { counterLabel?: string }).counterLabel ||
              (checkoutData as { counterNumber?: string }).counterNumber ||
              null
            : null;

        const orderData: OrderPayload = {
          venue_id: checkoutData.venueId,
          customer_name: checkoutData.customerName?.trim() || "",
          customer_phone: checkoutData.customerPhone?.trim() || "",
          customer_email: checkoutData.customerEmail?.trim() || null,
          // Note: Email is optional for all payment methods
          // For Pay Now (Stripe), email will be collected in Stripe Checkout
          // If provided upfront, it will be used; otherwise Stripe Checkout collects it
          table_number:
            fulfillmentType === "table" && checkoutData.tableNumber
              ? String(checkoutData.tableNumber)
              : null,
          table_id: null,
          fulfillment_type: fulfillmentType,
          counter_label: counterLabel,
          qr_type: checkoutData.qr_type,
          requires_collection: checkoutData.requiresCollection,
          items: checkoutData.cart.map((item) => {
            // Validate and fix menu_item_id - must be valid UUID or null
            let menuItemId: string | null = null;
            if (item.id && item.id !== "unknown") {
              // Check if it's a valid UUID
              const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
              if (uuidRegex.test(item.id)) {
                menuItemId = item.id;
              }
            }

            return {
              menu_item_id: menuItemId,
              quantity: item.quantity,
              price: item.price,
              item_name: item.name,
              special_instructions: item.specialInstructions || null,
            };
          }),
          total_amount: checkoutData.total,
          notes: checkoutData.notes || null,
          order_status: "PLACED", // Default to PLACED so orders show "waiting on kitchen" initially
          payment_status: "UNPAID", // All unpaid orders start as UNPAID, updated to PAID via webhook for Stripe
          payment_mode: action === "till" ? "offline" : action === "later" ? "deferred" : "online",
          payment_method:
            action === "demo"
              ? "PAY_NOW"
              : action === "stripe"
                ? "PAY_NOW"
                : action === "till"
                  ? "PAY_AT_TILL"
                  : action === "later"
                    ? "PAY_LATER"
                    : "PAY_NOW",
          // Note: source field is handled by the API route based on table_number
          // Note: is_active is a GENERATED column - do NOT include it in the payload
        };

        // Log to server (appears in Railway) - FULL PAYLOAD - fire and forget
        logToServer("info", "ORDER_DATA_PREPARED", {
          action,
          venueId: orderData.venue_id,
          customerName: orderData.customer_name,
          customerPhone: orderData.customer_phone,
          tableNumber: orderData.table_number,
          itemsCount: orderData.items.length,
          totalAmount: orderData.total_amount,
          paymentMode: orderData.payment_mode,
          paymentStatus: orderData.payment_status,
          orderStatus: orderData.order_status,
          fullPayload: JSON.stringify(orderData, null, 2),
          items: orderData.items.map((item, idx) => ({
            index: idx,
            menu_item_id: item.menu_item_id,
            item_name: item.item_name,
            quantity: item.quantity,
            price: item.price,
          })),
        });

        // Check if offline - queue order if offline
        if (!navigator.onLine) {

          const queueId = await queueOrder(orderData, "/api/orders");
          toast({
            title: "Order Queued",
            description:
              "Your order has been queued and will be processed when you're back online.",
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
        // Log EXACT payload being sent - send to server so it appears in Railway logs
        const logPayload = {
          level: "info",
          event: "SENDING_ORDER_CREATION_REQUEST",
          details: {
            timestamp: new Date().toISOString(),
            url: "/api/orders",
            method: "POST",
            online: navigator.onLine,
            payload: JSON.stringify(orderData, null, 2),
            payloadStructure: {
              venue_id: orderData.venue_id,
              customer_name: orderData.customer_name,
              customer_phone: orderData.customer_phone,
              customer_email: orderData.customer_email,
              table_number: orderData.table_number,
              table_id: orderData.table_id,
              items_count: orderData.items.length,
              total_amount: orderData.total_amount,
              order_status: orderData.order_status,
              payment_status: orderData.payment_status,
              payment_mode: orderData.payment_mode,
              payment_method: orderData.payment_method,
              // Note: is_active is a GENERATED column - not included in payload
            },
            items_detail: orderData.items.map((item, idx) => ({
              index: idx,
              menu_item_id: item.menu_item_id,
              item_name: item.item_name,
              quantity: item.quantity,
              price: item.price,
              hasSpecialInstructions: !!item.special_instructions,
            })),
          },
        };

        // Send to server so it appears in Railway logs
        fetch("/api/log-payment-flow", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(logPayload),
        }).catch(() => {
          // Silently handle - error logging failed
        });


        const createOrderResponse = await fetch("/api/orders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(orderData),
        });

        if (!createOrderResponse.ok) {
          // If network error, queue the order
          if (!navigator.onLine || createOrderResponse.status === 0) {
            const queueId = await queueOrder(orderData, "/api/orders");
            
            toast({
              title: "Order Queued",
              description:
                "Your order has been queued and will be processed when you're back online.",
            });
            return {
              order: {
                id: `queued-${queueId}`,
                order_number: `QUEUED-${Date.now()}`,
                status: "QUEUED",
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
                    })
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
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      level: "error",
                      event: "ORDER_CREATION_VALIDATION_ERROR",
                      details: {
                        status: createOrderResponse.status,
                        validationErrors: errorData.details,
                        fullErrorResponse: errorData,
                        payload: JSON.stringify(orderData, null, 2),
                      },
                    }),
                  }).catch(() => {
                    // Silently handle - error logging failed
                  });
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
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              level: "error",
              event: "ORDER_CREATION_FAILED",
              details: {
                status: createOrderResponse.status,
                statusText: createOrderResponse.statusText,
                errorMessage,
                fullErrorResponse: JSON.stringify(fullErrorResponse, null, 2),
                url: "/api/orders",
                requestPayload: JSON.stringify(orderData, null, 2),
                payloadValidation: {
                  hasVenueId: !!orderData.venue_id,
                  hasCustomerName: !!orderData.customer_name,
                  hasCustomerPhone: !!orderData.customer_phone,
                  hasItems: Array.isArray(orderData.items) && orderData.items.length > 0,
                  hasTotal:
                    typeof orderData.total_amount === "number" && orderData.total_amount > 0,
                  itemsValid: orderData.items.every(
                    (item) =>
                      typeof item.quantity === "number" &&
                      typeof item.price === "number" &&
                      typeof item.item_name === "string"
                  ),
                },
              },
            }),
          }).catch(() => {
            // Silently handle - error logging failed
          });

          // Comprehensive error logging - send to server so it appears in Railway logs
          const errorLogPayload = {
            level: "error",
            event: "ORDER_CREATION_FAILED",
            details: {
              timestamp: new Date().toISOString(),
              status: createOrderResponse.status,
              statusText: createOrderResponse.statusText,
              errorMessage,
              fullErrorResponse,
              url: "/api/orders",
              requestPayload: JSON.stringify(orderData, null, 2),
              payloadValidation: {
                hasVenueId: !!orderData.venue_id,
                hasCustomerName: !!orderData.customer_name,
                hasCustomerPhone: !!orderData.customer_phone,
                hasItems: Array.isArray(orderData.items) && orderData.items.length > 0,
                hasTotal: typeof orderData.total_amount === "number" && orderData.total_amount > 0,
                itemsValid: orderData.items.every(
                  (item) =>
                    typeof item.quantity === "number" &&
                    typeof item.price === "number" &&
                    typeof item.item_name === "string"
                ),
              },
            },
          };

          // Send to server so it appears in Railway logs
          fetch("/api/log-payment-flow", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(errorLogPayload),
          }).catch(() => {
            // Silently handle - error logging failed
          });

          throw new Error(errorMessage);
        }

        const orderResult = await createOrderResponse.json();

        // Log success to server (appears in Railway)
        logToServer("info", "ORDER_CREATION_SUCCESS", {
          orderId: orderResult.order?.id,
          orderNumber: orderResult.order?.order_number,
          status: orderResult.order?.order_status,
          paymentStatus: orderResult.order?.payment_status,
          action,
        });

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
        safeRemoveItem(localStorage, "servio-order-cart");

        // Redirect to order summary page
        window.location.href = `/order-summary?orderId=${orderId}&demo=1`;
      } else if (action === "stripe") {

        let orderId: string;

        // If orderId exists in checkoutData, use existing order instead of creating new one
        if (checkoutData.orderId) {
          orderId = checkoutData.orderId;

          // Update existing order to PAY_NOW (will be set to PAID by webhook after payment)
          const updateResponse = await fetch("/api/orders/payment", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              orderId: checkoutData.orderId,
              venue_id: checkoutData.venueId,
              payment_method: "stripe",
              payment_status: "UNPAID", // Will be updated to PAID by webhook
            }),
          });

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
            amount: checkoutData.total,
            tableNumber: checkoutData.tableNumber,
            customerName: checkoutData.customerName,
            customerPhone: checkoutData.customerPhone,
            orderId: orderId,
            items: checkoutData.cart,
            source: checkoutData.source || "qr",
            venueName: checkoutData.venueName || "Restaurant",
            ...(checkoutData.customerEmail && { customerEmail: checkoutData.customerEmail }),
            venueId: checkoutData.venueId,
            qr_type: checkoutData.qr_type,
          };

          const response = await fetch("/api/checkout", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(checkoutPayload),
          });

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
            safeRemoveItem(localStorage, "servio-order-cart");
            safeRemoveItem(localStorage, "servio-checkout-data");

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
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              order_id: checkoutData.orderId,
              venue_id: checkoutData.venueId,
              sessionId: checkoutData.sessionId,
            }),
          });

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
        safeRemoveItem(localStorage, "servio-order-cart");
        safeRemoveItem(localStorage, "servio-checkout-data");

        // Redirect to order summary with orderId
        window.location.href = `/order-summary?orderId=${orderId}`;
        return;
      } else if (action === "later") {

        let orderId: string;

        // If orderId exists in checkoutData, update existing order instead of creating new one
        if (checkoutData.orderId) {
          // Update existing order to PAY_LATER
          const updateResponse = await fetch("/api/pay/later", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              order_id: checkoutData.orderId,
              venue_id: checkoutData.venueId,
              sessionId: checkoutData.sessionId,
            }),
          });

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

        // Store session for QR re-scan logic
        const sessionId = checkoutData.sessionId || `session_${Date.now()}`;
        safeSetItem(localStorage, "servio-current-session", sessionId);
        safeSetItem(
          localStorage,
          `servio-order-${sessionId}`,
          JSON.stringify({
            orderId,
            venueId: checkoutData.venueId,
            tableNumber: checkoutData.tableNumber,
            total: checkoutData.total,
          })
        );

        // Clear cart
        safeRemoveItem(localStorage, "servio-order-cart");
        safeRemoveItem(localStorage, "servio-checkout-data");

        // Redirect to order summary with orderId
        window.location.href = `/order-summary?orderId=${orderId}`;
        return;
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

      // Ensure we set a string, never an object
      setError(cleanedErrorMessage);

      // Ensure toast description is always a string
      const toastDescription =
        typeof cleanedErrorMessage === "string"
          ? cleanedErrorMessage
          : "An unexpected error occurred. Please try again.";

      toast({
        title: "Payment Error",
        description: toastDescription,
        variant: "destructive",
      });
    } finally {

      setIsProcessing(false);
    }
  };

  return { processPayment };
}
