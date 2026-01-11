/**
 * Error handling utilities
 */

export interface ErrorDetails {

}

/**
 * Extract error details from an unknown error
 */
interface ErrorWithCode extends Error {
  code?: string;
}

export function getErrorDetails(error: unknown): ErrorDetails {
  if (error instanceof Error) {
    const err = error as ErrorWithCode;
    return {

      ...(err.code && { code: err.code }),
    };
  }

  if (typeof error === "string") {
    return { message: error };
  }

  if (error && typeof error === "object") {
    const errorObj = error as Record<string, unknown>;
    const result: ErrorDetails = {

    };

    if (errorObj.stack) result.stack = String(errorObj.stack);
    if (errorObj.name) result.name = String(errorObj.name);
    if (errorObj.code) result.code = String(errorObj.code);

    return result;
  }

  return { message: "Unknown error occurred" };
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

/**
 * Get error message from unknown error type
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  if (error && typeof error === "object" && "message" in error) {
    return String(error.message);
  }
  return "An unknown error occurred";
}

/**
 * Convert unknown error to Error object
 */
export function toError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }
  if (typeof error === "string") {
    return new Error(error);
  }
  if (error && typeof error === "object" && "message" in error) {
    return new Error(String(error.message));
  }
  return new Error("An unknown error occurred");
}
