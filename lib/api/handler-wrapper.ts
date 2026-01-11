/**
 * API Handler Wrapper
 * Provides consistent error handling and logging for API routes
 */

import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";

import { getErrorDetails } from "@/lib/utils/errors";
import { ok, fail, serverError, handleZodError, ApiResponse } from "./response-helpers";

/**
 * Handler function type
 */
export type ApiHandler<TRequest = unknown, TResponse = unknown> = (
  req: NextRequest,
  body: TRequest
) => Promise<TResponse>;

/**
 * Wrapper options
 */
export interface HandlerOptions {
  requireAuth?: boolean;
  logRequest?: boolean;
  logResponse?: boolean;
}

/**
 * Wrap an API handler with consistent error handling
 */
export function withErrorHandling<TRequest = unknown, TResponse = unknown>(
  handler: ApiHandler<TRequest, TResponse>,
  options: HandlerOptions = {
    /* Empty */
  }
): (req: NextRequest) => Promise<NextResponse<ApiResponse<TResponse>>> {
  return async (req: NextRequest): Promise<NextResponse<ApiResponse<TResponse>>> => {
    const startTime = Date.now();

    try {
      // Log request if enabled
      if (options.logRequest) { /* Condition handled */ }

      // Parse request body
      let body: TRequest;
      try {
        body = (await req.json()) as TRequest;
      } catch {
        body = {
          /* Empty */
        } as TRequest;
      }

      // Execute handler
      const result = await handler(req, body);

      // Log response if enabled
      if (options.logResponse) {
        const duration = Date.now() - startTime;

      }

      // Return success response
      return ok(result) as NextResponse<ApiResponse<TResponse>>;
    } catch (_error) {
      const duration = Date.now() - startTime;

      // Log error

      // Handle Zod validation errors
      if (_error instanceof ZodError) {
        return handleZodError(_error) as NextResponse<ApiResponse<TResponse>>;
      }

      // Handle known error types
      if (_error instanceof Error) {
        // Check for specific error types
        if (_error.name === "UnauthorizedError") {
          return fail(_error.message, 401) as NextResponse<ApiResponse<TResponse>>;
        }
        if (_error.name === "ForbiddenError") {
          return fail(_error.message, 403) as NextResponse<ApiResponse<TResponse>>;
        }
        if (_error.name === "NotFoundError") {
          return fail(_error.message, 404) as NextResponse<ApiResponse<TResponse>>;
        }
        if (_error.name === "ValidationError") {
          return fail(_error.message, 400) as NextResponse<ApiResponse<TResponse>>;
        }
      }

      // Return generic server error
      const errorDetails = getErrorDetails(_error);
      const detailsRecord =
        typeof errorDetails === "object" && errorDetails !== null
          ? (errorDetails as unknown as Record<string, unknown>)
          : { error: errorDetails };
      return serverError("Internal server error", detailsRecord) as NextResponse<
        ApiResponse<TResponse>
      >;
    }
  };
}

/**
 * Create a GET handler wrapper
 */
export function createGetHandler<TResponse = unknown>(
  handler: (req: NextRequest) => Promise<TResponse>,
  options: HandlerOptions = {
    /* Empty */
  }
): (req: NextRequest) => Promise<NextResponse<ApiResponse<TResponse>>> {
  return withErrorHandling(async (req) => handler(req), options);
}

/**
 * Create a POST handler wrapper
 */
export function createPostHandler<TRequest = unknown, TResponse = unknown>(
  handler: ApiHandler<TRequest, TResponse>,
  options: HandlerOptions = {
    /* Empty */
  }
): (req: NextRequest) => Promise<NextResponse<ApiResponse<TResponse>>> {
  return withErrorHandling(handler, options);
}

/**
 * Create a PUT handler wrapper
 */
export function createPutHandler<TRequest = unknown, TResponse = unknown>(
  handler: ApiHandler<TRequest, TResponse>,
  options: HandlerOptions = {
    /* Empty */
  }
): (req: NextRequest) => Promise<NextResponse<ApiResponse<TResponse>>> {
  return withErrorHandling(handler, options);
}

/**
 * Create a DELETE handler wrapper
 */
export function createDeleteHandler<TResponse = unknown>(
  handler: (req: NextRequest) => Promise<TResponse>,
  options: HandlerOptions = {
    /* Empty */
  }
): (req: NextRequest) => Promise<NextResponse<ApiResponse<TResponse>>> {
  return withErrorHandling(async (req) => handler(req), options);
}
