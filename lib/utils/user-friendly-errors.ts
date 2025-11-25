/**
 * User-Friendly Error Messages
 * Provides clear, actionable error messages for users
 */

export interface UserFriendlyError {
  message: string;
  action?: string;
  code?: string;
}

/**
 * Convert technical errors to user-friendly messages
 */
export function getUserFriendlyError(error: unknown, context?: string): UserFriendlyError {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const lowerMessage = errorMessage.toLowerCase();

  // Payment errors
  if (lowerMessage.includes("payment") || lowerMessage.includes("paid")) {
    if (lowerMessage.includes("unpaid") || lowerMessage.includes("not paid")) {
      return {
        message: "This order hasn't been paid yet. Please collect payment before completing the order.",
        action: "Collect payment first",
        code: "UNPAID_ORDER",
      };
    }
    if (lowerMessage.includes("payment failed") || lowerMessage.includes("payment error")) {
      return {
        message: "Payment processing failed. Please try again or use a different payment method.",
        action: "Retry payment",
        code: "PAYMENT_FAILED",
      };
    }
  }

  // Order status errors
  if (lowerMessage.includes("order status") || lowerMessage.includes("status")) {
    if (lowerMessage.includes("cannot complete")) {
      return {
        message: "This order cannot be completed in its current state. Please check the order status.",
        action: "Check order status",
        code: "INVALID_ORDER_STATUS",
      };
    }
  }

  // Authentication errors
  if (lowerMessage.includes("unauthorized") || lowerMessage.includes("not authenticated")) {
    return {
      message: "You need to sign in to perform this action.",
      action: "Sign in",
      code: "UNAUTHORIZED",
    };
  }

  if (lowerMessage.includes("forbidden") || lowerMessage.includes("access denied")) {
    return {
      message: "You don't have permission to perform this action.",
      action: "Contact your manager",
      code: "FORBIDDEN",
    };
  }

  // Network errors
  if (
    lowerMessage.includes("network") ||
    lowerMessage.includes("fetch") ||
    lowerMessage.includes("connection")
  ) {
    return {
      message: "Connection problem. Please check your internet connection and try again.",
      action: "Check connection and retry",
      code: "NETWORK_ERROR",
    };
  }

  // Database errors
  if (lowerMessage.includes("database") || lowerMessage.includes("query")) {
    return {
      message: "A system error occurred. Our team has been notified.",
      action: "Try again in a moment",
      code: "DATABASE_ERROR",
    };
  }

  // Validation errors
  if (lowerMessage.includes("required") || lowerMessage.includes("invalid")) {
    return {
      message: "Please check that all required fields are filled correctly.",
      action: "Review form fields",
      code: "VALIDATION_ERROR",
    };
  }

  // Not found errors
  if (lowerMessage.includes("not found") || lowerMessage.includes("does not exist")) {
    return {
      message: "The requested item could not be found.",
      action: "Refresh the page",
      code: "NOT_FOUND",
    };
  }

  // Default: return original message but make it more user-friendly
  return {
    message: context || errorMessage || "Something went wrong. Please try again.",
    action: "Try again",
    code: "UNKNOWN_ERROR",
  };
}

/**
 * Create an error response for API routes
 */
export function createUserFriendlyErrorResponse(
  error: unknown,
  context?: string
): { error: string; action?: string; code?: string } {
  const friendlyError = getUserFriendlyError(error, context);
  return {
    error: friendlyError.message,
    ...(friendlyError.action && { action: friendlyError.action }),
    ...(friendlyError.code && { code: friendlyError.code }),
  };
}

