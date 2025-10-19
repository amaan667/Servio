/**
 * Rate Limiting Middleware
 * Protects API endpoints from abuse
 */

import { NextRequest } from 'next/server';
import { Redis } from 'ioredis';
import { logger } from '@/lib/logger';

// Singleton Redis client (reuse from cache)
let redisClient: Redis | null = null;

function getRedisClient(): Redis | null {
  if (redisClient) return redisClient;

  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    logger.warn('[RATE LIMIT] REDIS_URL not configured, rate limiting disabled');
    return null;
  }

  try {
    redisClient = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
    });

    return redisClient;
  } catch (error) {
    logger.error('[RATE LIMIT] Failed to create client:', { error });
    return null;
  }
}

/**
 * Rate limit configuration
 */
export interface RateLimitConfig {
  limit: number; // Number of requests allowed
  window: number; // Time window in seconds
  keyPrefix?: string; // Prefix for rate limit keys
}

/**
 * Default rate limit configurations
 */
export const RateLimits = {
  // Public endpoints
  PUBLIC: { limit: 60, window: 60 },
  // Authenticated endpoints
  AUTHENTICATED: { limit: 120, window: 60 },
  // High-frequency endpoints (e.g., live orders)
  HIGH_FREQUENCY: { limit: 300, window: 60 },
  // Stripe webhooks
  WEBHOOK: { limit: 1000, window: 60 },
} as const;

/**
 * Check if a request should be rate limited
 */
export async function checkRateLimit(
  identifier: string,
  config: RateLimitConfig = RateLimits.PUBLIC
): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
  const redis = getRedisClient();

  // If Redis is not available, allow all requests
  if (!redis) {
    return {
      allowed: true,
      remaining: config.limit,
      resetAt: Date.now() + config.window * 1000,
    };
  }

  const { limit, window, keyPrefix = 'ratelimit' } = config;
  const key = `${keyPrefix}:${identifier}`;

  try {
    // Use sliding window counter
    const now = Math.floor(Date.now() / 1000);
    const bucket = Math.floor(now / window);
    const bucketKey = `${key}:${bucket}`;

    // Increment counter for current bucket
    const count = await redis.incr(bucketKey);
    await redis.expire(bucketKey, window * 2); // Keep for 2 windows

    // Check if limit exceeded
    const allowed = count <= limit;
    const remaining = Math.max(0, limit - count);
    const resetAt = (bucket + 1) * window * 1000;

    if (!allowed) {
      logger.warn('[RATE LIMIT] Request blocked', {
        identifier,
        count,
        limit,
        window,
      });
    }

    return { allowed, remaining, resetAt };
  } catch (error) {
    logger.error('[RATE LIMIT ERROR]', { identifier, error });
    // On error, allow the request
    return {
      allowed: true,
      remaining: config.limit,
      resetAt: Date.now() + config.window * 1000,
    };
  }
}

/**
 * Get client identifier from request
 */
export function getClientIdentifier(req: NextRequest): string {
  // Try to get IP from various headers
  const forwardedFor = req.headers.get('x-forwarded-for');
  const realIp = req.headers.get('x-real-ip');
  const ip = forwardedFor?.split(',')[0] || realIp || 'unknown';

  // Try to get user ID from auth header
  const authHeader = req.headers.get('authorization');
  const userId = authHeader ? `user:${authHeader.slice(0, 10)}` : null;

  return userId || `ip:${ip}`;
}

/**
 * Create rate limit middleware
 */
export function createRateLimitMiddleware(config: RateLimitConfig) {
  return async (req: NextRequest): Promise<Response | null> => {
    const identifier = getClientIdentifier(req);
    const result = await checkRateLimit(identifier, config);

    if (!result.allowed) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: 'Rate limit exceeded',
          retryAfter: Math.ceil((result.resetAt - Date.now()) / 1000),
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'X-RateLimit-Limit': config.limit.toString(),
            'X-RateLimit-Remaining': result.remaining.toString(),
            'X-RateLimit-Reset': result.resetAt.toString(),
            'Retry-After': Math.ceil(
              (result.resetAt - Date.now()) / 1000
            ).toString(),
          },
        }
      );
    }

    return null; // Continue to next middleware
  };
}

/**
 * Rate limit decorator for API routes
 */
export function withRateLimit(config: RateLimitConfig) {
  return async function rateLimitCheck(req: NextRequest): Promise<Response | null> {
    return createRateLimitMiddleware(config)(req);
  };
}

/**
 * Get rate limit info for a client
 */
export async function getRateLimitInfo(
  identifier: string,
  config: RateLimitConfig = RateLimits.PUBLIC
): Promise<{
  limit: number;
  remaining: number;
  resetAt: number;
}> {
  const result = await checkRateLimit(identifier, config);
  return {
    limit: config.limit,
    remaining: result.remaining,
    resetAt: result.resetAt,
  };
}

