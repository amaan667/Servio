/**
 * Rate Limiting Utilities
 * Provides rate limiting for API endpoints to prevent abuse
 */

import { NextRequest } from "next/server";
import { logger } from "@/lib/logger";

interface RateLimitOptions {
  limit: number; // Maximum number of requests
  window: number; // Time window in seconds
  identifier?: string; // Custom identifier (defaults to IP)
}

interface RateLimitResult {
  success: boolean;
  remaining: number;
  reset: number;
  limit: number;
}

// In-memory rate limit store (for single-instance deployments)
// For multi-instance, use Redis or similar
const rateLimitStore = new Map<string, { count: number; reset: number }>();

// Cleanup expired entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of rateLimitStore.entries()) {
    if (value.reset < now) {
      rateLimitStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

/**
 * Get client identifier from request
 */
function getClientIdentifier(req: NextRequest): string {
  // Try to get user ID from auth header/cookie first
  const authHeader = req.headers.get("authorization");
  if (authHeader) {
    // Extract user ID from token if possible
    // For now, fall back to IP
  }

  // Fall back to IP address
  const forwarded = req.headers.get("x-forwarded-for");
  const ip = forwarded ? forwarded.split(",")[0] : req.headers.get("x-real-ip") || "unknown";

  return ip;
}

/**
 * Rate limit check
 */
export async function rateLimit(
  req: NextRequest,
  options: RateLimitOptions
): Promise<RateLimitResult> {
  const identifier = options.identifier || getClientIdentifier(req);
  const key = `${identifier}:${options.limit}:${options.window}`;
  const now = Date.now();
  const reset = now + options.window * 1000;

  const current = rateLimitStore.get(key);

  if (!current || current.reset < now) {
    // First request or window expired
    rateLimitStore.set(key, { count: 1, reset });
    return {
      success: true,
      remaining: options.limit - 1,
      reset,
      limit: options.limit,
    };
  }

  if (current.count >= options.limit) {
    // Rate limit exceeded
    logger.warn("[RATE LIMIT] Rate limit exceeded", {
      identifier,
      limit: options.limit,
      window: options.window,
      count: current.count,
    });
    return {
      success: false,
      remaining: 0,
      reset: current.reset,
      limit: options.limit,
    };
  }

  // Increment count
  current.count++;
  rateLimitStore.set(key, current);

  return {
    success: true,
    remaining: options.limit - current.count,
    reset: current.reset,
    limit: options.limit,
  };
}

/**
 * Rate limit middleware for API routes
 */
export function withRateLimit(options: RateLimitOptions) {
  return async (req: NextRequest): Promise<Response | null> => {
    const result = await rateLimit(req, options);

    if (!result.success) {
      return new Response(
        JSON.stringify({
          error: "Too many requests",
          message: `Rate limit exceeded. Try again in ${Math.ceil((result.reset - Date.now()) / 1000)} seconds.`,
          retryAfter: Math.ceil((result.reset - Date.now()) / 1000),
        }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "X-RateLimit-Limit": result.limit.toString(),
            "X-RateLimit-Remaining": result.remaining.toString(),
            "X-RateLimit-Reset": result.reset.toString(),
            "Retry-After": Math.ceil((result.reset - Date.now()) / 1000).toString(),
          },
        }
      );
    }

    // Add rate limit headers to response
    req.headers.set("X-RateLimit-Limit", result.limit.toString());
    req.headers.set("X-RateLimit-Remaining", result.remaining.toString());
    req.headers.set("X-RateLimit-Reset", result.reset.toString());

    return null; // Continue to handler
  };
}

/**
 * Predefined rate limit configurations
 */
export const RATE_LIMITS = {
  AUTH: { limit: 10, window: 60 }, // 10 requests per minute
  PAYMENT: { limit: 20, window: 60 }, // 20 requests per minute
  ORDER_CREATE: { limit: 30, window: 60 }, // 30 requests per minute
  GENERAL: { limit: 100, window: 60 }, // 100 requests per minute
  STRICT: { limit: 5, window: 60 }, // 5 requests per minute
} as const;
