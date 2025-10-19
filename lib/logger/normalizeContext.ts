/**
 * Context Normalization for Logger
 * Converts various input types to a consistent Record<string, unknown> format
 */

import { LogContext } from '@/types/logger';
import { getErrorMessage } from '@/lib/utils/errors';

/**
 * Normalizes log context to a consistent object format
 * Handles primitives, Errors, and objects safely
 *
 * @param ctx - The log context to normalize
 * @returns A normalized object suitable for logging
 */
export function normalizeContext(ctx?: LogContext): Record<string, unknown> {
  // Handle undefined/null
  if (!ctx) return {};

  // Handle boolean (not useful as context, return empty)
  if (typeof ctx === 'boolean') return {};

  // Handle Error objects - extract message and stack
  if (ctx instanceof Error) {
    return {
      error: getErrorMessage(ctx),
      stack: ctx.stack,
      name: ctx.name,
    };
  }

  // Handle string primitives
  if (typeof ctx === 'string') {
    return { message: ctx };
  }

  // Handle number primitives
  if (typeof ctx === 'number') {
    return { value: ctx };
  }

  // Handle objects (including arrays)
  if (typeof ctx === 'object') {
    return ctx as Record<string, unknown>;
  }

  // Fallback for any other type
  return { value: String(ctx) };
}
