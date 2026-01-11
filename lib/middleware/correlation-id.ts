/**
 * Correlation ID Middleware
 *
 * Generates a unique correlation ID per request and injects it into:
 * - Request headers
 * - All logs
 * - External API calls (Stripe metadata)
 * - Background jobs
 *
 * This enables distributed tracing across services.
 */

import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";

const CORRELATION_ID_HEADER = "x-correlation-id";
const CORRELATION_ID_CONTEXT_KEY = "correlationId";

/**
 * Get correlation ID from request headers or generate new one
 */
export function getCorrelationId(request: NextRequest): string {
  const existing = request.headers.get(CORRELATION_ID_HEADER);
  if (existing) {
    return existing;
  }
  return uuidv4();
}

/**
 * Set correlation ID in response headers
 */
export function setCorrelationId(response: NextResponse, correlationId: string): void {
  response.headers.set(CORRELATION_ID_HEADER, correlationId);
}

/**
 * Middleware to add correlation ID to all requests
 * Should be added to middleware.ts
 */
export function withCorrelationId(

    (req as NextRequest & { [CORRELATION_ID_CONTEXT_KEY]: string })[CORRELATION_ID_CONTEXT_KEY] =
      correlationId;

    // Call handler
    const response = await handler(req);

    // Add correlation ID to response headers
    setCorrelationId(response, correlationId);

    return response;
  };
}

/**
 * Get correlation ID from request (for use in route handlers)
 */
export function getCorrelationIdFromRequest(req: NextRequest): string {
  return (
    (req as NextRequest & { [CORRELATION_ID_CONTEXT_KEY]?: string })[CORRELATION_ID_CONTEXT_KEY] ||
    getCorrelationId(req)
  );
}

/**
 * Enhanced logger that includes correlation ID
 */
export function createCorrelatedLogger(correlationId: string) {
  return {
    info: (message: string, context?: Record<string, unknown>) => {
      
    },
    error: (message: string, context?: Record<string, unknown>) => {
      
    },
    warn: (message: string, context?: Record<string, unknown>) => {
      
    },
    debug: (message: string, context?: Record<string, unknown>) => {
      
    },
  };
}
