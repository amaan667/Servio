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
export function success<T>(data: T, meta?: ApiResponse<T>["meta"]): NextResponse<ApiResponse<T>> {
  return NextResponse.json<ApiResponse<T>>(
    {
      success: true,
      data,
      ...(meta && { meta }),
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
  meta?: ApiResponse["meta"]
): NextResponse<ApiResponse> {
  return NextResponse.json<ApiResponse>(
    {
      success: false,
      error: {
        code,
        message,
        ...(details && { details }),
      },
      ...(meta && { meta }),
    },
    { status }
  );
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
  validation: (message: string, details?: unknown) =>
    error(ErrorCodes.VALIDATION_ERROR, message, 400, details),
  
  unauthorized: (message: string = "Authentication required") =>
    error(ErrorCodes.UNAUTHORIZED, message, 401),
  
  forbidden: (message: string = "Access denied") =>
    error(ErrorCodes.FORBIDDEN, message, 403),
  
  notFound: (message: string = "Resource not found") =>
    error(ErrorCodes.NOT_FOUND, message, 404),
  
  conflict: (message: string, details?: unknown) =>
    error(ErrorCodes.CONFLICT, message, 409, details),
  
  rateLimit: (retryAfter?: number) =>
    error(
      ErrorCodes.RATE_LIMIT_EXCEEDED,
      `Rate limit exceeded. ${retryAfter ? `Try again in ${retryAfter} seconds.` : ""}`,
      429,
      retryAfter ? { retryAfter } : undefined
    ),
  
  badRequest: (message: string, details?: unknown) =>
    error(ErrorCodes.BAD_REQUEST, message, 400, details),
  
  internal: (message: string = "Internal server error", details?: unknown) =>
    error(ErrorCodes.INTERNAL_ERROR, message, 500, details),
  
  serviceUnavailable: (message: string = "Service temporarily unavailable") =>
    error(ErrorCodes.SERVICE_UNAVAILABLE, message, 503),
  
  database: (message: string, details?: unknown) =>
    error(ErrorCodes.DATABASE_ERROR, message, 500, details),
};

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

