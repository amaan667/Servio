/**
 * Type-safe error handling utilities
 * Replaces unsafe 'unknown' error handling patterns
 */

/**
 * Type guard to check if value is an Error
 */
export function isError(error: unknown): error is Error {
  return error instanceof Error;
}

/**
 * Safely get error message from unknown error
 */
export function getErrorMessage(error: unknown): string {
  if (isError(error)) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'An unknown error occurred';
}

/**
 * Safely get error code from unknown error
 */
export function getErrorCode(error: unknown): string | undefined {
  if (isError(error) && 'code' in error) {
    return String(error.code);
  }
  return undefined;
}

/**
 * Convert unknown error to Error object
 */
export function toError(error: unknown): Error {
  if (isError(error)) {
    return error;
  }
  return new Error(getErrorMessage(error));
}

/**
 * Type-safe error logger
 */
export function logError(error: unknown, context?: Record<string, unknown>): void {
  if (isError(error)) {
    console.error('[ERROR]', error.message, {
      stack: error.stack,
      ...context,
    });
  } else {
    console.error('[ERROR]', String(error), context);
  }
}

