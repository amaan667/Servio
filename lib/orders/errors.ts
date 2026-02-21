/**
 * Order Error Wrapper
 * Standardized error handling for order operations
 */

import { logger } from "@/lib/monitoring/structured-logger";

/**
 * Order error codes for consistent error handling
 */
export enum OrderErrorCode {
  NOT_FOUND = "ORDER_NOT_FOUND",
  INVALID_STATUS = "INVALID_STATUS_TRANSITION",
  VALIDATION_FAILED = "VALIDATION_FAILED",
  CREATE_FAILED = "CREATE_FAILED",
  UPDATE_FAILED = "UPDATE_FAILED",
  PAYMENT_FAILED = "PAYMENT_FAILED",
  CANCELLATION_FAILED = "CANCELLATION_FAILED",
  COMPLETION_FAILED = "COMPLETION_FAILED",
  TABLE_CLEANUP_FAILED = "TABLE_CLEANUP_FAILED",
  INVENTORY_DEDUCTION_FAILED = "INVENTORY_DEDUCTION_FAILED",
  UNKNOWN = "UNKNOWN_ERROR",
}

/**
 * Order error class with structured error codes
 */
export class OrderError extends Error {
  code: OrderErrorCode;
  context: Record<string, unknown>;
  originalError?: Error;

  constructor(
    code: OrderErrorCode,
    message: string,
    context: Record<string, unknown> = {},
    originalError?: Error
  ) {
    super(message);
    this.name = "OrderError";
    this.code = code;
    this.context = context;
    this.originalError = originalError;

    // Capture stack trace (Node.js specific)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, OrderError);
    }
  }

  /**
   * Convert to JSON for logging/API responses
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      context: this.context,
      stack: this.stack,
    };
  }
}

/**
 * Wrap Supabase error in OrderError
 */
export function wrapSupabaseError(
  error: unknown,
  context: Record<string, unknown> = {}
): OrderError {
  const supabaseError = error as {
    message?: string;
    code?: string;
    details?: unknown;
  };

  return new OrderError(
    OrderErrorCode.UNKNOWN,
    supabaseError.message || "Database operation failed",
    {
      ...context,
      supabaseCode: supabaseError.code,
      supabaseDetails: supabaseError.details,
    },
    error instanceof Error ? error : undefined
  );
}

/**
 * Wrap validation error in OrderError
 */
export function wrapValidationError(
  message: string,
  context: Record<string, unknown> = {}
): OrderError {
  return new OrderError(OrderErrorCode.VALIDATION_FAILED, message, context);
}

/**
 * Wrap not found error
 */
export function wrapNotFoundError(
  resourceType: string,
  resourceId: string,
  context: Record<string, unknown> = {}
): OrderError {
  return new OrderError(
    OrderErrorCode.NOT_FOUND,
    `${resourceType} with id '${resourceId}' not found`,
    { resourceType, resourceId, ...context }
  );
}

/**
 * Wrap invalid status transition error
 */
export function wrapInvalidStatusError(
  currentStatus: string,
  requestedStatus: string,
  context: Record<string, unknown> = {}
): OrderError {
  return new OrderError(
    OrderErrorCode.INVALID_STATUS,
    `Cannot transition from '${currentStatus}' to '${requestedStatus}'`,
    { currentStatus, requestedStatus, ...context }
  );
}

/**
 * Log order error with structured logging
 */
export function logOrderError(error: OrderError, operation: string): void {
  logger.error(`[OrderService] ${operation} failed`, {
    code: error.code,
    message: error.message,
    context: error.context,
    stack: error.stack,
    originalError: error.originalError?.message,
  });
}

/**
 * Create error response for API
 */
export function createErrorResponse(error: OrderError): {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
} {
  return {
    success: false,
    error: {
      code: error.code,
      message: error.message,
      details: error.context,
    },
  };
}

/**
 * Safe error handler wrapper
 */
export function withErrorHandling<T>(
  operation: string,
  handler: () => Promise<T>,
  errorMap?: (error: unknown) => OrderError
): Promise<T> {
  return handler().catch((error) => {
    const orderError = errorMap ? errorMap(error) : wrapSupabaseError(error, { operation });

    logOrderError(orderError, operation);
    throw orderError;
  });
}
