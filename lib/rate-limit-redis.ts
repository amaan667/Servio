/**
 * Redis-based Rate Limiting
 * Provides scalable rate limiting using Redis sorted sets for sliding window algorithm
 */

import { NextRequest } from "next/server";
import { env } from "@/lib/env";

export interface RateLimitConfig {
  limit: number;
  window: number;
  identifier?: string;
}

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  reset: number;
  limit: number;
}

// Redis client type
interface RedisClient {
  zadd: (key: string, score: number, member: string) => Promise<number>;
  zremrangeByScore: (key: string, min: number, max: number) => Promise<number[]>;
  zcard: (key: string) => Promise<number>;
  expire: (key: string, seconds: number) => Promise<number>;
  del: (key: string) => Promise<number>;
  keys: (pattern: string) => Promise<string[]>;
  disconnect: () => Promise<void>;
}

// Redis client singleton
let redisClient: RedisClient | null = null;
let redisInitialized = false;
let redisHealthy = true;

async function getRedisClient(): Promise<RedisClient | null> {
  if (redisClient) {
    if (!redisHealthy) {
      return null;
    }
    return redisClient;
  }

  if (redisInitialized) {
    return null;
  }

  redisInitialized = true;
  const redisUrl = env("REDIS_URL");

  if (!redisUrl) {
    return null;
  }

  try {
    const Redis = (await import("ioredis")).default;
    redisClient = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times: number) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      lazyConnect: true,
      enableReadyCheck: true,
      keepAlive: 30000,
      connectTimeout: 10000,
      family: 4,
      enableOfflineQueue: false,
    });

    redisHealthy = true;

    return redisClient;
  } catch (error) {
    redisHealthy = false;
    return null;
  }
}

function markRedisUnhealthy() {
  redisHealthy = false;
}

export function getClientIdentifier(req: NextRequest): string {
  const userId = req.headers.get("x-user-id");
  if (userId) {
    return `user:${userId}`;
  }

  const forwarded = req.headers.get("x-forwarded-for");
  const first = forwarded?.split(",")[0];
  const ip =
    (typeof first === "string" ? first.trim() : null) ??
    req.headers.get("x-real-ip") ??
    "unknown";
  return `ip:${ip}`;
}

export async function rateLimit(
  req: NextRequest,
  options: RateLimitConfig
): Promise<RateLimitResult> {
  const identifier = options.identifier || getClientIdentifier(req);
  const key = `ratelimit:${identifier}:${options.limit}:${options.window}`;
  const now = Date.now();
  const windowMs = options.window * 1000;
  const reset = now + windowMs;

  const redis = await getRedisClient();
  if (redis) {
    try {
      const cutoff = now - windowMs;
      await redis.zremrangeByScore(key, 0, cutoff);
      await redis.zadd(key, now, `${now}:${Math.random()}`);
      const count = await redis.zcard(key);
      await redis.expire(key, options.window * 2);

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
      // Redis error, marking unhealthy
      markRedisUnhealthy();
    }
  }

  return rateLimitInMemory(identifier, options, now, windowMs, reset);
}

const rateLimitStore = new Map<string, { count: number; reset: number }>();

function rateLimitInMemory(
  identifier: string,
  options: RateLimitConfig,
  now: number,
  windowMs: number,
  reset: number
): RateLimitResult {
  const current = rateLimitStore.get(identifier);

  if (!current || current.reset < now) {
    rateLimitStore.set(identifier, { count: 1, reset });
    return {
      success: true,
      remaining: options.limit - 1,
      reset,
      limit: options.limit,
    };
  }

  if (current.count >= options.limit) {
    return {
      success: false,
      remaining: 0,
      reset: current.reset,
      limit: options.limit,
    };
  }

  current.count++;
  rateLimitStore.set(identifier, current);

  return {
    success: true,
    remaining: Math.max(0, options.limit - current.count),
    reset,
    limit: options.limit,
  };
}

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

    req.headers.set("X-RateLimit-Limit", result.limit.toString());
    req.headers.set("X-RateLimit-Remaining", result.remaining.toString());
    req.headers.set("X-RateLimit-Reset", result.reset.toString());

    return null;
  };
}

export const RATE_LIMITS = {
  AUTH: { limit: 10, window: 60 },
  PAYMENT: { limit: 20, window: 60 },
  ORDER_CREATE: { limit: 30, window: 60 },
  GENERAL: { limit: 100, window: 60 },
  KDS: { limit: 500, window: 60 },
  MENU_PUBLIC: { limit: 60, window: 60 },
  STRICT: { limit: 5, window: 60 },
} as const;

export async function resetRateLimit(identifier: string): Promise<void> {
  const redis = await getRedisClient();
  if (redis) {
    try {
      const keys = await redis.keys(`ratelimit:${identifier}:*`);
      if (keys.length > 0) {
        const keyToDelete = keys[0] as string;
        await redis.del(keyToDelete);
      }
    } catch (error) {
      // Failed to reset rate limit
    }
  }

  rateLimitStore.delete(identifier);
}

export async function getRateLimitStatus(
  identifier: string,
  limit: number,
  window: number
): Promise<{ count: number; remaining: number; reset: number }> {
  const redis = await getRedisClient();
  const now = Date.now();
  const windowMs = window * 1000;
  const reset = now + windowMs;

  if (redis) {
    try {
      const key = `ratelimit:${identifier}:${limit}:${window}`;
      const cutoff = now - windowMs;
      await redis.zremrangeByScore(key, 0, cutoff);
      const count = await redis.zcard(key);
      
      return {
        count,
        remaining: Math.max(0, limit - count),
        reset,
      };
    } catch (error) {
      // Failed to get rate limit status
    }
  }

  const current = rateLimitStore.get(identifier);
  if (!current || current.reset < now) {
    return { count: 0, remaining: limit, reset };
  }

  return {
    count: current.count,
    remaining: Math.max(0, limit - current.count),
    reset: current.reset,
  };
}

export async function closeRateLimitConnection(): Promise<void> {
  if (redisClient) {
    try {
      await redisClient.disconnect();
      redisClient = null;
      redisInitialized = false;
      redisHealthy = true;
    } catch (error) {
      // Error closing Redis connection
    }
  }
}

export async function getRateLimitHealth(): Promise<{
  redis: boolean;
  healthy: boolean;
}> {
  return {
    redis: redisClient !== null,
    healthy: redisHealthy,
  };
}
