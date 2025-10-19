/**
 * Error handling utilities
 */

export interface ErrorDetails {
  message: string;
  stack?: string;
  name?: string;
  code?: string;
}

/**
 * Extract error details from an unknown error
 */
export function getErrorDetails(error: unknown): ErrorDetails {
  if (error instanceof Error) {
    return {
      message: error.message,
      stack: error.stack,
      name: error.name,
      ...(error as any).code && { code: (error as any).code },
    };
  }

  if (typeof error === 'string') {
    return { message: error };
  }

  if (error && typeof error === 'object') {
    return {
      message: (error as any).message || 'Unknown error',
      ...(error as any).stack && { stack: (error as any).stack },
      ...(error as any).name && { name: (error as any).name },
      ...(error as any).code && { code: (error as any).code },
    };
  }

  return { message: 'Unknown error occurred' };
}

/**
 * Check if error is a specific type
 */
export function isErrorType(error: unknown, type: string): boolean {
  return error instanceof Error && error.name === type;
}

/**
 * Create a formatted error message
 */
export function formatErrorMessage(error: unknown): string {
  const details = getErrorDetails(error);
  return details.message;
}

