/**
 * Simple in-memory rate limiter
 * Edge-safe, no external dependencies
 */

type Key = string;
const hits = new Map<Key, { count: number; ts: number }>();

const WINDOW_MS = 60_000; // 1 minute
const MAX_REQUESTS = 60; // 60 requests per minute

export interface RateLimitResult {

}

export function rateLimit(key: Key, now = Date.now()): RateLimitResult {
  const h = hits.get(key);

  // New key or expired window
  if (!h || now - h.ts > WINDOW_MS) {
    hits.set(key, { count: 1, ts: now });
    return {

    };
  }

  // Check limit
  if (h.count >= MAX_REQUESTS) {
    return {

    };
  }

  // Increment
  h.count++;
  return {

  };
}

/**
 * Get rate limit key from request
 */
export function getRateLimitKey(req: Request, endpoint: string): string {
  const ip = req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip") ?? "unknown";
  return `${req.method}:${endpoint}:${ip}`;
}

/**
 * Clean up old entries periodically (optional)
 */
export function cleanup(now = Date.now()) {
  for (const [key, value] of hits.entries()) {
    if (now - value.ts > WINDOW_MS * 2) {
      hits.delete(key);
    }
  }
}

// Run cleanup every 5 minutes
if (typeof global !== "undefined") {
  setInterval(() => cleanup(), 5 * 60 * 1000);
}
