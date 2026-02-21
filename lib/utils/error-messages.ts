/**
 * @fileoverview User-Friendly Error Messages
 * Provides actionable, user-friendly error messages for common scenarios
 */

export interface ErrorContext {
  field?: string;
  value?: unknown;
  constraint?: string;
}

/**
 * User-friendly error messages
 * Maps technical errors to actionable messages
 */
export const ErrorMessages = {
  // Authentication Errors
  AUTH_REQUIRED: "Please sign in to continue",
  AUTH_INVALID: "Invalid email or password",
  AUTH_EXPIRED: "Your session has expired. Please sign in again",
  AUTH_TOKEN_INVALID: "Authentication failed. Please try signing in again",

  // Authorization Errors
  FORBIDDEN: "You don't have permission to perform this action",
  FORBIDDEN_VENUE: "You don't have access to this venue",
  FORBIDDEN_ROLE: "This action requires a higher permission level",
  FORBIDDEN_TIER: "This feature is not available on your current plan",

  // Validation Errors
  VALIDATION_REQUIRED: (field: string) => `${field} is required`,
  VALIDATION_INVALID_EMAIL: "Please enter a valid email address",
  VALIDATION_INVALID_PHONE: "Please enter a valid phone number",
  VALIDATION_INVALID_URL: "Please enter a valid URL",
  VALIDATION_TOO_SHORT: (field: string, min: number) =>
    `${field} must be at least ${min} characters`,
  VALIDATION_TOO_LONG: (field: string, max: number) =>
    `${field} must be no more than ${max} characters`,
  VALIDATION_INVALID_FORMAT: (field: string) => `${field} has an invalid format`,
  VALIDATION_MISMATCH: (field1: string, field2: string) => `${field1} and ${field2} don't match`,

  // Resource Errors
  NOT_FOUND: "The requested resource was not found",
  NOT_FOUND_VENUE: "Venue not found",
  NOT_FOUND_ORDER: "Order not found",
  NOT_FOUND_MENU_ITEM: "Menu item not found",
  NOT_FOUND_TABLE: "Table not found",
  NOT_FOUND_USER: "User not found",

  // Conflict Errors
  CONFLICT_EMAIL_EXISTS: "An account with this email already exists",
  CONFLICT_VENUE_EXISTS: "A venue with this name already exists",
  CONFLICT_TABLE_EXISTS: "A table with this number already exists",
  CONFLICT_DUPLICATE: "This record already exists",

  // Business Logic Errors
  ORDER_CANNOT_CANCEL: "This order cannot be cancelled",
  ORDER_CANNOT_COMPLETE: "This order cannot be completed yet",
  ORDER_ALREADY_PAID: "This order has already been paid",
  ORDER_NOT_PAID: "This order has not been paid yet",
  TABLE_OCCUPIED: "This table is currently occupied",
  TABLE_NOT_AVAILABLE: "This table is not available",
  INSUFFICIENT_STOCK: "Not enough inventory to complete this order",
  PAYMENT_FAILED: "Payment failed. Please try again or use a different payment method",
  PAYMENT_CANCELLED: "Payment was cancelled",
  STRIPE_ERROR: "Payment processing error. Please try again",

  // Rate Limiting
  RATE_LIMIT_EXCEEDED: (retryAfter: number) =>
    `Too many requests. Please wait ${retryAfter} seconds before trying again`,
  RATE_LIMIT_AUTH: "Too many login attempts. Please wait a few minutes",
  RATE_LIMIT_API: "You've made too many requests. Please slow down",

  // Network Errors
  NETWORK_ERROR: "Network error. Please check your connection and try again",
  NETWORK_TIMEOUT: "Request timed out. Please try again",
  OFFLINE: "You appear to be offline. Please check your internet connection",

  // Server Errors
  SERVER_ERROR: "Something went wrong on our end. Please try again",
  SERVER_UNAVAILABLE: "Service is temporarily unavailable. Please try again later",
  DATABASE_ERROR: "Database error. Please try again",
  MAINTENANCE: "We're performing maintenance. Please check back soon",

  // File Upload Errors
  FILE_TOO_LARGE: (maxSize: string) => `File is too large. Maximum size is ${maxSize}`,
  FILE_INVALID_TYPE: "Invalid file type. Please upload a valid file",
  FILE_UPLOAD_FAILED: "Failed to upload file. Please try again",

  // Feature Errors
  FEATURE_NOT_AVAILABLE: "This feature is not available",
  FEATURE_DISABLED: "This feature is currently disabled",
  FEATURE_LIMIT_REACHED: (feature: string, limit: number) =>
    `You've reached the limit of ${limit} ${feature}. Please upgrade your plan.`,

  // Generic Errors
  UNKNOWN_ERROR: "An unexpected error occurred. Please try again",
  TRY_AGAIN: "Please try again",
  CONTACT_SUPPORT: "If this problem persists, please contact support",
};

/**
 * Get user-friendly error message with context
 */
export function getUserFriendlyError(error: Error | string, context?: ErrorContext): string {
  const errorMessage = typeof error === "string" ? error : error.message;

  // Map common error patterns to friendly messages
  if (errorMessage.includes("auth") || errorMessage.includes("unauthorized")) {
    return ErrorMessages.AUTH_REQUIRED;
  }

  if (errorMessage.includes("forbidden")) {
    if (context?.constraint?.includes("tier")) {
      return ErrorMessages.FORBIDDEN_TIER;
    }
    if (context?.constraint?.includes("role")) {
      return ErrorMessages.FORBIDDEN_ROLE;
    }
    return ErrorMessages.FORBIDDEN;
  }

  if (errorMessage.includes("not found")) {
    if (context?.field?.includes("venue")) {
      return ErrorMessages.NOT_FOUND_VENUE;
    }
    if (context?.field?.includes("order")) {
      return ErrorMessages.NOT_FOUND_ORDER;
    }
    if (context?.field?.includes("table")) {
      return ErrorMessages.NOT_FOUND_TABLE;
    }
    return ErrorMessages.NOT_FOUND;
  }

  if (errorMessage.includes("duplicate") || errorMessage.includes("unique")) {
    if (context?.field?.includes("email")) {
      return ErrorMessages.CONFLICT_EMAIL_EXISTS;
    }
    return ErrorMessages.CONFLICT_DUPLICATE;
  }

  if (errorMessage.includes("validation")) {
    if (context?.field) {
      return ErrorMessages.VALIDATION_INVALID_FORMAT(context.field);
    }
    return "Invalid input. Please check your data and try again";
  }

  if (errorMessage.includes("rate limit")) {
    const retryAfter = context?.value as number;
    return ErrorMessages.RATE_LIMIT_EXCEEDED(retryAfter || 60);
  }

  if (errorMessage.includes("network") || errorMessage.includes("fetch")) {
    return ErrorMessages.NETWORK_ERROR;
  }

  if (errorMessage.includes("timeout")) {
    return ErrorMessages.NETWORK_TIMEOUT;
  }

  // Default to original message or generic error
  return errorMessage || ErrorMessages.UNKNOWN_ERROR;
}

/**
 * Get error action suggestion
 */
export function getErrorAction(error: Error | string): string {
  const errorMessage = typeof error === "string" ? error : error.message;

  if (errorMessage.includes("auth") || errorMessage.includes("unauthorized")) {
    return "Please sign in to continue";
  }

  if (errorMessage.includes("forbidden")) {
    return "Contact your venue administrator for access";
  }

  if (errorMessage.includes("not found")) {
    return "Please check the URL and try again";
  }

  if (errorMessage.includes("validation")) {
    return "Please correct the highlighted fields and try again";
  }

  if (errorMessage.includes("rate limit")) {
    return "Please wait a moment before trying again";
  }

  if (errorMessage.includes("network") || errorMessage.includes("timeout")) {
    return "Please check your internet connection";
  }

  if (errorMessage.includes("payment")) {
    return "Please try a different payment method or contact your bank";
  }

  return "If the problem persists, please contact support";
}

/**
 * Format error with action suggestion
 */
export function formatErrorWithAction(
  error: Error | string,
  context?: ErrorContext
): { message: string; action: string } {
  const message = getUserFriendlyError(error, context);
  const action = getErrorAction(error);

  return { message, action };
}
