/**
 * Type-safe error handling utilities
 */

/**
 * Safely get error message from unknown error type
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  if (error && typeof error === 'object' && 'message' in error) {
    return String(error.message);
  }
  return 'An unknown error occurred';
}

/**
 * Safely get error details from unknown error type
 */
export function getErrorDetails(error: unknown): {
  message: string;
  stack?: string;
  name?: string;
} {
  if (error instanceof Error) {
    return {
      message: error.message,
      stack: error.stack,
      name: error.name,
    };
  }
  if (typeof error === 'string') {
    return { message: error };
  }
  if (error && typeof error === 'object' && 'message' in error) {
    return {
      message: String(error.message),
      stack: 'stack' in error ? String(error.stack) : undefined,
      name: 'name' in error ? String(error.name) : undefined,
    };
  }
  return { message: 'An unknown error occurred' };
}

/**
 * Check if error is a specific type
 */
export function isErrorOfType<T extends Error>(
  error: unknown,
  errorType: new (...args: any[]) => T
): error is T {
  return error instanceof errorType;
}

/**
 * Safely stringify error for logging
 */
export function stringifyError(error: unknown): string {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}${error.stack ? `\n${error.stack}` : ''}`;
  }
  if (typeof error === 'string') {
    return error;
  }
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

/**
 * Convert unknown error to Error instance
 */
export function toError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }
  if (typeof error === 'string') {
    return new Error(error);
  }
  if (error && typeof error === 'object' && 'message' in error) {
    return new Error(String(error.message));
  }
  return new Error('An unknown error occurred');
}
