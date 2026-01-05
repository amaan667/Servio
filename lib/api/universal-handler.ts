/**
 * Universal API Handler
 * Standardized handler with validation, auth, logging, and error handling
 * Use this for ALL API routes to ensure consistency
 */

import { NextRequest, NextResponse } from "next/server";
import { ZodSchema, ZodError } from "zod";
import { logger } from "@/lib/logger";
import { ok, fail, serverError, handleZodError, ApiResponse } from "./response-helpers";
import {
  getAuthenticatedUser,
  verifyVenueAccess,
  AuthorizedContext,
} from "@/lib/middleware/authorization";
import { performanceTracker } from "@/lib/monitoring/performance-tracker";

export interface HandlerOptions {
  /** Zod schema for request body validation */
  schema?: ZodSchema;
  /** Require authentication */
  requireAuth?: boolean;
  /** Require venue access (implies requireAuth) */
  requireVenueAccess?: boolean;
  /** Extract venueId from params, query, or body */
  venueIdSource?: "params" | "query" | "body" | "auto";
  /** Log request details */
  logRequest?: boolean;
  /** Log response details */
  logResponse?: boolean;
  /** Track performance metrics */
  trackPerformance?: boolean;
  /** Custom error handler */
  onError?: (error: unknown, req: NextRequest) => NextResponse<ApiResponse> | null;
}

export type HandlerContext<TBody = unknown> = {
  req: NextRequest;
  body: TBody;
  user?: { id: string; email?: string };
  venue?: AuthorizedContext["venue"];
  venueId?: string;
  params?: Record<string, string>;
};

export type UniversalHandler<TBody = unknown, TResponse = unknown> = (
  context: HandlerContext<TBody>
) => Promise<TResponse>;

/**
 * Create a universal API handler with validation, auth, and error handling
 */
export function createUniversalHandler<TBody = unknown, TResponse = unknown>(
  handler: UniversalHandler<TBody, TResponse>,
  options: HandlerOptions = {}
) {
  return async (
    req: NextRequest,
    context?: { params?: Record<string, string> }
  ): Promise<NextResponse<ApiResponse<TResponse>>> => {
    const startTime = Date.now();
    const requestId = crypto.randomUUID();

    try {
      // Track performance if enabled
      const perfTracker =
        options.trackPerformance !== false ? performanceTracker.start("api_handler") : null;

      // Parse request body
      let body: TBody = {} as TBody;
      try {
        const contentType = req.headers.get("content-type");
        if (contentType?.includes("application/json")) {
          body = (await req.json()) as TBody;
        }
      } catch {
        // No body or invalid JSON - use empty object
      }

      // Validate request body if schema provided
      if (options.schema) {
        try {
          body = options.schema.parse(body) as TBody;
        } catch (error) {
          if (error instanceof ZodError) {
            logger.warn("[API VALIDATION ERROR]", {
              requestId,
              method: req.method,
              url: req.url,
              errors: error.errors,
            });
            return handleZodError(error) as NextResponse<ApiResponse<TResponse>>;
          }
          throw error;
        }
      }

      // Log request if enabled
      if (options.logRequest) {
        logger.info("[API REQUEST]", {
          requestId,
          method: req.method,
          url: req.url,
          hasBody: !!body && Object.keys(body).length > 0,
          ...(options.requireAuth && { requiresAuth: true }),
        });
      }

      // Handle authentication
      let user: { id: string; email?: string } | undefined;
      if (options.requireAuth || options.requireVenueAccess) {
        const authResult = await getAuthenticatedUser();
        if (!authResult.user) {
          logger.warn("[API AUTH FAILED]", {
            requestId,
            method: req.method,
            url: req.url,
            error: authResult.error,
          });
          return fail("Unauthorized", 401) as NextResponse<ApiResponse<TResponse>>;
        }
        user = authResult.user;
      }

      // Handle venue access
      let venueContext: AuthorizedContext | null = null;
      if (options.requireVenueAccess && user) {
        let venueId: string | null = null;

        // Extract venueId based on source option
        if (options.venueIdSource === "params" || options.venueIdSource === "auto") {
          venueId = context?.params?.venueId || null;
        }
        if (!venueId && (options.venueIdSource === "query" || options.venueIdSource === "auto")) {
          venueId = new URL(req.url).searchParams.get("venueId");
        }
        if (!venueId && (options.venueIdSource === "body" || options.venueIdSource === "auto")) {
          venueId =
            (body as { venueId?: string; venue_id?: string })?.venueId ||
            (body as { venueId?: string; venue_id?: string })?.venue_id ||
            null;
        }

        if (!venueId) {
          return fail("venueId is required", 400) as NextResponse<ApiResponse<TResponse>>;
        }

        const access = await verifyVenueAccess(venueId, user.id);
        if (!access) {
          logger.warn("[API VENUE ACCESS DENIED]", {
            requestId,
            method: req.method,
            url: req.url,
            venueId,
            userId: user.id,
          });
          return fail("Forbidden - access denied to this venue", 403) as NextResponse<
            ApiResponse<TResponse>
          >;
        }

        venueContext = {
          venue: access.venue,
          user: access.user,
          role: access.role,
          venueId,
          tier: access.tier,
          venue_ids: access.venue_ids,
        };
      }

      // Execute handler
      const handlerContext: HandlerContext<TBody> = {
        req,
        body,
        user,
        venue: venueContext?.venue,
        venueId: venueContext?.venueId,
        params: context?.params,
      };

      const result = await handler(handlerContext);

      // Track performance
      if (perfTracker) {
        perfTracker.end();
      }

      // Log response if enabled
      if (options.logResponse) {
        const duration = Date.now() - startTime;
        logger.info("[API RESPONSE]", {
          requestId,
          method: req.method,
          url: req.url,
          status: 200,
          duration: `${duration}ms`,
        });
      }

      return ok(result) as NextResponse<ApiResponse<TResponse>>;
    } catch (error) {
      const duration = Date.now() - startTime;

      // Custom error handler
      if (options.onError) {
        const customResponse = options.onError(error, req);
        if (customResponse) {
          return customResponse as NextResponse<ApiResponse<TResponse>>;
        }
      }

      // Log error
      logger.error("[API ERROR]", {
        requestId,
        method: req.method,
        url: req.url,
        duration: `${duration}ms`,
        error:
          error instanceof Error
            ? {
                name: error.name,
                message: error.message,
                stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
              }
            : error,
      });

      // Handle Zod validation errors
      if (error instanceof ZodError) {
        return handleZodError(error) as NextResponse<ApiResponse<TResponse>>;
      }

      // Handle known error types
      if (error instanceof Error) {
        if (error.name === "UnauthorizedError") {
          return fail(error.message, 401) as NextResponse<ApiResponse<TResponse>>;
        }
        if (error.name === "ForbiddenError") {
          return fail(error.message, 403) as NextResponse<ApiResponse<TResponse>>;
        }
        if (error.name === "NotFoundError") {
          return fail(error.message, 404) as NextResponse<ApiResponse<TResponse>>;
        }
        if (error.name === "ValidationError") {
          return fail(error.message, 400) as NextResponse<ApiResponse<TResponse>>;
        }
      }

      // Return generic server error
      const errorMessage = error instanceof Error ? error.message : "Internal server error";
      return serverError(errorMessage, {
        requestId,
        ...(process.env.NODE_ENV === "development" && {
          stack: error instanceof Error ? error.stack : undefined,
        }),
      }) as NextResponse<ApiResponse<TResponse>>;
    }
  };
}

/**
 * Convenience function for GET handlers
 */
export function createGetHandler<TResponse = unknown>(
  handler: (context: HandlerContext) => Promise<TResponse>,
  options?: HandlerOptions
): (
  req: NextRequest,
  context?: { params?: Record<string, string> }
) => Promise<NextResponse<ApiResponse<TResponse>>> {
  return createUniversalHandler(async (context) => {
    return handler(context);
  }, options) as (
    req: NextRequest,
    context?: { params?: Record<string, string> }
  ) => Promise<NextResponse<ApiResponse<TResponse>>>;
}

/**
 * Convenience function for POST handlers
 */
export function createPostHandler<TBody = unknown, TResponse = unknown>(
  handler: UniversalHandler<TBody, TResponse>,
  options?: HandlerOptions
): (
  req: NextRequest,
  context?: { params?: Record<string, string> }
) => Promise<NextResponse<ApiResponse<TResponse>>> {
  return createUniversalHandler(handler, options) as (
    req: NextRequest,
    context?: { params?: Record<string, string> }
  ) => Promise<NextResponse<ApiResponse<TResponse>>>;
}

/**
 * Convenience function for PUT handlers
 */
export function createPutHandler<TBody = unknown, TResponse = unknown>(
  handler: UniversalHandler<TBody, TResponse>,
  options?: HandlerOptions
): (
  req: NextRequest,
  context?: { params?: Record<string, string> }
) => Promise<NextResponse<ApiResponse<TResponse>>> {
  return createUniversalHandler(handler, options) as (
    req: NextRequest,
    context?: { params?: Record<string, string> }
  ) => Promise<NextResponse<ApiResponse<TResponse>>>;
}

/**
 * Convenience function for DELETE handlers
 */
export function createDeleteHandler<TResponse = unknown>(
  handler: (context: HandlerContext) => Promise<TResponse>,
  options?: HandlerOptions
): (
  req: NextRequest,
  context?: { params?: Record<string, string> }
) => Promise<NextResponse<ApiResponse<TResponse>>> {
  return createUniversalHandler(async (context) => {
    return handler(context);
  }, options) as (
    req: NextRequest,
    context?: { params?: Record<string, string> }
  ) => Promise<NextResponse<ApiResponse<TResponse>>>;
}
