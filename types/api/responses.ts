/**
 * Standardized API Response Types
 * All API responses should follow this structure
 */

export interface ApiSuccessResponse<T = unknown> {
  ok: true;
  data: T;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    hasMore?: boolean;
  };
}

export interface ApiErrorResponse {
  ok: false;
  error: string;
  message?: string;
  details?: Record<string, unknown>;
  code?: string;
}

export type ApiResponse<T = unknown> = ApiSuccessResponse<T> | ApiErrorResponse;

/**
 * Pagination metadata
 */
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}

/**
 * Paginated response
 */
export interface PaginatedResponse<T> extends ApiSuccessResponse<T[]> {
  meta: PaginationMeta;
}

/**
 * Success response helper
 */
export function successResponse<T>(data: T, meta?: ApiSuccessResponse<T>['meta']): ApiSuccessResponse<T> {
  return {
    ok: true,
    data,
    meta,
  };
}

/**
 * Error response helper
 */
export function errorResponse(
  error: string,
  message?: string,
  details?: Record<string, unknown>,
  code?: string
): ApiErrorResponse {
  return {
    ok: false,
    error,
    message,
    details,
    code,
  };
}

/**
 * Paginated response helper
 */
export function paginatedResponse<T>(
  data: T[],
  page: number,
  limit: number,
  total: number
): PaginatedResponse<T> {
  return {
    ok: true,
    data,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasMore: page * limit < total,
    },
  };
}

