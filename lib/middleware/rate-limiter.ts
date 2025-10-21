/**
 * @fileoverview Global rate limiter middleware for API routes
 * @module lib/middleware/rate-limiter
 */

import { NextRequest, NextResponse } from 'next/server';
import { RateLimiter } from '@/lib/api/rate-limit';

// Create rate limiters for different API tiers
const rateLimiters = {
  // Strict: 10 requests per minute
  strict: new RateLimiter({ maxTokens: 10, refillRate: 10 / 60 }),
  // Standard: 60 requests per minute
  standard: new RateLimiter({ maxTokens: 60, refillRate: 1 }),
  // Relaxed: 120 requests per minute
  relaxed: new RateLimiter({ maxTokens: 120, refillRate: 2 }),
  // Public: 30 requests per minute (for unauthenticated endpoints)
  public: new RateLimiter({ maxTokens: 30, refillRate: 0.5 }),
};

export type RateLimitTier = keyof typeof rateLimiters;

/**
 * Get client identifier from request (IP + User ID if authenticated)
 */
function getClientId(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0] : req.headers.get('x-real-ip') || 'unknown';
  
  // Try to get user ID from Authorization header if present
  const authHeader = req.headers.get('authorization');
  const userId = authHeader ? authHeader.split('Bearer ')[1]?.slice(0, 8) : null;
  
  return userId ? `${ip}-${userId}` : ip;
}

/**
 * Rate limit middleware wrapper
 */
export function withRateLimit(
  tier: RateLimitTier = 'standard'
) {
  return async (
    handler: (req: NextRequest, ...args: unknown[]) => Promise<NextResponse>,
    req: NextRequest,
    ...args: unknown[]
  ): Promise<NextResponse> => {
    const clientId = getClientId(req);
    const limiter = rateLimiters[tier];

    if (!limiter.tryConsume(clientId)) {
      return NextResponse.json(
        {
          error: 'Too Many Requests',
          message: 'Rate limit exceeded. Please try again later.',
          retryAfter: 60,
        },
        {
          status: 429,
          headers: {
            'Retry-After': '60',
            'X-RateLimit-Limit': limiter.maxTokens.toString(),
            'X-RateLimit-Remaining': '0',
          },
        }
      );
    }

    const response = await handler(req, ...args);
    
    // Add rate limit headers to response
    response.headers.set('X-RateLimit-Limit', limiter.maxTokens.toString());
    response.headers.set('X-RateLimit-Tier', tier);
    
    return response;
  };
}

/**
 * Apply rate limiting to a route handler
 */
export function rateLimit(tier: RateLimitTier = 'standard') {
  return function <T extends (...args: any[]) => Promise<NextResponse>>(
    target: T
  ): T {
    return (async (...args: Parameters<T>) => {
      const req = args[0] as NextRequest;
      const clientId = getClientId(req);
      const limiter = rateLimiters[tier];

      if (!limiter.tryConsume(clientId)) {
        return NextResponse.json(
          {
            error: 'Too Many Requests',
            message: 'Rate limit exceeded. Please try again later.',
            retryAfter: 60,
          },
          {
            status: 429,
            headers: {
              'Retry-After': '60',
              'X-RateLimit-Limit': limiter.maxTokens.toString(),
              'X-RateLimit-Remaining': '0',
            },
          }
        );
      }

      const response = await target(...args);
      
      // Add rate limit headers
      if (response instanceof NextResponse) {
        response.headers.set('X-RateLimit-Limit', limiter.maxTokens.toString());
        response.headers.set('X-RateLimit-Tier', tier);
      }
      
      return response;
    }) as T;
  };
}
