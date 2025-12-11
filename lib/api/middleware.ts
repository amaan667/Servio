/**
 * Request/Response Logging Middleware
 * Provides consistent request/response logging for all API routes
 */

import { NextRequest } from "next/server";
import { logger } from "@/lib/logger";

export interface ApiMiddlewareContext {
  startTime: number;
  method: string;
  url: string;
  pathname: string;
}

/**
 * Create request/response logging middleware
 */
export function withApiLogging<T>(
  handler: (req: NextRequest, context: ApiMiddlewareContext) => Promise<T>
) {
  return async (req: NextRequest): Promise<T> => {
    const startTime = Date.now();
    const url = new URL(req.url);
    const context: ApiMiddlewareContext = {
      startTime,
      method: req.method,
      url: req.url,
      pathname: url.pathname,
    };

    // Log request
    logger.info("[API REQUEST]", {
      method: req.method,
      pathname: url.pathname,
      query: Object.fromEntries(url.searchParams),
    });

    try {
      const result = await handler(req, context);
      const duration = Date.now() - startTime;

      // Log successful response
      logger.info("[API RESPONSE]", {
        method: req.method,
        pathname: url.pathname,
        status: 200,
        duration: `${duration}ms`,
      });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;

      // Log error response
      logger.error("[API ERROR]", {
        method: req.method,
        pathname: url.pathname,
        duration: `${duration}ms`,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });

      throw error;
    }
  };
}
