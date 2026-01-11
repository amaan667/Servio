import { useState } from "react";
import { CartItem, CustomerInfo } from "../types";

interface OrderSubmissionParams {

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

          customerName: "Demo Customer", // Default name for demo
          customerPhone: "00000000000", // Default phone for demo

            image: (item as { image?: unknown }).image || null,
          })),
          total: cart.reduce((total, item) => total + item.price * item.quantity, 0),

            .map((item) => `${item.name}: ${item.specialInstructions}`)
            .join("; "),

        };

        localStorage.setItem("servio-pending-order", JSON.stringify(orderData));
        setIsSubmitting(false);

        if (typeof window !== "undefined") {
          window.location.href = "/order-summary";
        }
        return;
      }

      // For real orders
      // DON'T create order yet - just save to localStorage and go to payment
      const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem("servio-current-session", sessionId);

      const checkoutData = {

        counterLabel: counterNumber ? `Counter ${counterNumber}` : null, // New: counter label

          image: (item as { image?: string | null }).image || null,

        })),
        total: cart.reduce((total, item) => {
          const itemPrice = item.price + (item.modifierPrice || 0);
          return total + itemPrice * item.quantity;
        }, 0),

          .map((item) => `${item.name}: ${item.specialInstructions}`)
          .join("; "),

      };

      // Comprehensive logging for order submission - send to server
      const submissionLog = {

            })),

          },
        },
      };

      // Send to server so it appears in Railway logs
      fetch("/api/log-payment-flow", {

        headers: { "Content-Type": "application/json" },

      }).catch(() => {
        // Silently handle - error logging failed

      // Also log to browser console

      localStorage.setItem("servio-checkout-data", JSON.stringify(checkoutData));

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
