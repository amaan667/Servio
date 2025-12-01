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

// Helper function to log to server (appears in Railway logs)
const logToServer = async (level: "info" | "warn" | "error", event: string, data: Record<string, unknown>) => {
  try {
    await fetch("/api/log-payment-flow", {
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
  } catch {
    // Silently fail - logging shouldn't break the flow
  }
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
    // Log to server (appears in Railway)
    await logToServer("info", "PAYMENT_METHOD_SELECTED", {
      action,
      venueId: checkoutData.venueId,
      tableNumber: checkoutData.tableNumber,
      customerName: checkoutData.customerName,
      customerPhone: checkoutData.customerPhone,
      total: checkoutData.total,
      cartItemCount: checkoutData.cart?.length || 0,
    });

    logger.info("🎯 [PAYMENT PROCESSING] ===== PAYMENT METHOD SELECTED =====", {
      action,
      timestamp: new Date().toISOString(),
      checkoutData: {
        venueId: checkoutData.venueId,
        tableNumber: checkoutData.tableNumber,
        customerName: checkoutData.customerName,
        customerPhone: checkoutData.customerPhone,
        total: checkoutData.total,
        cartItemCount: checkoutData.cart?.length || 0,
        source: checkoutData.source,
      },
    });

    setIsProcessing(true);
    setError(null);

    try {
      // Helper function to create order in database (with offline support)
      const createOrder = async () => {
        logger.info("📦 [PAYMENT PROCESSING] Creating order...", {
          action,
          venueId: checkoutData.venueId,
          tableNumber: checkoutData.tableNumber,
          customerName: checkoutData.customerName,
          itemCount: checkoutData.cart.length,
          total: checkoutData.total,
        });

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
          items: OrderItemPayload[];
          total_amount: number;
          notes: string | null;
          order_status: string;
          payment_status: string;
          payment_mode: string;
          payment_method: string | null;
          is_active: boolean;
        }
        
        const orderData: OrderPayload = {
          venue_id: checkoutData.venueId,
          customer_name: checkoutData.customerName?.trim() || "",
          customer_phone: checkoutData.customerPhone?.trim() || "",
          customer_email: checkoutData.customerEmail?.trim() || null,
          table_number: checkoutData.tableNumber ? String(checkoutData.tableNumber) : null,
          table_id: null,
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
          order_status: "PLACED", // Start as PLACED so it shows in Live Orders immediately
          payment_status: action === "stripe" ? "UNPAID" : "UNPAID", // All start as UNPAID, Stripe webhook will update
          payment_mode: action === "till" ? "pay_at_till" : action === "later" ? "pay_later" : "online",
          payment_method: action === "demo" ? "demo" : action === "till" ? "till" : null,
          // Note: source field is handled by the API route based on table_number
          is_active: true,
        };

        // Log to server (appears in Railway) - FULL PAYLOAD
        await logToServer("info", "ORDER_DATA_PREPARED", {
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
        
        logger.info("📤 [PAYMENT PROCESSING] Order data prepared:", {
          venue_id: orderData.venue_id,
          table_number: orderData.table_number,
          customer_name: orderData.customer_name,
          items_count: orderData.items.length,
          items: orderData.items.map((item, idx) => ({
            index: idx,
            menu_item_id: item.menu_item_id,
            item_name: item.item_name,
            quantity: item.quantity,
            price: item.price,
          })),
          total_amount: orderData.total_amount,
          order_status: orderData.order_status,
          payment_status: orderData.payment_status,
          payment_mode: orderData.payment_mode,
          payment_method: orderData.payment_method,
        });

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
              is_active: orderData.is_active,
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

        // Also log to browser console for debugging
        console.log("📤 [PAYMENT PROCESSING] ===== SENDING ORDER CREATION REQUEST =====", logPayload.details);

        logger.info("🌐 [PAYMENT PROCESSING] Sending order creation request...", {
          url: "/api/orders",
          method: "POST",
          online: navigator.onLine,
          payloadSize: JSON.stringify(orderData).length,
          itemsCount: orderData.items.length,
        });

        const createOrderResponse = await fetch("/api/orders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(orderData),
        });

        logger.info("📥 [PAYMENT PROCESSING] Order creation response received:", {
          status: createOrderResponse.status,
          statusText: createOrderResponse.statusText,
          ok: createOrderResponse.ok,
          headers: Object.fromEntries(createOrderResponse.headers.entries()),
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

          // Extract error message from response - LOG THE FULL ERROR FIRST
          let errorMessage = `Failed to create order (${createOrderResponse.status})`;
          let fullErrorResponse: unknown = null;
          
          try {
            const responseText = await createOrderResponse.text();
            console.error("❌ [PAYMENT PROCESSING] Full error response text:", responseText);
            
            if (responseText) {
              try {
                const errorData = JSON.parse(responseText);
                fullErrorResponse = errorData;
                console.error("❌ [PAYMENT PROCESSING] Parsed error response:", JSON.stringify(errorData, null, 2));
                
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
                  errorMessage = messages.length > 0 ? `Validation error: ${messages.join("; ")}` : errorMessage;
                } else if (typeof errorData === "string") {
                  errorMessage = errorData;
                }
                
                // Log validation errors in detail - SEND TO SERVER FOR RAILWAY LOGS
                if (errorData.details && Array.isArray(errorData.details)) {
                  console.error("❌ [PAYMENT PROCESSING] Validation errors:", errorData.details);
                  logger.error("[PAYMENT] ❌ Validation error details:", {
                    details: errorData.details,
                    fullError: errorData,
                  });
                  
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
                console.error("❌ [PAYMENT PROCESSING] Error response is not JSON:", responseText);
                errorMessage = responseText.length > 200 ? responseText.substring(0, 200) + "..." : responseText;
              }
            }
          } catch (textError) {
            logger.error("[PAYMENT] ❌ Error parsing order creation error:", textError);
            console.error("❌ [PAYMENT PROCESSING] Failed to read error response:", textError);
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
                  hasTotal: typeof orderData.total_amount === "number" && orderData.total_amount > 0,
                  itemsValid: orderData.items.every((item) => 
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
                itemsValid: orderData.items.every((item) => 
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

          // Also log to browser console for debugging
          console.error("❌ [PAYMENT PROCESSING] ===== ORDER CREATION FAILED =====", errorLogPayload.details);
          
          logger.error("[PAYMENT] ❌ Order creation failed:", {
            status: createOrderResponse.status,
            statusText: createOrderResponse.statusText,
            errorMessage,
            fullErrorResponse,
            url: "/api/orders",
            orderData: JSON.stringify(orderData, null, 2),
          });
          
          console.error("❌ [PAYMENT PROCESSING] Order creation failed with:", {
            status: createOrderResponse.status,
            errorMessage,
            fullError: fullErrorResponse,
          });
          
          throw new Error(errorMessage);
        }

        logger.info("✅ [PAYMENT PROCESSING] Order creation successful, parsing response...");
        const orderResult = await createOrderResponse.json();
        
        // Log success to server (appears in Railway)
        await logToServer("info", "ORDER_CREATION_SUCCESS", {
          orderId: orderResult.order?.id,
          orderNumber: orderResult.order?.order_number,
          status: orderResult.order?.order_status,
          paymentStatus: orderResult.order?.payment_status,
          action,
        });
        
        logger.info("📋 [PAYMENT PROCESSING] Order created:", {
          orderId: orderResult.order?.id,
          orderNumber: orderResult.order?.order_number,
          status: orderResult.order?.order_status,
          paymentStatus: orderResult.order?.payment_status,
        });
        
        return orderResult;
      };

      // Process payment based on selected method
      logger.info("🔄 [PAYMENT PROCESSING] Processing payment method:", { action });

      if (action === "demo") {
        logger.info("🎮 [PAYMENT PROCESSING] Processing DEMO payment...");
        // Create order immediately for demo
        const orderResult = await createOrder();
        const orderId = orderResult.order?.id;
        
        logger.info("🎮 [PAYMENT PROCESSING] Demo order created:", { orderId });
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
        logger.info("💳 [PAYMENT PROCESSING] Processing STRIPE payment...");
        // Stripe payment - CREATE ORDER FIRST, then redirect to Stripe

        // Create order first with UNPAID status
        const orderResult = await createOrder();
        const orderId = orderResult.order?.id;

        logger.info("💳 [PAYMENT PROCESSING] Order created for Stripe:", { orderId });

        if (!orderId) {
          logger.error("💳 [PAYMENT PROCESSING] ❌ No order ID returned from order creation");
          throw new Error("Failed to create order before Stripe checkout");
        }

        // Create Stripe checkout session with just the order ID
        logger.info("💳 [PAYMENT PROCESSING] Creating Stripe checkout session...", {
          orderId,
          amount: checkoutData.total,
          customerEmail: checkoutData.customerEmail || "(not provided)",
          customerName: checkoutData.customerName,
        });

        let result;
        try {
          const checkoutPayload = {
            amount: checkoutData.total,
            customerEmail: checkoutData.customerEmail || "",
            customerName: checkoutData.customerName,
            venueName: checkoutData.venueName || "Restaurant",
            orderId: orderId, // Just pass order ID (small!)
          };

          logger.info("💳 [PAYMENT PROCESSING] Sending Stripe checkout request:", {
            url: "/api/stripe/create-customer-checkout",
            payload: checkoutPayload,
          });

          const response = await fetch("/api/stripe/create-customer-checkout", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(checkoutPayload),
          });

          logger.info("💳 [PAYMENT PROCESSING] Stripe checkout response:", {
            status: response.status,
            statusText: response.statusText,
            ok: response.ok,
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
            logger.info("💳 [PAYMENT PROCESSING] ✅ Stripe checkout URL received, redirecting...", {
              url: checkoutUrl,
              sessionId: result?.data?.sessionId || result?.sessionId,
            });
            window.location.href = checkoutUrl;
            return; // Exit early on redirect
          } else {
            logger.error("💳 [PAYMENT PROCESSING] ❌ No checkout URL in response:", { result });
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
        logger.info("🧾 [PAYMENT PROCESSING] Processing PAY AT TILL payment...");
        // Till payment - create order immediately, show "Order Confirmed!"
        const orderResult = await createOrder();
        const orderId = orderResult.order?.id;

        logger.info("🧾 [PAYMENT PROCESSING] Order created for till payment:", { orderId });

        const tillPayload = {
          order_id: orderId,
          venue_id: checkoutData.venueId,
          tableNumber: checkoutData.tableNumber,
          customerName: checkoutData.customerName,
          customerPhone: checkoutData.customerPhone,
        };

        logger.info("🧾 [PAYMENT PROCESSING] Sending till payment confirmation...", {
          url: "/api/pay/till",
          payload: tillPayload,
        });

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

          logger.info("🧾 [PAYMENT PROCESSING] Till payment response:", {
            status: response.status,
            statusText: response.statusText,
            ok: response.ok,
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
            logger.info("🧾 [PAYMENT PROCESSING] ✅ Till payment confirmed:", { result });
          }
        }

        // Clear cart after successful order (keep checkout-data for order summary page)
        logger.info("🧾 [PAYMENT PROCESSING] Clearing cart and redirecting to order summary...", { orderId });
        localStorage.removeItem("servio-order-cart");

        // Redirect to order summary page
        window.location.href = `/order-summary?orderId=${orderId}`;
      } else if (action === "later") {
        logger.info("⏰ [PAYMENT PROCESSING] Processing PAY LATER payment...");
        // Pay later - create order immediately, show "Order Confirmed!"
        const orderResult = await createOrder();
        const orderId = orderResult.order?.id;

        logger.info("⏰ [PAYMENT PROCESSING] Order created for pay later:", { orderId });

        const laterPayload = {
          order_id: orderId,
          venue_id: checkoutData.venueId,
          tableNumber: checkoutData.tableNumber,
          customerName: checkoutData.customerName,
          customerPhone: checkoutData.customerPhone,
          sessionId: checkoutData.sessionId || `session_${Date.now()}`,
        };

        logger.info("⏰ [PAYMENT PROCESSING] Sending pay later confirmation...", {
          url: "/api/pay/later",
          payload: laterPayload,
        });

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

          logger.info("⏰ [PAYMENT PROCESSING] Pay later response:", {
            status: response.status,
            statusText: response.statusText,
            ok: response.ok,
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
            logger.info("⏰ [PAYMENT PROCESSING] ✅ Pay later confirmed:", { result });
          }
        }

        // Store session for re-scanning
        const sessionId = checkoutData.sessionId || `session_${Date.now()}`;
        logger.info("⏰ [PAYMENT PROCESSING] Storing session for QR re-scan...", { sessionId });
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
        logger.info("⏰ [PAYMENT PROCESSING] Clearing cart and redirecting to order summary...", { orderId });
        localStorage.removeItem("servio-order-cart");

        // Redirect to order summary page
        window.location.href = `/order-summary?orderId=${orderId}`;
      }

      logger.info("✅ [PAYMENT PROCESSING] Payment processing completed successfully", {
        action,
        timestamp: new Date().toISOString(),
      });
    } catch (_err) {
      logger.error("❌ [PAYMENT PROCESSING] ===== ERROR CAUGHT =====", {
        action,
        error: _err instanceof Error ? _err.message : String(_err),
        errorType: _err instanceof Error ? _err.constructor.name : typeof _err,
        errorStack: _err instanceof Error ? _err.stack : undefined,
        timestamp: new Date().toISOString(),
      });

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

      // CRITICAL: Ensure errorMessage is always a string
      if (typeof errorMessage !== "string") {
        console.error("⚠️ [PAYMENT PROCESSING] Error message is not a string!", {
          type: typeof errorMessage,
          value: errorMessage,
          error: _err,
        });
        errorMessage = "An unexpected error occurred. Please try again.";
      }

      // Final safety check - ensure it's a valid string
      const safeErrorMessage = String(errorMessage || "An unexpected error occurred. Please try again.").trim();
      
      // Remove any "[object Object]" strings that might have slipped through
      const cleanedErrorMessage = safeErrorMessage.replace(/\[object\s+Object\]/gi, "An unexpected error occurred");
      
      logger.error("❌ [PAYMENT PROCESSING] Final error details:", {
        originalError: _err instanceof Error ? _err.message : String(_err),
        extractedMessage: errorMessage,
        safeErrorMessage: cleanedErrorMessage,
        action,
      });

      console.error("❌ [PAYMENT PROCESSING] Payment Error (console):", {
        action,
        error: _err instanceof Error ? _err.message : String(_err),
        cleanedMessage: cleanedErrorMessage,
        timestamp: new Date().toISOString(),
      });
      
      logger.info("❌ [PAYMENT PROCESSING] ===== ERROR HANDLING COMPLETE =====", {
        errorMessage: cleanedErrorMessage,
        timestamp: new Date().toISOString(),
      });

      // Ensure we set a string, never an object
      setError(cleanedErrorMessage);
      
      // Ensure toast description is always a string
      const toastDescription = typeof cleanedErrorMessage === "string" 
        ? cleanedErrorMessage 
        : "An unexpected error occurred. Please try again.";
      
      toast({
        title: "Payment Error",
        description: toastDescription,
        variant: "destructive",
      });
    } finally {
      logger.info("🏁 [PAYMENT PROCESSING] ===== PAYMENT PROCESSING FINISHED =====", {
        action,
        timestamp: new Date().toISOString(),
      });
      setIsProcessing(false);
    }
  };

  return { processPayment };
}
