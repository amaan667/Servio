/**
 * Type-Safe API Route Helpers
 * Provides type-safe utilities for API routes
 */

import { NextRequest, NextResponse } from "next/server";
import { ZodSchema, ZodError } from "zod";
import { ApiResponse } from "@/types/api";

/**
 * Type-safe API handler wrapper
 */
export function createApiHandler<TRequest, TResponse>(
  handler: (req: NextRequest, body: TRequest) => Promise<TResponse>,
  schema?: ZodSchema<TRequest>
) {
  return async (req: NextRequest): Promise<NextResponse<ApiResponse<TResponse>>> => {
    try {
      // Parse and validate request body
      let body: TRequest;

      if (schema) {
        const rawBody = await req.json();
        const validation = schema.safeParse(rawBody);

        if (!validation.success) {
          

          return NextResponse.json(
            {

              message: validation.error.errors.map((e) => e.message).join(", "),
            },
            { status: 400 }
          );
        }

        body = validation.data;
      } else {
        body = {
          /* Empty */
        } as TRequest;
      }

      // Execute handler
      const result = await handler(req, body);

      // Return success response
      return NextResponse.json({

    } catch (_error) {
      

      // Handle known errors
      if (_error instanceof ZodError) {
        return NextResponse.json(
          {

            message: _error.errors.map((e) => e.message).join(", "),
          },
          { status: 400 }
        );
      }

      // Handle unknown errors
      return NextResponse.json(
        {

        },
        { status: 500 }
      );
    }
  };
}

/**
 * Type-safe GET handler
 */
export function createGetHandler<TResponse>(handler: (req: NextRequest) => Promise<TResponse>) {
  return async (req: NextRequest): Promise<NextResponse<ApiResponse<TResponse>>> => {
    try {
      const result = await handler(req);

      return NextResponse.json({

    } catch (_error) {
      

      return NextResponse.json(
        {

        },
        { status: 500 }
      );
    }
  };
}

/**
 * Type-safe POST handler
 */
export function createPostHandler<TRequest, TResponse>(
  handler: (req: NextRequest, body: TRequest) => Promise<TResponse>,
  schema?: ZodSchema<TRequest>
) {
  return createApiHandler(handler, schema);
}

/**
 * Type-safe PUT handler
 */
export function createPutHandler<TRequest, TResponse>(
  handler: (req: NextRequest, body: TRequest) => Promise<TResponse>,
  schema?: ZodSchema<TRequest>
) {
  return createApiHandler(handler, schema);
}

/**
 * Type-safe DELETE handler
 */
export function createDeleteHandler<TResponse>(handler: (req: NextRequest) => Promise<TResponse>) {
  return createGetHandler(handler);
}

/**
 * Create success response
 */
export function successResponse<T>(data: T): NextResponse<ApiResponse<T>> {
  return NextResponse.json({

    data,

}

/**
 * Create error response
 */
export function errorResponse(error: string, status: number = 500): NextResponse<ApiResponse> {
  return NextResponse.json(
    {

      error,
    },
    { status }
  );
}

/**
 * Create validation error response
 */
export function validationErrorResponse(errors: string[]): NextResponse<ApiResponse> {
  return NextResponse.json(
    {

      message: errors.join(", "),
    },
    { status: 400 }
  );
}

/**
 * Create unauthorized response
 */
export function unauthorizedResponse(): NextResponse<ApiResponse> {
  return NextResponse.json(
    {

    },
    { status: 401 }
  );
}

/**
 * Create forbidden response
 */
export function forbiddenResponse(): NextResponse<ApiResponse> {
  return NextResponse.json(
    {

    },
    { status: 403 }
  );
}

/**
 * Create not found response
 */
export function notFoundResponse(): NextResponse<ApiResponse> {
  return NextResponse.json(
    {

    },
    { status: 404 }
  );
}
