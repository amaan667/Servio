/**
 * Unified API Error Handling Wrapper
 * Provides consistent error handling and typing for all API routes
 */

import { NextResponse } from 'next/server';
import { toError } from '@/lib/utils/errors';
import { logger } from '@/lib/logger';

/**
 * Wrap an API handler with consistent error handling and typing.
 * Automatically converts unknown errors to Error objects and logs them.
 *
 * @param handler - The API route handler function
 * @returns Wrapped handler with error handling
 *
 * @example
 * ```ts
 * export const POST = withErrorHandling(async (req: NextRequest) => {
 *   const body = await req.json();
 *   // ... your logic
 *   return NextResponse.json({ ok: true });
 * });
 * ```
 */
export function withErrorHandling<
  T extends (...args: any[]) => Promise<Response>,
>(handler: T): T {
  return (async (...args: any[]) => {
    try {
      return await handler(...args);
    } catch (e: unknown) {
      const err = toError(e);
      logger.error('API route failed', err instanceof Error ? err : { error: String(err) });
      return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 });
    }
  }) as T;
}

/**
 * Type-safe API response builder
 */
export class ApiResponseBuilder {
  static success<T>(
    data: T,
    status = 200
  ): NextResponse<{ ok: true; data: T }> {
    return NextResponse.json({ ok: true, data }, { status });
  }

  static error(
    message: string,
    status = 500
  ): NextResponse<{ ok: false; error: string }> {
    return NextResponse.json({ ok: false, error: message }, { status });
  }

  static unauthorized(
    message = 'Unauthorized'
  ): NextResponse<{ ok: false; error: string }> {
    return NextResponse.json({ ok: false, error: message }, { status: 401 });
  }

  static forbidden(
    message = 'Forbidden'
  ): NextResponse<{ ok: false; error: string }> {
    return NextResponse.json({ ok: false, error: message }, { status: 403 });
  }

  static notFound(
    message = 'Not found'
  ): NextResponse<{ ok: false; error: string }> {
    return NextResponse.json({ ok: false, error: message }, { status: 404 });
  }

  static badRequest(
    message: string
  ): NextResponse<{ ok: false; error: string }> {
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
