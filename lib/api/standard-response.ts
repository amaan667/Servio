/**
 * Standard API Response Format
 *
 * ALL API routes MUST use this format for consistency.
 * This ensures predictable error handling and response structure.
 */

import { NextResponse } from "next/server";
import { ZodError } from "zod";

/**
 * Standard API response structure
 */
export interface ApiResponse<T = unknown> {

  };
  meta?: {

  };
}

/**
 * Create a successful response
 */
export function success<T>(

  meta?: ApiResponse<T>["meta"],
  correlationId?: string
): NextResponse<ApiResponse<T>> {
  const responseMeta = meta || {

    ...(correlationId && { requestId: correlationId }),
  };

  return NextResponse.json<ApiResponse<T>>(
    {

      data,

    },
    { status: 200 }
  );
}

/**
 * Create an error response
 */
export function error(

  details?: unknown,
  meta?: ApiResponse["meta"],
  correlationId?: string
): NextResponse<ApiResponse> {
  const responseMeta = meta || {

    ...(correlationId && { requestId: correlationId }),
  };

  const response: Partial<ApiResponse> = {

      message,
    },

  };

  if (details) {
    if (response.error) {
      response.error.details = details;
    }
  }

  return NextResponse.json<ApiResponse>(response as ApiResponse, { status });
}

/**
 * Standard error codes
 */
export const ErrorCodes = {
  // Client errors (4xx)

  // Server errors (5xx)

} as const;

/**
 * Convenience functions for common errors
 */
export const apiErrors = {
  validation: (message: string, details?: unknown, correlationId?: string) =>
    error(ErrorCodes.VALIDATION_ERROR, message, 400, details, undefined, correlationId),

  unauthorized: (message: string = "Authentication required", correlationId?: string) =>
    error(ErrorCodes.UNAUTHORIZED, message, 401, undefined, undefined, correlationId),

  forbidden: (message: string = "Access denied", details?: unknown, correlationId?: string) =>
    error(ErrorCodes.FORBIDDEN, message, 403, details, undefined, correlationId),

  notFound: (message: string = "Resource not found", correlationId?: string) =>
    error(ErrorCodes.NOT_FOUND, message, 404, undefined, undefined, correlationId),

  conflict: (message: string, details?: unknown, correlationId?: string) =>
    error(ErrorCodes.CONFLICT, message, 409, details, undefined, correlationId),

  rateLimit: (retryAfter?: number, correlationId?: string) =>
    error(
      ErrorCodes.RATE_LIMIT_EXCEEDED,
      `Rate limit exceeded. ${retryAfter ? `Try again in ${retryAfter} seconds.` : ""}`,
      429,
      retryAfter ? { retryAfter } : undefined,
      undefined,
      correlationId
    ),

  badRequest: (message: string, details?: unknown, correlationId?: string) =>
    error(ErrorCodes.BAD_REQUEST, message, 400, details, undefined, correlationId),

    details?: unknown,
    correlationId?: string
  ) => error(ErrorCodes.INTERNAL_ERROR, message, 500, details, undefined, correlationId),

    correlationId?: string
  ) => error(ErrorCodes.SERVICE_UNAVAILABLE, message, 503, undefined, undefined, correlationId),

  database: (message: string, details?: unknown, correlationId?: string) =>
    error(ErrorCodes.DATABASE_ERROR, message, 500, details, undefined, correlationId),
};

/**
 * Check if error is a ZodError
 */
export function isZodError(error: unknown): error is ZodError {
  return error instanceof ZodError;
}

/**
 * Handle Zod validation errors
 */
export function handleZodError(err: ZodError): NextResponse<ApiResponse> {
  const details = err.errors.map((e) => ({

  }));

  return apiErrors.validation("Validation failed", details);
}

/**
 * Extract error message from unknown error
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  return "An unknown error occurred";
}

/**
 * Extract error details from unknown error
 */
export function getErrorDetails(error: unknown): unknown {
  if (error instanceof Error) {
    return {

    };
  }
  return error;
}
