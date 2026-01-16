import { useState } from "react";
import { CartItem, CustomerInfo } from "../types";
import { safeSetItem } from "../utils/safeStorage";

interface OrderSubmissionParams {
  cart: CartItem[];
  customerInfo: CustomerInfo;
  venueSlug: string;
  tableNumber: string;
  counterNumber: string;
  orderLocation: string;
  orderType: "counter" | "table" | "table_pickup";
  isCounterOrder: boolean;
  isDemo: boolean;
  isDemoFallback: boolean;
}

export function useOrderSubmission() {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submitOrder = async (params: OrderSubmissionParams) => {
    const {
      cart,
      customerInfo,
      venueSlug,
      tableNumber,
      counterNumber,
      orderLocation,
      orderType,
      isCounterOrder,
      isDemo,
      isDemoFallback,
    } = params;

    // Validate order data
    // Skip customer info validation for demo orders
    if (!isDemo && !isDemoFallback) {
      if (!customerInfo.name.trim()) {
        alert("Please enter your name before placing the order.");
        return;
      }

      if (!customerInfo.phone.trim()) {
        alert("Please enter your phone number before placing the order.");
        return;
      }
    }

    if (cart.length === 0) {
      alert("Your cart is empty. Please add items before placing the order.");
      return;
    }

    if (!venueSlug) {
      alert("Invalid venue. Please check your QR code and try again.");
      return;
    }

    setIsSubmitting(true);

    try {
      const safeTable = isCounterOrder ? parseInt(counterNumber) || 1 : parseInt(tableNumber) || 1;
      // Counter orders: Customer can choose payment method (Pay Now for QR pickup, Pay at Till for till orders)
      // Default to online so customer can pay via QR code (like McDonald's/Tim Hortons pickup)
      const paymentMode = isCounterOrder ? "online" : "online";

      // For demo orders - skip customer info and go straight to order summary
      if (isDemo || isDemoFallback) {
        const orderData = {
          venueId: venueSlug,
          venueName: "Demo Café",
          tableNumber: parseInt(orderLocation) || 1,
          counterNumber: counterNumber,
          orderType: orderType,
          orderLocation: orderLocation,
          customerName: "Demo Customer", // Default name for demo
          customerPhone: "00000000000", // Default phone for demo
          cart: cart.map((item) => ({
            id: item.id && item.id.startsWith("demo-") ? null : item.id,
            name: item.name,
            price: item.price,
            quantity: item.quantity,
            specialInstructions: item.specialInstructions || null,
            image: (item as { image?: unknown }).image || null,
          })),
          total: cart.reduce((total, item) => total + item.price * item.quantity, 0),
          notes: cart
            .filter((item) => item.specialInstructions)
            .map((item) => `${item.name}: ${item.specialInstructions}`)
            .join("; "),
          isDemo: true,
        };

        safeSetItem(localStorage, "servio-pending-order", JSON.stringify(orderData));
        setIsSubmitting(false);

        if (typeof window !== "undefined") {
          window.location.href = "/order-summary";
        }
        return;
      }

      // For real orders
      // DON'T create order yet - just save to localStorage and go to payment
      const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      safeSetItem(localStorage, "servio-current-session", sessionId);

      // For table_pickup orders, we want to flag them as requiring collection
      const requiresCollection = orderType === "table_pickup" || orderType === "counter";
      const qrType =
        orderType === "counter"
          ? "COUNTER"
          : orderType === "table_pickup"
            ? "TABLE_COLLECTION"
            : "TABLE_FULL_SERVICE";

      const checkoutData = {
        venueId: venueSlug,
        venueName: "Restaurant",
        tableNumber: parseInt(orderLocation) || 1,
        counterNumber: counterNumber,
        counterLabel: counterNumber ? `Counter ${counterNumber}` : null, // New: counter label
        orderType: orderType,
        orderLocation: orderLocation,
        qr_type: qrType,
        customerName: customerInfo.name.trim(),
        customerPhone: customerInfo.phone.trim(),
        cart: cart.map((item) => ({
          id: item.id && item.id.startsWith("demo-") ? null : item.id,
          name: item.name,
          price: item.price + (item.modifierPrice || 0),
          quantity: item.quantity,
          specialInstructions: item.specialInstructions || null,
          image: (item as { image?: string | null }).image || null,
          modifiers: item.selectedModifiers || null,
          modifierPrice: item.modifierPrice || 0,
        })),
        total: cart.reduce((total, item) => {
          const itemPrice = item.price + (item.modifierPrice || 0);
          return total + itemPrice * item.quantity;
        }, 0),
        notes: cart
          .filter((item) => item.specialInstructions)
          .map((item) => `${item.name}: ${item.specialInstructions}`)
          .join("; "),
        sessionId: sessionId,
        isDemo: isDemo,
        paymentMode: paymentMode,
        source: orderType === "counter" ? "counter" : "qr",
        requiresCollection, // Flag for collection notification
      };

      // Comprehensive logging for order submission - send to server
      const submissionLog = {
        level: "info",
        event: "ORDER_SUBMITTED",
        details: {
          timestamp: new Date().toISOString(),
          venueId: venueSlug,
          tableNumber: orderLocation,
          customerName: customerInfo.name,
          customerPhone: customerInfo.phone,
          cartItemCount: cart.length,
          total: checkoutData.total,
          sessionId: sessionId,
          orderType: orderType,
          checkoutData: {
            venueId: checkoutData.venueId,
            tableNumber: checkoutData.tableNumber,
            cart: checkoutData.cart.map((item) => ({
              id: item.id,
              name: item.name,
              price: item.price,
              quantity: item.quantity,
            })),
            total: checkoutData.total,
          },
        },
      };

      // Send to server so it appears in Railway logs
      fetch("/api/log-payment-flow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(submissionLog),
      }).catch(() => {
        // Silently handle - error logging failed
      });

      // Also log to browser console

      safeSetItem(localStorage, "servio-checkout-data", JSON.stringify(checkoutData));

      // Instant redirect to payment method selection page
      // Order will be created AFTER payment method is selected
      window.location.href = "/payment";
    } catch (_error) {
      let errorMessage = "Failed to place order. Please try again.";

      if (_error instanceof Error) {
        if (_error.message.includes("venue_id is required")) {
          errorMessage = "Invalid venue. Please check your QR code and try again.";
        } else if (_error.message.includes("customer_name is required")) {
          errorMessage = "Please enter your name before placing the order.";
        } else if (_error.message.includes("customer_phone is required")) {
          errorMessage = "Please enter your phone number before placing the order.";
        } else if (_error.message.includes("items must be a non-empty array")) {
          errorMessage = "Your cart is empty. Please add items before placing the order.";
        } else if (_error.message.includes("total_amount must be a number")) {
          errorMessage = "Invalid order total. Please try again.";
        } else if (_error.message.includes("Failed to create order")) {
          errorMessage = "Unable to create order. Please check your connection and try again.";
        } else if (_error.message.includes("Failed to verify venue")) {
          errorMessage = "Invalid venue. Please check your QR code and try again.";
        } else {
          errorMessage = `Order failed: ${_error.message}`;
        }
      }

      alert(errorMessage);
      setIsSubmitting(false);
    }
  };

  return {
    isSubmitting,
    submitOrder,
  };
}
