/**
 * Request Helper Utilities
 * Provides consistent request handling patterns across all API routes
 */

import { NextRequest } from "next/server";
import { getCorrelationIdFromRequest } from "@/lib/middleware/correlation-id";

/**
 * Get request metadata for logging and tracking
 */
export function getRequestMetadata(req: NextRequest) {
  const correlationId = getCorrelationIdFromRequest(req);
  const userAgent = req.headers.get("user-agent") || "unknown";
  const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";
  
  return {
    correlationId,
    userAgent,
    ip,
    method: req.method,
    url: req.url,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Get idempotency key from request headers (optional, non-breaking)
 */
export function getIdempotencyKey(req: NextRequest): string | null {
  return req.headers.get("x-idempotency-key");
}

/**
 * Create a standardized error context for logging
 */
export function createErrorContext(
  req: NextRequest,
  error: unknown,
  additionalContext?: Record<string, unknown>
) {
  const metadata = getRequestMetadata(req);
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorStack = error instanceof Error ? error.stack : undefined;

  return {
    ...metadata,
    error: {
      message: errorMessage,
      ...(errorStack && { stack: errorStack }),
      ...(error instanceof Error && { name: error.name }),
    },
    ...additionalContext,
  };
}
