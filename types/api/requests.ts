/**
 * Standardized API Request Types
 * All API request bodies should follow these patterns
 */

import { z } from 'zod';

/**
 * Pagination parameters
 */
export interface PaginationParams {
  page?: number;
  limit?: number;
}

/**
 * Sort parameters
 */
export interface SortParams {
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * Date range parameters
 */
export interface DateRangeParams {
  startDate?: string;
  endDate?: string;
}

/**
 * Common query parameters
 */
export interface QueryParams extends PaginationParams, SortParams, DateRangeParams {
  search?: string;
  filter?: Record<string, unknown>;
}

/**
 * Zod schemas for validation
 */
export const PaginationSchema = z.object({
  page: z.number().int().positive().optional().default(1),
  limit: z.number().int().positive().max(100).optional().default(20),
});

export const SortSchema = z.object({
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

export const DateRangeSchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

export const QueryParamsSchema = PaginationSchema.merge(SortSchema).merge(DateRangeSchema).extend({
  search: z.string().optional(),
  filter: z.record(z.unknown()).optional(),
});

/**
 * Generic request with body
 */
export interface RequestWithBody<T = unknown> {
  body: T;
}

/**
 * Generic request with params
 */
export interface RequestWithParams<T = Record<string, string>> {
  params: T;
}

/**
 * Generic request with query
 */
export interface RequestWithQuery<T = Record<string, string>> {
  query: T;
}

/**
 * Generic request with all
 */
export interface RequestWithAll<TBody = unknown, TParams = Record<string, string>, TQuery = Record<string, string>> {
  body: TBody;
  params: TParams;
  query: TQuery;
}

