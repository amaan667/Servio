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

  context: ErrorContext = {},

    context,

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

  }
): void {
  trackError(error, { ...context, action: "payment" }, "critical");
}

/**
 * Track order-related errors
 */
export function trackOrderError(

  }
): void {
  trackError(error, { ...context, action: context.action || "order_operation" }, "high");
}

/**
 * Track authentication errors
 */
export function trackAuthError(

  }
): void {
  trackError(error, { ...context, action: context.action || "authentication" }, "high");
}

/**
 * Track database errors
 */
export function trackDatabaseError(

  }
): void {
  trackError(error, { ...context, action: "database_operation" }, "high");
}

/**
 * Create a safe error response for API routes
 */
export function createErrorResponse(

  context: ErrorContext = {},
  defaultMessage = "An error occurred"
): { error: string; details?: string; code?: string } {
  const errorDetails = getErrorDetails(error);

  // Track the error
  trackError(error, context);

  // Return user-friendly error message
  return {

    ...(errorDetails.code && { code: errorDetails.code }),
    // Don't expose stack traces in production
    ...(process.env.NODE_ENV === "development" &&
      errorDetails.stack && {

      }),
  };
}
