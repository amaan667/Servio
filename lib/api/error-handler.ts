/**
 * Enhanced API Error Handler
 *
 * Provides consistent error handling, logging, and correlation ID tracking
 * for all API routes.
 */

import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import {
  apiErrors,
  isZodError,
  handleZodError,
  getErrorMessage,
  getErrorDetails,
} from "./standard-response";
import { getCorrelationIdFromRequest } from "@/lib/middleware/correlation-id";

/**
 * Enhanced API handler wrapper with comprehensive error handling
 */
export function withApiHandler<T extends unknown[]>(

    ...args: T
  ) => Promise<NextResponse> | NextResponse
) {
  return async (req: NextRequest, ...args: T): Promise<NextResponse> => {
    const correlationId = getCorrelationIdFromRequest(req);
    const startTime = Date.now();

    try {
      

      const result = await handler(req, correlationId, ...args);

      const duration = Date.now() - startTime;
      

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = getErrorMessage(error);
      const errorDetails = getErrorDetails(error);

      // Log the error with full context
      

      // Handle specific error types
      if (isZodError(error)) {
        return handleZodError(error);
      }

      // Check for specific error patterns
      if (errorMessage.includes("JWT") || errorMessage.includes("token")) {
        return apiErrors.unauthorized("Authentication token invalid or expired", correlationId);
      }

      if (errorMessage.includes("permission") || errorMessage.includes("access")) {
        return apiErrors.forbidden(
          "Insufficient permissions",
          { error: errorMessage },
          correlationId
        );
      }

      if (errorMessage.includes("not found") || errorMessage.includes("does not exist")) {
        return apiErrors.notFound(errorMessage, correlationId);
      }

      if (errorMessage.includes("validation") || errorMessage.includes("invalid")) {
        return apiErrors.validation(errorMessage, errorDetails, correlationId);
      }

      if (errorMessage.includes("database") || errorMessage.includes("connection")) {
        return apiErrors.database(
          "Database operation failed",
          {

            correlationId,
          },
          correlationId
        );
      }

      // Default to internal server error
      return apiErrors.internal(
        "An unexpected error occurred",
        {

          correlationId,
          ...(process.env.NODE_ENV === "development" && { details: errorDetails }),
        },
        correlationId
      );
    }
  };
}

/**
 * Enhanced validation error handler with correlation ID
 */
export async function handleValidationError(error: ZodError, correlationId?: string) {
  const response = handleZodError(error);

  // Add correlation ID to the response if provided
  if (correlationId && response) {
    const clonedResponse = response.clone();
    const body = await clonedResponse.json();
    body.meta = {
      ...body.meta,

    };
    return NextResponse.json(body, { status: response.status });
  }

  return response;
}

/**
 * Database error handler with retry logic consideration
 */
export function handleDatabaseError(error: unknown, operation: string, correlationId?: string) {
  const errorMessage = getErrorMessage(error);

  

  // Check if it's a connection error (could be retried)
  if (errorMessage.includes("connection") || errorMessage.includes("timeout")) {
    return apiErrors.serviceUnavailable("Database temporarily unavailable", correlationId);
  }

  // Check if it's a constraint violation
  if (errorMessage.includes("constraint") || errorMessage.includes("duplicate")) {
    return apiErrors.conflict(
      "Data conflict - please check your input",
      { operation, error: errorMessage },
      correlationId
    );
  }

  return apiErrors.database(
    `Database operation failed: ${operation}`,
    { operation, error: errorMessage },
    correlationId
  );
}

/**
 * Authentication error handler
 */
export function handleAuthError(error: unknown, correlationId?: string) {
  const errorMessage = getErrorMessage(error);

  

  if (errorMessage.includes("expired") || errorMessage.includes("invalid")) {
    return apiErrors.unauthorized("Authentication token expired or invalid", correlationId);
  }

  return apiErrors.unauthorized("Authentication required", correlationId);
}

/**
 * Rate limiting error handler with retry information
 */
export function handleRateLimitError(retryAfter: number, correlationId?: string) {
  

  return apiErrors.rateLimit(retryAfter, correlationId);
}
