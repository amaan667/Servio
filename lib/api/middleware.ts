/**
 * Request/Response Logging Middleware
 * Provides consistent request/response logging for all API routes
 */

import { NextRequest } from "next/server";

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

    try {
      const result = await handler(req, context);
      const duration = Date.now() - startTime;

      // Log successful response

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;

      // Log error response

      throw error;
    }
  };
}
