/**
 * Error to LogContext converter
 * Converts errors and other values to proper logger context format
 */

export interface LogContext {
  [key: string]: unknown;
}

/**
 * Convert error to log context
 */
export function errorToContext(error: unknown): LogContext {
  if (error instanceof Error) {
    return {
      message: error.message,
      name: error.name,
      stack: error.stack,
    };
  }

  if (typeof error === "string") {
    return { message: error };
  }

  if (typeof error === "object" && error !== null) {
    return error as LogContext;
  }

  return { value: String(error) };
}

/**
 * Convert unknown value to log context
 */
export function toContext(value: unknown): LogContext {
  if (typeof value === "string") {
    return { message: value };
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return { value };
  }

  if (typeof value === "object" && value !== null) {
    return value as LogContext;
  }

  return { value: String(value) };
}
