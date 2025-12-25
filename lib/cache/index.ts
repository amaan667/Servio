/**
 * Unified Cache Interface
 * Single source of truth for all caching in the application
 * Supports both Redis and in-memory caching with automatic fallback
 */

import { redisCache } from "./redis";
import { logger } from "@/lib/logger";

interface CacheOptions {
  ttl?: number; // Time to live in seconds
}

class Cache {
  private memoryCache: Map<string, { value: unknown; expires: number }> = new Map();
  private useRedis: boolean = false;

  constructor() {
    // Check if Redis is available
    this.useRedis = !!process.env.REDIS_URL;
  }

  /**
   * Get value from cache (tries Redis first, then memory)
   */
  async get<T>(key: string): Promise<T | null> {
    // Try Redis first if available
    if (this.useRedis) {
      const value = await redisCache.get<T>(key);
      if (value !== null) {
        return value;
      }
    }

    // Fall back to memory cache
    const cached = this.memoryCache.get(key);
    if (!cached) {
      return null;
    }

    // Check if expired
    if (Date.now() > cached.expires) {
      this.memoryCache.delete(key);
      return null;
    }

    return cached.value as T;
  }

  /**
   * Set value in cache
   */
  async set<T>(
    key: string,
    value: T,
    options: CacheOptions = {
      /* Empty */
    }
  ): Promise<boolean> {
    const { ttl = 300 } = options; // Default 5 minutes

    try {
      // Try Redis first if available
      if (this.useRedis) {
        await redisCache.set(key, value, ttl);
        return true;
      }

      // Fall back to memory cache
      const expires = Date.now() + ttl * 1000;
      this.memoryCache.set(key, { value, expires });
      return true;
    } catch (_error) {
      logger.error("[CACHE] Error setting cache:", { error: _error, key });
      return false;
    }
  }

  /**
   * Delete value from cache
   */
  async delete(key: string): Promise<boolean> {
    try {
      // Try Redis first if available
      if (this.useRedis) {
        await redisCache.delete(key);
      }

      // Also delete from memory cache
      this.memoryCache.delete(key);
      return true;
    } catch (_error) {
      logger.error("[CACHE] Error deleting cache:", { error: _error, key });
      return false;
    }
  }

  /**
   * Invalidate cache pattern
   */
  async invalidate(pattern: string): Promise<boolean> {
    try {
      // Try Redis first if available
      if (
        this.useRedis &&
        "invalidate" in redisCache &&
        typeof redisCache.invalidate === "function"
      ) {
        await redisCache.invalidate(pattern);
      }

      // Also clear matching memory cache entries
      const regex = new RegExp(pattern.replace("*", ".*"));
      for (const key of this.memoryCache.keys()) {
        if (regex.test(key)) {
          this.memoryCache.delete(key);
        }
      }
      return true;
    } catch (_error) {
      logger.error("[CACHE] Error invalidating cache:", { error: _error, pattern });
      return false;
    }
  }

  /**
   * Check if key exists in cache
   */
  async has(key: string): Promise<boolean> {
    const value = await this.get(key);
    return value !== null;
  }

  /**
   * Get multiple values from cache
   */
  async mget<T>(keys: string[]): Promise<(T | null)[]> {
    const results = await Promise.all(keys.map((key) => this.get<T>(key)));
    return results;
  }

  /**
   * Set multiple values in cache
   */
  async mset<T>(
    keyValues: Record<string, T>,
    options: CacheOptions = {
      /* Empty */
    }
  ): Promise<boolean> {
    try {
      await Promise.all(
        Object.entries(keyValues).map(([key, value]) => this.set(key, value, options))
      );
      return true;
    } catch (_error) {
      logger.error("[CACHE] Error setting multiple cache values:", { error: _error });
      return false;
    }
  }

  /**
   * Clear all cache
   */
  async clear(): Promise<boolean> {
    try {
      if (this.useRedis) {
        await redisCache.clear();
      }
      this.memoryCache.clear();
      return true;
    } catch (_error) {
      logger.error("[CACHE] Error clearing cache:", { error: _error });
      return false;
    }
  }
}

// Export singleton instance
export const cache = new Cache();

// Export cache key generators
export const cacheKeys = {
  menu: (venueId: string) => `menu:${venueId}`,
  menuItems: (venueId: string) => `menu:items:${venueId}`,
  menuCategories: (venueId: string) => `menu:categories:${venueId}`,
  orders: (venueId: string) => `orders:${venueId}`,
  order: (orderId: string) => `order:${orderId}`,
  venue: (venueId: string) => `venue:${venueId}`,
  user: (userId: string) => `user:${userId}`,
  analytics: (venueId: string) => `analytics:${venueId}`,
};

// Export TTL constants
export const cacheTTL = {
  short: 60, // 1 minute
  medium: 300, // 5 minutes
  long: 1800, // 30 minutes
  veryLong: 3600, // 1 hour
};

// Export cache interface for type safety
export interface CacheInterface {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, options?: CacheOptions): Promise<boolean>;
  delete(key: string): Promise<boolean>;
  invalidate(pattern: string): Promise<boolean>;
  has(key: string): Promise<boolean>;
  mget<T>(keys: string[]): Promise<(T | null)[]>;
  mset<T>(keyValues: Record<string, T>, options?: CacheOptions): Promise<boolean>;
  clear(): Promise<boolean>;
}

/**
 * AI Response caching helpers
 */
export const AICache = {
  categorization: {
    get: (itemName: string, categories: string[]) =>
      cache.get(`ai:cat:${itemName}:${categories.join(",")}`),
    set: (itemName: string, categories: string[], result: unknown) =>
      cache.set(`ai:cat:${itemName}:${categories.join(",")}`, result, { ttl: cacheTTL.long }), // 30 min
  },
  matching: {
    get: (pdfItem: string, urlItem: string) => cache.get(`ai:match:${pdfItem}:${urlItem}`),
    set: (pdfItem: string, urlItem: string, result: unknown) =>
      cache.set(`ai:match:${pdfItem}:${urlItem}`, result, { ttl: cacheTTL.long }), // 30 min
  },
  kdsStation: {
    get: (itemName: string, venueId: string, stationTypes: string[]) => {
      const key = `ai:kds:${venueId}:${itemName.toLowerCase()}:${stationTypes.sort().join(",")}`;
      return cache.get(key);
    },
    set: (itemName: string, venueId: string, stationTypes: string[], result: unknown) => {
      const key = `ai:kds:${venueId}:${itemName.toLowerCase()}:${stationTypes.sort().join(",")}`;
      return cache.set(key, result, { ttl: cacheTTL.long }); // 30 min cache
    },
  },
};
