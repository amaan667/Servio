/**
 * Common Error Types
 * Use these instead of 'any' for error handling
 */

/**
 * Unknown error type - use when you don't know the exact error type
 */
export type UnknownError = unknown;

/**
 * Standard error with message
 */
export interface ErrorWithMessage {
  message: string;
  name?: string;
  stack?: string;
}

/**
 * Check if error has a message property
 */
export function isErrorWithMessage(error: unknown): error is ErrorWithMessage {
  return (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof (error as Record<string, unknown>).message === 'string'
  );
}

/**
 * Get error message from unknown error
 */
export function getErrorMessage(error: unknown): string {
  if (isErrorWithMessage(error)) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'An unknown error occurred';
}

/**
 * Get error stack from unknown error
 */
export function getErrorStack(error: unknown): string | undefined {
  if (isErrorWithMessage(error)) {
    return error.stack;
  }
  if (error instanceof Error) {
    return error.stack;
  }
  return undefined;
}

/**
 * Get error name from unknown error
 */
export function getErrorName(error: unknown): string {
  if (isErrorWithMessage(error)) {
    return error.name || 'Error';
  }
  if (error instanceof Error) {
    return error.name;
  }
  return 'UnknownError';
}

