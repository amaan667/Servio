/**
 * Rate Limiting Utilities
 * Provides rate limiting for API endpoints to prevent abuse
 * Uses Redis when available, falls back to in-memory store
 */

import { NextRequest } from "next/server";

import { env } from "@/lib/env";
import { logger } from "@/lib/monitoring/structured-logger";

export interface RateLimitConfig {
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

  // SECURITY: Redis is required for production deployments
  // In-memory fallback is disabled to prevent distributed rate limit bypass
  if (!redisUrl) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "REDIS_URL is required in production. Rate limiting requires Redis for distributed deployments. " +
        "Set REDIS_URL environment variable or deploy with Redis enabled."
      );
    }
    // Development: allow in-memory fallback for local testing
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
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        `Failed to connect to Redis: ${error instanceof Error ? error.message : String(error)}. ` +
        "Redis is required for production rate limiting."
      );
    }
    // Development: allow fallback on connection errors
    return null;
  }
}

/**
 * Check Redis connection health
 * Returns true if Redis is available and responsive
 */
export async function checkRedisHealth(): Promise<{ healthy: boolean; latency?: number; error?: string }> {
  try {
    const redis = await getRedisClient();
    if (!redis) {
      return { healthy: false, error: "Redis not available" };
    }

    const start = Date.now();
    await redis.ping();
    const latency = Date.now() - start;

    logger.info("Redis health check passed", { latency, type: "redis_health" });
    return { healthy: true, latency };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error("Redis health check failed", { error: errorMessage, type: "redis_health" }, error instanceof Error ? error : undefined);
    return { healthy: false, error: errorMessage };
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
export function getClientIdentifier(req: NextRequest): string {
  // Try to get user ID from auth header/cookie first
  const authHeader = req.headers.get("authorization");
  if (authHeader) {
    // Extract user ID from token if possible
    // For now, fall back to IP
  }

  // Fall back to IP address
  const forwarded = req.headers.get("x-forwarded-for");
  const first = forwarded?.split(",")[0];
  const ip =
    (typeof first === "string" ? first.trim() : null) ?? req.headers.get("x-real-ip") ?? "unknown";
  return ip;
}

/**
 * Rate limit check
 * Uses Redis when available, falls back to in-memory store
 */
export async function rateLimit(
  req: NextRequest,
  options: RateLimitConfig
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
        const result: RateLimitResult = {
          success: false,
          remaining: 0,
          reset,
          limit: options.limit,
        };
        recordRateLimitMetrics(req.nextUrl.pathname, identifier, result);
        return result;
      }

      const result: RateLimitResult = {
        success: true,
        remaining: Math.max(0, options.limit - count),
        reset,
        limit: options.limit,
      };
      recordRateLimitMetrics(req.nextUrl.pathname, identifier, result);
      return result;
    } catch (error) {
      // Redis error - fall back to in-memory
    }
  }

  // Fallback to in-memory store
  const current = rateLimitStore.get(key);

  if (!current || current.reset < now) {
    // First request or window expired
    rateLimitStore.set(key, { count: 1, reset });
    const result: RateLimitResult = {
      success: true,
      remaining: options.limit - 1,
      reset,
      limit: options.limit,
    };
    recordRateLimitMetrics(req.nextUrl.pathname, identifier, result);
    return result;
  }

  if (current.count >= options.limit) {
    // Rate limit exceeded
    const result: RateLimitResult = {
      success: false,
      remaining: 0,
      reset: current.reset,
      limit: options.limit,
    };
    recordRateLimitMetrics(req.nextUrl.pathname, identifier, result);
    return result;
  }

  // Increment count
  current.count++;
  rateLimitStore.set(key, current);

  const result: RateLimitResult = {
    success: true,
    remaining: options.limit - current.count,
    reset: current.reset,
    limit: options.limit,
  };
  recordRateLimitMetrics(req.nextUrl.pathname, identifier, result);
  return result;
}

/**
 * Rate limit middleware for API routes
 */
export function withRateLimit(options: RateLimitConfig) {
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
  /** KDS polls stations + tickets ~every 5s; per-user when x-user-id set. Avoid auth/rate-limit errors. */
  KDS: { limit: 500, window: 60 },
  MENU_PUBLIC: { limit: 10000, window: 60 }, // Effectively unlimited — public read-only, must work on any device/network
  STRICT: { limit: 5, window: 60 }, // 5 requests per minute
} as const;

/**
 * Rate limit metrics for monitoring
 * Tracks rate limit hits, misses, and rejections
 */
interface RateLimitMetrics {
  endpoint: string;
  identifier: string;
  limit: number;
  remaining: number;
  reset: number;
  success: boolean;
  timestamp: number;
}

// In-memory metrics store (in production, this should be exported to APM)
const metricsStore: Map<string, RateLimitMetrics[]> = new Map();

/**
 * Record rate limit metrics
 */
export function recordRateLimitMetrics(
  endpoint: string,
  identifier: string,
  result: RateLimitResult
): void {
  const metrics: RateLimitMetrics = {
    endpoint,
    identifier,
    limit: result.limit,
    remaining: result.remaining,
    reset: result.reset,
    success: result.success,
    timestamp: Date.now(),
  };

  const key = `${endpoint}:${identifier}`;
  if (!metricsStore.has(key)) {
    metricsStore.set(key, []);
  }

  const history = metricsStore.get(key)!;
  history.push(metrics);

  // Keep only last 100 entries per endpoint:identifier
  if (history.length > 100) {
    history.shift();
  }

  // Log to structured logger for APM integration
  if (!result.success) {
    logger.warn("Rate limit exceeded", {
      endpoint,
      identifier,
      limit: result.limit,
      remaining: result.remaining,
      type: "rate_limit_exceeded",
    });
  } else if (result.remaining < result.limit * 0.1) {
    // Alert when approaching limit (less than 10% remaining)
    logger.info("Rate limit approaching threshold", {
      endpoint,
      identifier,
      remaining: result.remaining,
      limit: result.limit,
      type: "rate_limit_warning",
    });
  }
}

/**
 * Get rate limit metrics for monitoring
 */
export function getRateLimitMetrics(endpoint?: string): RateLimitMetrics[] {
  if (endpoint) {
    const allMetrics: RateLimitMetrics[] = [];
    for (const [key, history] of metricsStore.entries()) {
      if (key.startsWith(endpoint)) {
        allMetrics.push(...history);
      }
    }
    return allMetrics;
  }

  const allMetrics: RateLimitMetrics[] = [];
  for (const history of metricsStore.values()) {
    allMetrics.push(...history);
  }
  return allMetrics;
}

/**
 * Clear rate limit metrics (useful for testing)
 */
export function clearRateLimitMetrics(): void {
  metricsStore.clear();
}
