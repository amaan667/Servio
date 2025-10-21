/**
 * @fileoverview Redis caching layer for performance optimization
 * @module lib/cache/redis-cache
 */

import Redis from 'ioredis';
import { logger } from '@/lib/logger';

// Redis client singleton
let redisClient: Redis | null = null;

/**
 * Get or create Redis client
 */
function getRedisClient(): Redis | null {
  if (typeof window !== 'undefined') {
    // Redis is not available in browser
    return null;
  }

  if (!process.env.REDIS_URL) {
    logger.debug('[REDIS] Redis URL not configured, using memory cache fallback');
    return null;
  }

  if (!redisClient) {
    try {
      redisClient = new Redis(process.env.REDIS_URL, {
        maxRetriesPerRequest: 3,
        enableReadyCheck: true,
        lazyConnect: true,
      });

      redisClient.on('error', (error) => {
        logger.error('[REDIS] Connection error', { error });
      });

      redisClient.on('connect', () => {
        logger.debug('[REDIS] Connected successfully');
      });

      // Connect lazily
      redisClient.connect().catch((error) => {
        logger.error('[REDIS] Failed to connect', { error });
        redisClient = null;
      });
    } catch (error) {
      logger.error('[REDIS] Failed to initialize', { error });
      return null;
    }
  }

  return redisClient;
}

/**
 * Redis cache manager
 */
export class RedisCache {
  private redis: Redis | null;

  constructor() {
    this.redis = getRedisClient();
  }

  /**
   * Get value from cache
   */
  async get<T>(key: string): Promise<T | null> {
    if (!this.redis) return null;

    try {
      const value = await this.redis.get(key);
      if (!value) return null;

      return JSON.parse(value) as T;
    } catch (error) {
      logger.error('[REDIS] Failed to get key', { error, key });
      return null;
    }
  }

  /**
   * Set value in cache with TTL
   */
  async set(key: string, value: unknown, ttl: number = 300): Promise<boolean> {
    if (!this.redis) return false;

    try {
      const serialized = JSON.stringify(value);
      await this.redis.setex(key, ttl, serialized);
      return true;
    } catch (error) {
      logger.error('[REDIS] Failed to set key', { error, key });
      return false;
    }
  }

  /**
   * Delete key from cache
   */
  async delete(key: string): Promise<boolean> {
    if (!this.redis) return false;

    try {
      await this.redis.del(key);
      return true;
    } catch (error) {
      logger.error('[REDIS] Failed to delete key', { error, key });
      return false;
    }
  }

  /**
   * Delete multiple keys matching pattern
   */
  async deletePattern(pattern: string): Promise<number> {
    if (!this.redis) return 0;

    try {
      const keys = await this.redis.keys(pattern);
      if (keys.length === 0) return 0;

      await this.redis.del(...keys);
      return keys.length;
    } catch (error) {
      logger.error('[REDIS] Failed to delete pattern', { error, pattern });
      return 0;
    }
  }

  /**
   * Check if key exists
   */
  async exists(key: string): Promise<boolean> {
    if (!this.redis) return false;

    try {
      const result = await this.redis.exists(key);
      return result === 1;
    } catch (error) {
      logger.error('[REDIS] Failed to check key existence', { error, key });
      return false;
    }
  }

  /**
   * Increment counter
   */
  async increment(key: string, by: number = 1): Promise<number | null> {
    if (!this.redis) return null;

    try {
      return await this.redis.incrby(key, by);
    } catch (error) {
      logger.error('[REDIS] Failed to increment key', { error, key });
      return null;
    }
  }

  /**
   * Get or set with function (cache-aside pattern)
   */
  async getOrSet<T>(
    key: string,
    fetchFunction: () => Promise<T>,
    ttl: number = 300
  ): Promise<T> {
    // Try to get from cache
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    // Fetch fresh data
    const fresh = await fetchFunction();

    // Store in cache (fire and forget)
    this.set(key, fresh, ttl).catch((error) => {
      logger.error('[REDIS] Failed to cache result', { error, key });
    });

    return fresh;
  }

  /**
   * Batch get multiple keys
   */
  async mget<T>(keys: string[]): Promise<(T | null)[]> {
    if (!this.redis || keys.length === 0) return keys.map(() => null);

    try {
      const values = await this.redis.mget(...keys);
      return values.map((value) => {
        if (!value) return null;
        try {
          return JSON.parse(value) as T;
        } catch {
          return null;
        }
      });
    } catch (error) {
      logger.error('[REDIS] Failed to mget keys', { error, keys });
      return keys.map(() => null);
    }
  }

  /**
   * Batch set multiple keys
   */
  async mset(items: Array<{ key: string; value: unknown; ttl?: number }>): Promise<boolean> {
    if (!this.redis || items.length === 0) return false;

    try {
      const pipeline = this.redis.pipeline();

      for (const item of items) {
        const serialized = JSON.stringify(item.value);
        if (item.ttl) {
          pipeline.setex(item.key, item.ttl, serialized);
        } else {
          pipeline.set(item.key, serialized);
        }
      }

      await pipeline.exec();
      return true;
    } catch (error) {
      logger.error('[REDIS] Failed to mset keys', { error });
      return false;
    }
  }

  /**
   * Close Redis connection
   */
  async close(): Promise<void> {
    if (this.redis) {
      await this.redis.quit();
      redisClient = null;
      this.redis = null;
    }
  }
}

// Export singleton instance
export const redisCache = new RedisCache();

/**
 * Cache key generators
 */
export const CacheKeys = {
  // Venue caches
  venue: (venueId: string) => `venue:${venueId}`,
  venueMenu: (venueId: string) => `venue:${venueId}:menu`,
  venueTables: (venueId: string) => `venue:${venueId}:tables`,
  venueOrders: (venueId: string, status?: string) =>
    status ? `venue:${venueId}:orders:${status}` : `venue:${venueId}:orders`,

  // User caches
  user: (userId: string) => `user:${userId}`,
  userVenues: (userId: string) => `user:${userId}:venues`,
  userSession: (userId: string) => `user:${userId}:session`,

  // Order caches
  order: (orderId: string) => `order:${orderId}`,
  ordersByTable: (venueId: string, tableId: string) => `venue:${venueId}:table:${tableId}:orders`,

  // Analytics caches
  analytics: (venueId: string, metric: string, period: string) =>
    `analytics:${venueId}:${metric}:${period}`,

  // Rate limiting
  rateLimit: (clientId: string, route: string) => `ratelimit:${clientId}:${route}`,
};

