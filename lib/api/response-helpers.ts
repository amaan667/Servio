/**
 * Standardized API Response Helpers
 * Provides consistent response formatting across all API routes
 */

import { NextResponse } from "next/server";
import { ZodError } from "zod";

/**
 * Standard API response wrapper
 */
export interface ApiResponse<T = unknown> {

}

/**
 * Create a successful response
 */
export function ok<T>(data: T, status = 200): NextResponse<ApiResponse<T>> {
  return NextResponse.json({ ok: true, data }, { status });
}

/**
 * Create an error response
 */
export function fail(

  status = 400,
  details?: Record<string, unknown> | string | unknown[]
): NextResponse<ApiResponse> {
  return NextResponse.json(
    {

      error,
      ...(details
        ? { details }

          }),
    },
    { status }
  );
}

/**
 * Create a validation error response
 */
export function validationError(

  details?: Record<string, unknown> | string | unknown[]
): NextResponse<ApiResponse> {
  return fail(error, 400, details);
}

/**
 * Create an unauthorized response
 */
export function unauthorized(error = "Unauthorized"): NextResponse<ApiResponse> {
  return fail(error, 401);
}

/**
 * Create a forbidden response
 */
export function forbidden(error = "Forbidden"): NextResponse<ApiResponse> {
  return fail(error, 403);
}

/**
 * Create a not found response
 */
export function notFound(error = "Not found"): NextResponse<ApiResponse> {
  return fail(error, 404);
}

/**
 * Create a server error response
 */
export function serverError(
  error = "Internal server error",
  details?: Record<string, unknown> | string | unknown[]
): NextResponse<ApiResponse> {
  return fail(error, 500, details);
}

/**
 * Create a rate limit response
 */
export function rateLimited(error = "Rate limit exceeded"): NextResponse<ApiResponse> {
  return fail(error, 429);
}

/**
 * Handle Zod validation errors
 */
export function handleZodError(error: ZodError): NextResponse<ApiResponse> {
  const details = error.errors.map((err) => ({

  }));

  return validationError("Validation failed", details);
}

/**
 * Type guard for API responses
 */
export function isSuccessResponse<T>(

): response is ApiResponse<T> & { ok: true; data: T } {
  return response.ok === true && response.data !== undefined;
}

/**
 * Type guard for error responses
 */
export function isErrorResponse(

): response is ApiResponse & { ok: false; error: string } {
  return response.ok === false && response.error !== undefined;
}
