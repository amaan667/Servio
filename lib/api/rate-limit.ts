/**
 * Rate Limiting Middleware
 * Implements token bucket algorithm for API rate limiting
 */

import { NextRequest, NextResponse } from "next/server";

interface RateLimitConfig {
  interval: number; // Time window in ms
  uniqueTokenPerInterval: number; // Max requests per interval
}

interface TokenBucket {
  tokens: number;
  lastRefill: number;
}

const rateLimitStore = new Map<string, TokenBucket>();

/**
 * Rate limit configuration by route type
 */
export const RATE_LIMITS = {
  // Public endpoints - stricter limits
  public: { interval: 60 * 1000, uniqueTokenPerInterval: 30 }, // 30 req/min

  // Authenticated endpoints - moderate limits
  authenticated: { interval: 60 * 1000, uniqueTokenPerInterval: 100 }, // 100 req/min

  // Admin endpoints - generous limits
  admin: { interval: 60 * 1000, uniqueTokenPerInterval: 300 }, // 300 req/min

  // AI/LLM endpoints - very strict (expensive operations)
  ai: { interval: 60 * 1000, uniqueTokenPerInterval: 10 }, // 10 req/min

  // Stripe webhooks - generous (trusted source)
  webhook: { interval: 60 * 1000, uniqueTokenPerInterval: 1000 }, // 1000 req/min
} as const;

/**
 * Get client identifier from request
 */
function getClientId(_request: NextRequest): string {
  // Try to get user ID from session/auth
  const authHeader = _request.headers.get("authorization");
  if (authHeader) {
    return `auth:${authHeader.slice(0, 32)}`;
  }

  // Fall back to IP address
  const forwarded = _request.headers.get("x-forwarded-for");
  const ip = forwarded ? forwarded.split(",")[0] : _request.headers.get("x-real-ip") || "unknown";

  return `ip:${ip}`;
}

/**
 * Check rate limit for a request
 */
export function checkRateLimit(
  _request: NextRequest,
  config: RateLimitConfig = RATE_LIMITS.authenticated
): { allowed: boolean; remaining: number; resetAt: number } {
  const clientId = getClientId(_request);
  const now = Date.now();

  // Get or create token bucket for this client
  let bucket = rateLimitStore.get(clientId);

  if (!bucket) {
    bucket = {
      tokens: config.uniqueTokenPerInterval,
      lastRefill: now,
    };
    rateLimitStore.set(clientId, bucket);
  }

  // Refill tokens based on time elapsed
  const timePassed = now - bucket.lastRefill;
  const refillAmount = Math.floor((timePassed / config.interval) * config.uniqueTokenPerInterval);

  if (refillAmount > 0) {
    bucket.tokens = Math.min(config.uniqueTokenPerInterval, bucket.tokens + refillAmount);
    bucket.lastRefill = now;
  }

  // Check if request is allowed
  if (bucket.tokens > 0) {
    bucket.tokens--;
    return {
      allowed: true,
      remaining: bucket.tokens,
      resetAt: bucket.lastRefill + config.interval,
    };
  }

  return {
    allowed: false,
    remaining: 0,
    resetAt: bucket.lastRefill + config.interval,
  };
}

/**
 * Rate limit middleware wrapper
 */
export function withRateLimit(
  handler: (_request: NextRequest) => Promise<NextResponse>,
  config: RateLimitConfig = RATE_LIMITS.authenticated
) {
  return async (_request: NextRequest): Promise<NextResponse> => {
    const { allowed, remaining, resetAt } = checkRateLimit(_request, config);

    if (!allowed) {
      return NextResponse.json(
        {
          error: "Rate limit exceeded",
          retryAfter: Math.ceil((resetAt - Date.now()) / 1000),
        },
        {
          status: 429,
          headers: {
            "X-RateLimit-Limit": config.uniqueTokenPerInterval.toString(),
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": resetAt.toString(),
            "Retry-After": Math.ceil((resetAt - Date.now()) / 1000).toString(),
          },
        }
      );
    }

    const response = await handler(_request);

    // Add rate limit headers to response
    response.headers.set("X-RateLimit-Limit", config.uniqueTokenPerInterval.toString());
    response.headers.set("X-RateLimit-Remaining", remaining.toString());
    response.headers.set("X-RateLimit-Reset", resetAt.toString());

    return response;
  };
}

// Cleanup old entries every 10 minutes
if (typeof setInterval !== "undefined") {
  setInterval(
    () => {
      const now = Date.now();
      for (const [key, bucket] of rateLimitStore.entries()) {
        // Remove buckets that haven't been used in 1 hour
        if (now - bucket.lastRefill > 60 * 60 * 1000) {
          rateLimitStore.delete(key);
        }
      }
    },
    10 * 60 * 1000
  );
}
