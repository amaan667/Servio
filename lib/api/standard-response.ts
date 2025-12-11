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
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta?: {
    timestamp: string;
    requestId?: string;
    duration?: number;
  };
}

/**
 * Create a successful response
 */
export function success<T>(
  data: T,
  meta?: ApiResponse<T>["meta"],
  correlationId?: string
): NextResponse<ApiResponse<T>> {
  const responseMeta = meta || {
    timestamp: new Date().toISOString(),
    ...(correlationId && { requestId: correlationId }),
  };

  return NextResponse.json<ApiResponse<T>>(
    {
      success: true,
      data,
      meta: responseMeta,
    },
    { status: 200 }
  );
}

/**
 * Create an error response
 */
export function error(
  code: string,
  message: string,
  status: number = 400,
  details?: unknown,
  meta?: ApiResponse["meta"],
  correlationId?: string
): NextResponse<ApiResponse> {
  const responseMeta = meta || {
    timestamp: new Date().toISOString(),
    ...(correlationId && { requestId: correlationId }),
  };

  const response: Partial<ApiResponse> = {
    success: false,
    error: {
      code,
      message,
    },
    meta: responseMeta,
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
  VALIDATION_ERROR: "VALIDATION_ERROR",
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  CONFLICT: "CONFLICT",
  RATE_LIMIT_EXCEEDED: "RATE_LIMIT_EXCEEDED",
  BAD_REQUEST: "BAD_REQUEST",

  // Server errors (5xx)
  INTERNAL_ERROR: "INTERNAL_ERROR",
  SERVICE_UNAVAILABLE: "SERVICE_UNAVAILABLE",
  DATABASE_ERROR: "DATABASE_ERROR",
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

  internal: (
    message: string = "Internal server error",
    details?: unknown,
    correlationId?: string
  ) => error(ErrorCodes.INTERNAL_ERROR, message, 500, details, undefined, correlationId),

  serviceUnavailable: (
    message: string = "Service temporarily unavailable",
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
    path: e.path.join("."),
    message: e.message,
    code: e.code,
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
      message: error.message,
      name: error.name,
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
    };
  }
  return error;
}
