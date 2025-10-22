/**
 * Caching Service
 * Provides Redis-based caching with fallback to memory cache
 */

interface CacheConfig {
  ttl?: number; // Time to live in seconds
  prefix?: string;
}

interface CacheEntry<T> {
  value: T;
  expires: number;
}

class CacheService {
  private memoryCache = new Map<string, CacheEntry<unknown>>();
  private redisClient: unknown = null;

  constructor() {
    // TODO: Initialize Redis client in production
    // this.redisClient = new Redis(process.env.REDIS_URL);
  }

  /**
   * Get value from cache
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      // Try Redis first (if available)
      if (this.redisClient) {
        const cached = await this.redisClient.get(key);
        if (cached) {
          return JSON.parse(cached);
        }
      }

      // Fallback to memory cache
      const entry = this.memoryCache.get(key);
      if (entry && Date.now() < entry.expires) {
        return entry.value;
      }

      // Clean up expired entry
      if (entry) {
        this.memoryCache.delete(key);
      }

      return null;
    } catch (error) {
      console.error('[CACHE] Error getting key:', key, error);
      return null;
    }
  }

  /**
   * Set value in cache
   */
  async set<T>(key: string, value: T, config: CacheConfig = {}): Promise<void> {
    try {
      const ttl = config.ttl || 3600; // Default 1 hour
      const expires = Date.now() + (ttl * 1000);

      // Try Redis first (if available)
      if (this.redisClient) {
        await this.redisClient.setex(key, ttl, JSON.stringify(value));
        return;
      }

      // Fallback to memory cache
      this.memoryCache.set(key, { value, expires });
    } catch (error) {
      console.error('[CACHE] Error setting key:', key, error);
    }
  }

  /**
   * Delete value from cache
   */
  async delete(key: string): Promise<void> {
    try {
      if (this.redisClient) {
        await this.redisClient.del(key);
      } else {
        this.memoryCache.delete(key);
      }
    } catch (error) {
      console.error('[CACHE] Error deleting key:', key, error);
    }
  }

  /**
   * Invalidate cache by pattern
   */
  async invalidatePattern(pattern: string): Promise<void> {
    try {
      if (this.redisClient) {
        const keys = await this.redisClient.keys(pattern);
        if (keys.length > 0) {
          await this.redisClient.del(...keys);
        }
      } else {
        // Memory cache pattern matching
        const regex = new RegExp(pattern.replace(/\*/g, '.*'));
        for (const key of this.memoryCache.keys()) {
          if (regex.test(key)) {
            this.memoryCache.delete(key);
          }
        }
      }
    } catch (error) {
      console.error('[CACHE] Error invalidating pattern:', pattern, error);
    }
  }

  /**
   * Clear all cache
   */
  async clear(): Promise<void> {
    try {
      if (this.redisClient) {
        await this.redisClient.flushdb();
      } else {
        this.memoryCache.clear();
      }
    } catch (error) {
      console.error('[CACHE] Error clearing cache:', error);
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): { size: number; keys: string[] } {
    if (this.redisClient) {
      // TODO: Implement Redis stats
      return { size: 0, keys: [] };
    }

    return {
      size: this.memoryCache.size,
      keys: Array.from(this.memoryCache.keys())
    };
  }
}

export const cache = new CacheService();

/**
 * Cache decorator for functions
 */
export function cached(ttl: number = 3600, keyGenerator?: (...args: unknown[]) => string) {
  return function (target: unknown, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;
    
    descriptor.value = async function (...args: unknown[]) {
      const cacheKey = keyGenerator ? keyGenerator(...args) : `${propertyName}:${JSON.stringify(args)}`;
      
      // Try to get from cache
      const cached = await cache.get(cacheKey);
      if (cached !== null) {
        return cached;
      }
      
      // Execute method and cache result
      const result = await method.apply(this, args);
      await cache.set(cacheKey, result, { ttl });
      
      return result;
    };
  };
}

/**
 * Cache key patterns
 */
export const cacheKeys = {
  venue: (venueId: string) => `venue:${venueId}`,
  menu: (venueId: string) => `menu:${venueId}`,
  categories: 'categories',
  user: (userId: string) => `user:${userId}`,
  dashboard: (venueId: string) => `dashboard:${venueId}`,
  analytics: (venueId: string) => `analytics:${venueId}`,
  orders: (venueId: string) => `orders:${venueId}`
};

/**
 * Cache TTL configurations (in seconds)
 */
export const cacheTTL = {
  short: 60,        // 1 minute
  medium: 300,      // 5 minutes
  long: 3600,       // 1 hour
  day: 86400,       // 24 hours
  week: 604800      // 7 days
};

/**
 * Cache invalidation helpers
 */
export const cacheInvalidation = {
  venue: (venueId: string) => cache.invalidatePattern(`venue:${venueId}:*`),
  user: (userId: string) => cache.invalidatePattern(`user:${userId}:*`),
  dashboard: (venueId: string) => cache.invalidatePattern(`dashboard:${venueId}:*`),
  analytics: (venueId: string) => cache.invalidatePattern(`analytics:${venueId}:*`),
  orders: (venueId: string) => cache.invalidatePattern(`orders:${venueId}:*`)
};
