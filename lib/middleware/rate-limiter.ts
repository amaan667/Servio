/**
 * @fileoverview Global rate limiter middleware for API routes
 * @module lib/middleware/rate-limiter
 */

import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, RATE_LIMITS } from "@/lib/api/rate-limit";

// Create rate limiters for different API tiers (using checkRateLimit function)
// Note: RateLimiter class was removed, using checkRateLimit function instead
const getRateLimitConfig = (tier: "strict" | "pro" | "enterprise") => {
  switch (tier) {
    case "strict":
      return RATE_LIMITS.public;
    case "pro":
      return RATE_LIMITS.authenticated;
    case "enterprise":
      return RATE_LIMITS.admin;
    default:
      return RATE_LIMITS.authenticated;
  }
};

export type RateLimitTier = "strict" | "pro" | "enterprise";

/**
 * Get client identifier from request (IP + User ID if authenticated)
 */
function getClientId(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  const ip = forwarded ? forwarded.split(",")[0] : req.headers.get("x-real-ip") || "unknown";

  // Try to get user ID from Authorization header if present
  const authHeader = req.headers.get("authorization");
  const userId = authHeader ? authHeader.split("Bearer ")[1]?.slice(0, 8) : null;

  return userId ? `${ip}-${userId}` : ip;
}

/**
 * Rate limit middleware wrapper
 */
export function withRateLimit(tier: RateLimitTier = "pro") {
  return async (
    handler: (req: NextRequest, ...args: unknown[]) => Promise<NextResponse>,
    req: NextRequest,
    ...args: unknown[]
  ): Promise<NextResponse> => {
    const clientId = getClientId(req);
    const config = getRateLimitConfig(tier);
    const { allowed } = checkRateLimit(req, config);

    if (!allowed) {
      return NextResponse.json(
        {
          error: "Too Many Requests",
          message: "Rate limit exceeded. Please try again later.",
          retryAfter: 60,
        },
        {
          status: 429,
          headers: {
            "Retry-After": "60",
            "X-RateLimit-Limit": config.uniqueTokenPerInterval.toString(),
            "X-RateLimit-Remaining": "0",
          },
        }
      );
    }

    const response = await handler(req, ...args);

    // Add rate limit headers to response
    response.headers.set("X-RateLimit-Limit", config.uniqueTokenPerInterval.toString());
    response.headers.set("X-RateLimit-Tier", tier);

    return response;
  };
}

/**
 * Apply rate limiting to a route handler
 */
export function rateLimit(tier: RateLimitTier = "pro") {
  return function <T extends (...args: unknown[]) => Promise<NextResponse>>(target: T): T {
    return (async (...args: Parameters<T>) => {
      const req = args[0] as NextRequest;
      const config = getRateLimitConfig(tier);
      const { allowed } = checkRateLimit(req, config);

      if (!allowed) {
        return NextResponse.json(
          {
            error: "Too Many Requests",
            message: "Rate limit exceeded. Please try again later.",
            retryAfter: 60,
          },
          {
            status: 429,
            headers: {
              "Retry-After": "60",
              "X-RateLimit-Limit": config.uniqueTokenPerInterval.toString(),
              "X-RateLimit-Remaining": "0",
            },
          }
        );
      }

      const response = await target(...args);

      // Add rate limit headers
      if (response instanceof NextResponse) {
        response.headers.set("X-RateLimit-Limit", config.uniqueTokenPerInterval.toString());
        response.headers.set("X-RateLimit-Tier", tier);
      }

      return response;
    }) as T;
  };
}
