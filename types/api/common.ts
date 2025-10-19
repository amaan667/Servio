/**
 * Common API Type Definitions
 * Provides standardized types for API requests and responses
 */

/**
 * Standard API response type
 * Use this for all API endpoints to ensure consistent response structure
 *
 * @example
 * ```ts
 * const response: ApiResponse<User> = { ok: true, data: user };
 * ```
 */
export type ApiResponse<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

/**
 * Paginated response type
 * Use this for endpoints that return paginated data
 *
 * @example
 * ```ts
 * const response: Paginated<Order> = {
 *   data: orders,
 *   total: 100,
 *   page: 1,
 *   pageSize: 20
 * };
 * ```
 */
export interface Paginated<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

/**
 * Pagination parameters for API requests
 */
export interface PaginationParams {
  page?: number;
  pageSize?: number;
}

/**
 * Standard error response
 */
export interface ErrorResponse {
  ok: false;
  error: string;
  details?: Record<string, unknown>;
}

/**
 * Standard success response
 */
export interface SuccessResponse<T> {
  ok: true;
  data: T;
}

/**
 * API route handler context
 */
export interface ApiContext {
  userId?: string;
  venueId?: string;
  role?: string;
}

/**
 * Standard API metadata
 */
export interface ApiMetadata {
  timestamp: string;
  version?: string;
  requestId?: string;
}
