/**
 * User-Friendly Error Messages
 * Provides clear, actionable error messages for users
 */

export interface UserFriendlyError {

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

      };
    }
    if (lowerMessage.includes("payment failed") || lowerMessage.includes("payment error")) {
      return {

      };
    }
  }

  // Order status errors
  if (lowerMessage.includes("order status") || lowerMessage.includes("status")) {
    if (lowerMessage.includes("cannot complete")) {
      return {

      };
    }
  }

  // Authentication errors
  if (lowerMessage.includes("unauthorized") || lowerMessage.includes("not authenticated")) {
    return {

    };
  }

  if (lowerMessage.includes("forbidden") || lowerMessage.includes("access denied")) {
    return {

    };
  }

  // Network errors
  if (
    lowerMessage.includes("network") ||
    lowerMessage.includes("fetch") ||
    lowerMessage.includes("connection")
  ) {
    return {

    };
  }

  // Database errors
  if (lowerMessage.includes("database") || lowerMessage.includes("query")) {
    return {

    };
  }

  // Validation errors
  if (lowerMessage.includes("required") || lowerMessage.includes("invalid")) {
    return {

    };
  }

  // Not found errors
  if (lowerMessage.includes("not found") || lowerMessage.includes("does not exist")) {
    return {

    };
  }

  // Default: return original message but make it more user-friendly
  return {

  };
}

/**
 * Create an error response for API routes
 */
export function createUserFriendlyErrorResponse(

  context?: string
): { error: string; action?: string; code?: string } {
  const friendlyError = getUserFriendlyError(error, context);
  return {

    ...(friendlyError.action && { action: friendlyError.action }),
    ...(friendlyError.code && { code: friendlyError.code }),
  };
}
