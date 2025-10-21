/**
 * API Handler Wrapper
 * Provides consistent error handling and logging for API routes
 */

import { NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { logger } from '@/lib/logger';
import { getErrorDetails } from '@/lib/utils/errors';
import {
  ok,
  fail,
  serverError,
  handleZodError,
  ApiResponse,
} from './response-helpers';

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
  options: HandlerOptions = {}
): (req: NextRequest) => Promise<NextResponse<ApiResponse<TResponse>>> {
  return async (req: NextRequest): Promise<NextResponse<ApiResponse<TResponse>>> => {
    const startTime = Date.now();

    try {
      // Log request if enabled
      if (options.logRequest) {
        logger.debug('[API REQUEST]', {
          method: req.method,
          url: req.url,
          ...(options.requireAuth && { authenticated: true }),
        });
      }

      // Parse request body
      let body: TRequest;
      try {
        body = (await req.json()) as TRequest;
      } catch {
        body = {} as TRequest;
      }

      // Execute handler
      const result = await handler(req, body);

      // Log response if enabled
      if (options.logResponse) {
        const duration = Date.now() - startTime;
        logger.debug('[API RESPONSE]', {
          method: req.method,
          url: req.url,
          status: 200,
          duration: `${duration}ms`,
        });
      }

      // Return success response
      return ok(result);
    } catch (error: any) {
      const duration = Date.now() - startTime;

      // Log error
      logger.error('[API ERROR]', {
        method: req.method,
        url: req.url,
        duration: `${duration}ms`,
        error: getErrorDetails(error),
      });

      // Handle Zod validation errors
      if (error instanceof ZodError) {
        return handleZodError(error);
      }

      // Handle known error types
      if (error instanceof Error) {
        // Check for specific error types
        if (error.name === 'UnauthorizedError') {
          return fail(error.message, 401);
        }
        if (error.name === 'ForbiddenError') {
          return fail(error.message, 403);
        }
        if (error.name === 'NotFoundError') {
          return fail(error.message, 404);
        }
        if (error.name === 'ValidationError') {
          return fail(error.message, 400);
        }
      }

      // Return generic server error
      return serverError('Internal server error', getErrorDetails(error));
    }
  };
}

/**
 * Create a GET handler wrapper
 */
export function createGetHandler<TResponse = unknown>(
  handler: (req: NextRequest) => Promise<TResponse>,
  options: HandlerOptions = {}
): (req: NextRequest) => Promise<NextResponse<ApiResponse<TResponse>>> {
  return withErrorHandling(async (req) => handler(req), options);
}

/**
 * Create a POST handler wrapper
 */
export function createPostHandler<TRequest = unknown, TResponse = unknown>(
  handler: ApiHandler<TRequest, TResponse>,
  options: HandlerOptions = {}
): (req: NextRequest) => Promise<NextResponse<ApiResponse<TResponse>>> {
  return withErrorHandling(handler, options);
}

/**
 * Create a PUT handler wrapper
 */
export function createPutHandler<TRequest = unknown, TResponse = unknown>(
  handler: ApiHandler<TRequest, TResponse>,
  options: HandlerOptions = {}
): (req: NextRequest) => Promise<NextResponse<ApiResponse<TResponse>>> {
  return withErrorHandling(handler, options);
}

/**
 * Create a DELETE handler wrapper
 */
export function createDeleteHandler<TResponse = unknown>(
  handler: (req: NextRequest) => Promise<TResponse>,
  options: HandlerOptions = {}
): (req: NextRequest) => Promise<NextResponse<ApiResponse<TResponse>>> {
  return withErrorHandling(async (req) => handler(req), options);
}

