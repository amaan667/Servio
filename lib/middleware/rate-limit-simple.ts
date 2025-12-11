/**
 * Simple in-memory rate limiter
 * Edge-safe, no external dependencies
 */

type Key = string;
const hits = new Map<Key, { count: number; ts: number }>();

const WINDOW_MS = 60_000; // 1 minute
const MAX_REQUESTS = 60; // 60 requests per minute

export interface RateLimitResult {
  ok: boolean;
  remaining?: number;
  reset?: number;
}

export function rateLimit(key: Key, now = Date.now()): RateLimitResult {
  const h = hits.get(key);

  // New key or expired window
  if (!h || now - h.ts > WINDOW_MS) {
    hits.set(key, { count: 1, ts: now });
    return {
      ok: true,
      remaining: MAX_REQUESTS - 1,
      reset: now + WINDOW_MS,
    };
  }

  // Check limit
  if (h.count >= MAX_REQUESTS) {
    return {
      ok: false,
      remaining: 0,
      reset: h.ts + WINDOW_MS,
    };
  }

  // Increment
  h.count++;
  return {
    ok: true,
    remaining: MAX_REQUESTS - h.count,
    reset: h.ts + WINDOW_MS,
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
