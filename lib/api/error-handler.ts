/**
 * Enhanced API Error Handler
 *
 * Provides consistent error handling, logging, and correlation ID tracking
 * for all API routes.
 */

import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { logger } from "@/lib/logger";
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
  handler: (
    req: NextRequest,
    correlationId: string,
    ...args: T
  ) => Promise<NextResponse> | NextResponse
) {
  return async (req: NextRequest, ...args: T): Promise<NextResponse> => {
    const correlationId = getCorrelationIdFromRequest(req);
    const startTime = Date.now();

    try {
      logger.debug("[API_HANDLER] Request started", {
        method: req.method,
        url: req.url,
        correlationId,
      });

      const result = await handler(req, correlationId, ...args);

      const duration = Date.now() - startTime;
      logger.debug("[API_HANDLER] Request completed", {
        method: req.method,
        url: req.url,
        status: result.status,
        duration,
        correlationId,
      });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = getErrorMessage(error);
      const errorDetails = getErrorDetails(error);

      // Log the error with full context
      logger.error("[API_HANDLER] Unhandled error", {
        method: req.method,
        url: req.url,
        error: errorMessage,
        details: errorDetails,
        duration,
        correlationId,
        stack: error instanceof Error ? error.stack : undefined,
      });

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
            error: errorMessage,
            correlationId,
          },
          correlationId
        );
      }

      // Default to internal server error
      return apiErrors.internal(
        "An unexpected error occurred",
        {
          message: errorMessage,
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
      requestId: correlationId,
      timestamp: new Date().toISOString(),
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

  logger.error("[DATABASE_ERROR]", {
    operation,
    error: errorMessage,
    correlationId,
  });

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

  logger.warn("[AUTH_ERROR]", {
    error: errorMessage,
    correlationId,
  });

  if (errorMessage.includes("expired") || errorMessage.includes("invalid")) {
    return apiErrors.unauthorized("Authentication token expired or invalid", correlationId);
  }

  return apiErrors.unauthorized("Authentication required", correlationId);
}

/**
 * Rate limiting error handler with retry information
 */
export function handleRateLimitError(retryAfter: number, correlationId?: string) {
  logger.warn("[RATE_LIMIT]", {
    retryAfter,
    correlationId,
  });

  return apiErrors.rateLimit(retryAfter, correlationId);
}
