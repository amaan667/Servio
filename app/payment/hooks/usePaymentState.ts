import { logger } from "@/lib/logger";
import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export interface CheckoutData {
  venueId: string;
  venueName?: string;
  tableNumber: number;
  cart: Array<{
    id: string;
    name: string;
    price: number;
    quantity: number;
    specialInstructions?: string;
  }>;
  total: number;
  tableId?: string | null;
  sessionId?: string | null;
  orderId?: string;
  orderNumber?: string;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  orderType?: string;
  isDemo?: boolean;
  isSplit?: boolean;
}

export type PaymentAction = "demo" | "stripe" | "till" | "later";

export function usePaymentState() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [checkoutData, setCheckoutData] = useState<CheckoutData | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentComplete, setPaymentComplete] = useState(false);
  const [orderNumber, setOrderNumber] = useState("");
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Safe setter that ensures error is always a string
  const setErrorSafe = (errorValue: string | null | unknown) => {
    if (errorValue === null || errorValue === undefined) {
      setError(null);
      return;
    }

    let safeError: string;
    if (typeof errorValue === "string") {
      safeError = errorValue;
    } else if (errorValue instanceof Error) {
      safeError = errorValue.message || "An unexpected error occurred";
    } else if (typeof errorValue === "object") {
      // Try to extract a message from the object
      const errObj = errorValue as Record<string, unknown>;
      if (errObj.message && typeof errObj.message === "string") {
        safeError = errObj.message;
      } else if (errObj.error && typeof errObj.error === "string") {
        safeError = errObj.error;
      } else {
        // Last resort: stringify, but check for [object Object]
        const stringified = JSON.stringify(errorValue);
        if (stringified.includes("[object Object]")) {
          safeError = "An unexpected error occurred. Please try again.";
        } else {
          safeError =
            stringified.length > 200 ? stringified.substring(0, 200) + "..." : stringified;
        }
      }
    } else {
      safeError = String(errorValue);
    }

    // Final check: remove any [object Object] strings
    safeError = safeError.replace(/\[object\s+Object\]/gi, "An unexpected error occurred");

    setError(safeError);
  };
  const [paymentAction, setPaymentAction] = useState<PaymentAction | null>(null);
  const [isDemo, setIsDemo] = useState(false);
  const [receiptEmail, setReceiptEmail] = useState("");

  const isDemoFromUrl = searchParams?.get("demo") === "1";

  useEffect(() => {
    const storedData = localStorage.getItem("servio-checkout-data");

    if (storedData) {
      try {
        const data = JSON.parse(storedData);

        setCheckoutData(data);
        setIsDemo(data.isDemo || false);
        setReceiptEmail(data.customerEmail || "");

        if (data.isDemo || isDemoFromUrl) {
          // Empty block
        }
      } catch (_error) {
        // Don't redirect - payment processing will handle redirect to order summary
        logger.error("[PAYMENT STATE] Failed to parse checkout data", _error);
      }
    } else {
      // Don't redirect if no checkout data - payment flow will handle it
      // This prevents race condition where redirect to order summary is interrupted
      logger.warn("[PAYMENT STATE] No checkout data found - waiting for payment flow");
    }
  }, [router, isDemoFromUrl]);

  return {
    checkoutData,
    setCheckoutData,
    isProcessing,
    setIsProcessing,
    paymentComplete,
    setPaymentComplete,
    orderNumber,
    setOrderNumber,
    showFeedback,
    setShowFeedback,
    feedbackSubmitted,
    setFeedbackSubmitted,
    error,
    setError: setErrorSafe,
    paymentAction,
    setPaymentAction,
    isDemo,
    setIsDemo,
    receiptEmail,
    setReceiptEmail,
    isDemoFromUrl,
  };
}
