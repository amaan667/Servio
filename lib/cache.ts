/**
 * Caching Utility
 * In-memory cache with TTL support
 * Can be upgraded to Redis/Upstash for production scale
 */

import { logger } from "./logger";

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

class MemoryCache {
  private cache = new Map<string, CacheEntry<any>>();
  private hitCount = 0;
  private missCount = 0;

  /**
   * Get value from cache
   */
  async get<T>(key: string): Promise<T | null> {
    const entry = this.cache.get(key);

    if (!entry) {
      this.missCount++;
      return null;
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.missCount++;
      return null;
    }

    this.hitCount++;
    return entry.value as T;
  }

  /**
   * Set value in cache with TTL (seconds)
   */
  async set<T>(key: string, value: T, ttlSeconds: number = 300): Promise<void> {
    const expiresAt = Date.now() + ttlSeconds * 1000;

    this.cache.set(key, {
      value,
      expiresAt,
    });
  }

  /**
   * Delete value from cache
   */
  async delete(key: string): Promise<void> {
    this.cache.delete(key);
  }

  /**
   * Delete all keys matching pattern
   */
  async deletePattern(pattern: string): Promise<void> {
    const regex = new RegExp(pattern);

    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Clear all cache
   */
  async clear(): Promise<void> {
    this.cache.clear();
    this.hitCount = 0;
    this.missCount = 0;
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const totalRequests = this.hitCount + this.missCount;
    const hitRate = totalRequests > 0 ? (this.hitCount / totalRequests) * 100 : 0;

    return {
      size: this.cache.size,
      hits: this.hitCount,
      misses: this.missCount,
      hitRate: `${hitRate.toFixed(2)}%`,
      totalRequests,
    };
  }

  /**
   * Clean up expired entries
   */
  cleanup() {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.info("[CACHE] Cleanup completed", {
        entriesRemoved: cleaned,
        remainingSize: this.cache.size,
      });
    }

    return cleaned;
  }
}

// Singleton instance
const cache = new MemoryCache();

// Run cleanup every 5 minutes
if (typeof setInterval !== "undefined") {
  setInterval(() => cache.cleanup(), 5 * 60 * 1000);
}

/**
 * Get or compute cached value
 */
export async function getCached<T>(
  key: string,
  fn: () => Promise<T>,
  ttlSeconds: number = 300
): Promise<T> {
  // Try to get from cache
  const cached = await cache.get<T>(key);

  if (cached !== null) {
    logger.debug("[CACHE] Hit", { key });
    return cached;
  }

  // Cache miss - compute value
  logger.debug("[CACHE] Miss", { key });
  const value = await fn();

  // Store in cache
  await cache.set(key, value, ttlSeconds);

  return value;
}

/**
 * Invalidate cache by key
 */
export async function invalidateCache(key: string): Promise<void> {
  await cache.delete(key);
  logger.debug("[CACHE] Invalidated", { key });
}

/**
 * Invalidate all keys matching pattern
 */
export async function invalidateCachePattern(pattern: string): Promise<void> {
  await cache.deletePattern(pattern);
  logger.info("[CACHE] Invalidated pattern", { pattern });
}

/**
 * Get cache statistics
 */
export function getCacheStats() {
  return cache.getStats();
}

/**
 * Clear all cache
 */
export async function clearAllCache(): Promise<void> {
  await cache.clear();
  logger.info("[CACHE] All cache cleared");
}

/**
 * Menu-specific caching helpers
 */
export const MenuCache = {
  get: (venueId: string) => cache.get(`menu:${venueId}`),
  set: (venueId: string, data: any) => cache.set(`menu:${venueId}`, data, 300), // 5 min
  invalidate: (venueId: string) => cache.delete(`menu:${venueId}`),
};

/**
 * AI Response caching helpers
 */
export const AICache = {
  categorization: {
    get: (itemName: string, categories: string[]) =>
      cache.get(`ai:cat:${itemName}:${categories.join(",")}`),
    set: (itemName: string, categories: string[], result: any) =>
      cache.set(`ai:cat:${itemName}:${categories.join(",")}`, result, 3600), // 1 hour
  },
  matching: {
    get: (pdfItem: string, urlItem: string) => cache.get(`ai:match:${pdfItem}:${urlItem}`),
    set: (pdfItem: string, urlItem: string, result: any) =>
      cache.set(`ai:match:${pdfItem}:${urlItem}`, result, 3600), // 1 hour
  },
};
