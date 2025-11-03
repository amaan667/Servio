/**
 * Rate Limiting Utility
 * Prevents API abuse and DDoS attacks
 * Uses in-memory storage (can be upgraded to Redis for multi-instance)
 */

import { logger } from "./logger";

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

class RateLimiter {
  private store = new Map<string, RateLimitEntry>();

  /**
   * Check if request is allowed
   * @param identifier - Unique identifier (IP, user ID, venue ID, etc.)
   * @param limit - Max requests allowed
   * @param windowSeconds - Time window in seconds
   */
  async isAllowed(identifier: string, limit: number, windowSeconds: number): Promise<boolean> {
    const now = Date.now();
    const entry = this.store.get(identifier);

    // No entry or expired window - allow and start new window
    if (!entry || now > entry.resetAt) {
      this.store.set(identifier, {
        count: 1,
        resetAt: now + windowSeconds * 1000,
      });
      return true;
    }

    // Within window - check limit
    if (entry.count < limit) {
      entry.count++;
      return true;
    }

    // Exceeded limit
    const timeUntilReset = Math.ceil((entry.resetAt - now) / 1000);
    logger.warn("[RATE LIMIT] Request blocked", {
      identifier,
      count: entry.count,
      limit,
      timeUntilReset: `${timeUntilReset}s`,
    });

    return false;
  }

  /**
   * Get current rate limit info
   */
  async getInfo(identifier: string): Promise<{
    remaining: number;
    resetAt: number;
    total: number;
  } | null> {
    const entry = this.store.get(identifier);

    if (!entry || Date.now() > entry.resetAt) {
      return null;
    }

    return {
      remaining: Math.max(0, 100 - entry.count), // Assuming default limit of 100
      resetAt: entry.resetAt,
      total: entry.count,
    };
  }

  /**
   * Reset rate limit for identifier
   */
  async reset(identifier: string): Promise<void> {
    this.store.delete(identifier);
  }

  /**
   * Cleanup expired entries (run periodically)
   */
  cleanup() {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.store.entries()) {
      if (now > entry.resetAt) {
        this.store.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.info("[RATE LIMIT] Cleanup completed", {
        entriesRemoved: cleaned,
        remainingSize: this.store.size,
      });
    }
  }
}

// Singleton instance
const rateLimiter = new RateLimiter();

// Run cleanup every 10 minutes
if (typeof setInterval !== "undefined") {
  setInterval(() => rateLimiter.cleanup(), 10 * 60 * 1000);
}

/**
 * Rate limit configurations
 */
export const RATE_LIMITS = {
  // API endpoints
  api: {
    general: { limit: 100, window: 60 }, // 100 requests per minute
    menuUpload: { limit: 5, window: 300 }, // 5 uploads per 5 minutes
    orderSubmit: { limit: 20, window: 60 }, // 20 orders per minute
    auth: { limit: 10, window: 300 }, // 10 auth attempts per 5 minutes
  },

  // User actions
  user: {
    menuItemCreate: { limit: 50, window: 60 }, // 50 items per minute
    staffInvite: { limit: 10, window: 3600 }, // 10 invites per hour
  },
};

/**
 * Check rate limit for API endpoint
 */
export async function checkRateLimit(
  identifier: string,
  endpoint: keyof typeof RATE_LIMITS.api
): Promise<{ allowed: boolean; retryAfter?: number }> {
  const config = RATE_LIMITS.api[endpoint];

  const allowed = await rateLimiter.isAllowed(identifier, config.limit, config.window);

  if (!allowed) {
    const info = await rateLimiter.getInfo(identifier);
    const retryAfter = info ? Math.ceil((info.resetAt - Date.now()) / 1000) : config.window;

    return { allowed: false, retryAfter };
  }

  return { allowed: true };
}

/**
 * Middleware helper for Next.js API routes
 */
export async function withRateLimit(
  identifier: string,
  endpoint: keyof typeof RATE_LIMITS.api,
  handler: () => Promise<Response>
): Promise<Response> {
  const { allowed, retryAfter } = await checkRateLimit(identifier, endpoint);

  if (!allowed) {
    return new Response(
      JSON.stringify({
        error: "Too many requests",
        message: `Please try again in ${retryAfter} seconds`,
        retryAfter,
      }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": retryAfter!.toString(),
          "X-RateLimit-Limit": RATE_LIMITS.api[endpoint].limit.toString(),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": (Date.now() + retryAfter! * 1000).toString(),
        },
      }
    );
  }

  return handler();
}

/**
 * Get rate limiter instance (for advanced usage)
 */
export function getRateLimiter() {
  return rateLimiter;
}
