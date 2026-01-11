/**
 * Rate Limiting Utilities
 * Provides rate limiting for API endpoints to prevent abuse
 * Uses Redis when available, falls back to in-memory store
 */

import { NextRequest } from "next/server";

import { env } from "@/lib/env";

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

// In-memory rate limit store (fallback when Redis unavailable)
const rateLimitStore = new Map<string, { count: number; reset: number }>();

// Redis client (lazy initialized)
// Using unknown type for Redis client to avoid type issues with dynamic import
// The client is only used for its methods (incr, expire) which we verify exist
let redisClient: {
  incr: (key: string) => Promise<number>;
  expire: (key: string, seconds: number) => Promise<number>;
} | null = null;
let redisInitialized = false;

async function getRedisClient() {
  if (redisClient) return redisClient;
  if (redisInitialized) return null;

  redisInitialized = true;
  const redisUrl = env("REDIS_URL");

  if (!redisUrl) {

    return null;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Redis = require("ioredis");
    const client = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times: number) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      lazyConnect: true,
    });

    await client.connect();
    redisClient = client;

    return client;
  } catch (error) {

    return null;
  }
}

// Cleanup expired entries every 5 minutes (in-memory only)
setInterval(
  () => {
    const now = Date.now();
    for (const [key, value] of rateLimitStore.entries()) {
      if (value.reset < now) {
        rateLimitStore.delete(key);
      }
    }
  },
  5 * 60 * 1000
);

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
 * Uses Redis when available, falls back to in-memory store
 */
export async function rateLimit(
  req: NextRequest,
  options: RateLimitOptions
): Promise<RateLimitResult> {
  const identifier = options.identifier || getClientIdentifier(req);
  const key = `ratelimit:${identifier}:${options.limit}:${options.window}`;
  const now = Date.now();
  const reset = now + options.window * 1000;

  // Try Redis first
  const redis = await getRedisClient();
  if (redis) {
    try {
      // Use sliding window with Redis
      const bucket = Math.floor(now / 1000 / options.window);
      const bucketKey = `${key}:${bucket}`;

      // Increment counter for current bucket
      const count = await redis.incr(bucketKey);
      await redis.expire(bucketKey, options.window * 2); // Keep for 2 windows

      if (count > options.limit) {

        return {
          success: false,
          remaining: 0,
          reset,
          limit: options.limit,
        };
      }

      return {
        success: true,
        remaining: Math.max(0, options.limit - count),
        reset,
        limit: options.limit,
      };
    } catch (error) {
      // Redis error - fall back to in-memory

    }
  }

  // Fallback to in-memory store
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
