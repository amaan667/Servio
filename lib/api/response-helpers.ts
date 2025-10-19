/**
 * API Response Helpers
 * Standardized response formatting for all API routes
 */

import { NextResponse } from 'next/server';
import {
  ApiSuccessResponse,
  ApiErrorResponse,
  successResponse,
  errorResponse,
  paginatedResponse,
  PaginationMeta,
} from '@/types/api/responses';
import {
  ApiError,
  formatError,
  getStatusCodeFromError,
} from '@/types/api/errors';

/**
 * Create a success response
 */
export function createSuccessResponse<T>(data: T, meta?: ApiSuccessResponse<T>['meta']) {
  return NextResponse.json(successResponse(data, meta));
}

/**
 * Create an error response
 */
export function createErrorResponse(
  error: string,
  message?: string,
  details?: Record<string, unknown>,
  code?: string,
  status: number = 500
) {
  return NextResponse.json(errorResponse(error, message, details, code), { status });
}

/**
 * Create a paginated response
 */
export function createPaginatedResponse<T>(
  data: T[],
  page: number,
  limit: number,
  total: number
) {
  return NextResponse.json(paginatedResponse(data, page, limit, total));
}

/**
 * Handle errors and create appropriate response
 */
export function handleError(error: unknown): NextResponse {
  const statusCode = getStatusCodeFromError(error);
  const formattedError = formatError(error);
  
  return NextResponse.json(
    errorResponse(
      formattedError.code,
      formattedError.message,
      formattedError.details
    ),
    { status: statusCode }
  );
}

/**
 * Async handler wrapper that catches errors
 */
export function asyncHandler<T extends unknown[]>(
  handler: (...args: T) => Promise<NextResponse>
) {
  return async (...args: T): Promise<NextResponse> => {
    try {
      return await handler(...args);
    } catch (error) {
      return handleError(error);
    }
  };
}

/**
 * Validate request body with Zod schema
 */
export async function validateBody<T>(
  request: Request,
  schema: { parse: (data: unknown) => T }
): Promise<{ success: true; data: T } | { success: false; error: NextResponse }> {
  try {
    const body = await request.json();
    const data = schema.parse(body);
    return { success: true, data };
  } catch (error) {
    if (error && typeof error === 'object' && 'issues' in error) {
      // Zod validation error
      return {
        success: false,
        error: createErrorResponse(
          'VALIDATION_ERROR',
          'Invalid request data',
          { issues: (error as { issues: unknown }).issues },
          'VALIDATION_ERROR',
          400
        ),
      };
    }
    return {
      success: false,
      error: createErrorResponse(
        'INVALID_INPUT',
        'Invalid JSON in request body',
        undefined,
        'INVALID_INPUT',
        400
      ),
    };
  }
}

/**
 * Validate query parameters with Zod schema
 */
export function validateQuery<T>(
  query: URLSearchParams,
  schema: { parse: (data: unknown) => T }
): { success: true; data: T } | { success: false; error: NextResponse } {
  try {
    const params = Object.fromEntries(query.entries());
    const data = schema.parse(params);
    return { success: true, data };
  } catch (error) {
    if (error && typeof error === 'object' && 'issues' in error) {
      return {
        success: false,
        error: createErrorResponse(
          'VALIDATION_ERROR',
          'Invalid query parameters',
          { issues: (error as { issues: unknown }).issues },
          'VALIDATION_ERROR',
          400
        ),
      };
    }
    return {
      success: false,
      error: createErrorResponse(
        'INVALID_INPUT',
        'Invalid query parameters',
        undefined,
        'INVALID_INPUT',
        400
      ),
    };
  }
}

/**
 * Get authenticated user from request
 */
export async function getAuthUser(request: Request) {
  // This will be implemented with actual auth logic
  // For now, it's a placeholder
  return null;
}

/**
 * Require authentication
 */
export async function requireAuth(request: Request) {
  const user = await getAuthUser(request);
  if (!user) {
    throw new ApiError('UNAUTHORIZED', 'Authentication required', 401);
  }
  return user;
}

