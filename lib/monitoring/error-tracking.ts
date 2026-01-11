/**
 * Error Tracking and Monitoring Utilities
 * Provides consistent error logging and tracking for launch readiness
 */

import { getErrorDetails } from "@/lib/utils/errors";
import { captureException, captureMessage } from "./sentry";

export interface ErrorContext {
  userId?: string;
  venueId?: string;
  orderId?: string;
  action?: string;
  [key: string]: unknown; // Allow additional properties
}

/**
 * Track critical errors with context
 */
export function trackError(
  error: unknown,
  context: ErrorContext = {},
  severity: "low" | "medium" | "high" | "critical" = "medium"
): void {
  const errorDetails = getErrorDetails(error);
  const errorMessage = errorDetails.message || "Unknown error";

  const logData = {
    severity,
    error: errorDetails,
    context,
    timestamp: new Date().toISOString(),
  };

  // Log based on severity
  switch (severity) {
    case "critical":

      captureException(error, { ...context, severity });
      break;
    case "high":

      captureException(error, { ...context, severity });
      break;
    case "medium":

      captureMessage(errorMessage, "warning", { ...context, severity });
      break;
    case "low":

      break;
  }
}

/**
 * Track payment-related errors (critical for launch)
 */
export function trackPaymentError(
  error: unknown,
  context: {
    orderId?: string;
    venueId?: string;
    paymentMethod?: string;
    amount?: number;
    stripeSessionId?: string;
  }
): void {
  trackError(error, { ...context, action: "payment" }, "critical");
}

/**
 * Track order-related errors
 */
export function trackOrderError(
  error: unknown,
  context: {
    orderId?: string;
    venueId?: string;
    action?: string;
    orderStatus?: string;
  }
): void {
  trackError(error, { ...context, action: context.action || "order_operation" }, "high");
}

/**
 * Track authentication errors
 */
export function trackAuthError(
  error: unknown,
  context: {
    userId?: string;
    venueId?: string;
    action?: string;
  }
): void {
  trackError(error, { ...context, action: context.action || "authentication" }, "high");
}

/**
 * Track database errors
 */
export function trackDatabaseError(
  error: unknown,
  context: {
    operation?: string;
    table?: string;
    venueId?: string;
  }
): void {
  trackError(error, { ...context, action: "database_operation" }, "high");
}

/**
 * Create a safe error response for API routes
 */
export function createErrorResponse(
  error: unknown,
  context: ErrorContext = {},
  defaultMessage = "An error occurred"
): { error: string; details?: string; code?: string } {
  const errorDetails = getErrorDetails(error);

  // Track the error
  trackError(error, context);

  // Return user-friendly error message
  return {
    error: errorDetails.message || defaultMessage,
    ...(errorDetails.code && { code: errorDetails.code }),
    // Don't expose stack traces in production
    ...(process.env.NODE_ENV === "development" &&
      errorDetails.stack && {
        details: errorDetails.stack,
      }),
  };
}
