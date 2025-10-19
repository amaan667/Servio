/**
 * API Route Wrapper
 * Provides consistent patterns for API routes
 */

import { NextRequest, NextResponse } from 'next/server';
import { asyncHandler, createSuccessResponse, createErrorResponse } from './response-helpers';
import { ApiError, UnauthorizedError, ForbiddenError } from '@/types/api/errors';

/**
 * Authorized context for route handlers
 */
export interface AuthorizedContext {
  userId: string;
  venueId: string;
  role: string;
}

/**
 * Create an authenticated route handler
 */
export function withAuth<T extends unknown[]>(
  handler: (req: NextRequest, context: AuthorizedContext, ...args: T) => Promise<NextResponse>
) {
  return asyncHandler(async (req: NextRequest, ...args: T) => {
    // TODO: Implement actual auth logic
    // For now, this is a placeholder
    const authHeader = req.headers.get('authorization');
    
    if (!authHeader) {
      throw new UnauthorizedError('Missing authorization header');
    }
    
    // Placeholder - will be replaced with actual auth logic
    const context: AuthorizedContext = {
      userId: 'user-id',
      venueId: 'venue-id',
      role: 'owner',
    };
    
    return handler(req, context, ...args);
  });
}

/**
 * Create a public route handler (no auth required)
 */
export function withPublic<T extends unknown[]>(
  handler: (req: NextRequest, ...args: T) => Promise<NextResponse>
) {
  return asyncHandler(handler);
}

/**
 * Create a GET handler
 */
export function GET<T extends unknown[]>(
  handler: (req: NextRequest, ...args: T) => Promise<NextResponse>
) {
  return asyncHandler(handler);
}

/**
 * Create a POST handler
 */
export function POST<T extends unknown[]>(
  handler: (req: NextRequest, ...args: T) => Promise<NextResponse>
) {
  return asyncHandler(handler);
}

/**
 * Create a PUT handler
 */
export function PUT<T extends unknown[]>(
  handler: (req: NextRequest, ...args: T) => Promise<NextResponse>
) {
  return asyncHandler(handler);
}

/**
 * Create a PATCH handler
 */
export function PATCH<T extends unknown[]>(
  handler: (req: NextRequest, ...args: T) => Promise<NextResponse>
) {
  return asyncHandler(handler);
}

/**
 * Create a DELETE handler
 */
export function DELETE<T extends unknown[]>(
  handler: (req: NextRequest, ...args: T) => Promise<NextResponse>
) {
  return asyncHandler(handler);
}

