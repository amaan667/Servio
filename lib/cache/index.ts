/**
 * Unified Cache Interface
 * Supports both Redis and in-memory caching
 */

import { redisCache } from './redis';
import { logger } from '@/lib/logger';

interface CacheOptions {
  ttl?: number; // Time to live in seconds
}

class Cache {
  private memoryCache: Map<string, { value: any; expires: number }> = new Map();
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
  async set<T>(key: string, value: T, options: CacheOptions = {}): Promise<boolean> {
    const ttl = options.ttl || 300; // Default 5 minutes

    // Set in Redis if available
    if (this.useRedis) {
      return await redisCache.set(key, value, ttl);
    }

    // Fall back to memory cache
    try {
      this.memoryCache.set(key, {
        value,
        expires: Date.now() + ttl * 1000,
      });
      return true;
    } catch (error) {
      logger.error('[CACHE] Error setting memory cache:', error);
      return false;
    }
  }

  /**
   * Delete value from cache
   */
  async delete(key: string): Promise<boolean> {
    // Delete from Redis if available
    if (this.useRedis) {
      return await redisCache.delete(key);
    }

    // Delete from memory cache
    return this.memoryCache.delete(key);
  }

  /**
   * Delete multiple keys matching pattern
   */
  async deletePattern(pattern: string): Promise<boolean> {
    // Delete from Redis if available
    if (this.useRedis) {
      return await redisCache.deletePattern(pattern);
    }

    // Delete from memory cache
    const regex = new RegExp(pattern.replace('*', '.*'));
    let deleted = 0;
    
    for (const key of this.memoryCache.keys()) {
      if (regex.test(key)) {
        this.memoryCache.delete(key);
        deleted++;
      }
    }

    return deleted > 0;
  }

  /**
   * Clear all cache
   */
  async clear(): Promise<boolean> {
    // Clear Redis if available
    if (this.useRedis) {
      return await redisCache.clear();
    }

    // Clear memory cache
    this.memoryCache.clear();
    return true;
  }

  /**
   * Get or set with callback (cache-aside pattern)
   */
  async getOrSet<T>(
    key: string,
    callback: () => Promise<T>,
    options: CacheOptions = {}
  ): Promise<T> {
    // Try to get from cache
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    // Execute callback and cache result
    const value = await callback();
    await this.set(key, value, options);
    return value;
  }

  /**
   * Invalidate cache for venue
   */
  async invalidateVenue(venueId: string): Promise<boolean> {
    return await this.deletePattern(`*:${venueId}:*`);
  }

  /**
   * Invalidate cache for user
   */
  async invalidateUser(userId: string): Promise<boolean> {
    return await this.deletePattern(`*:user:${userId}:*`);
  }

  /**
   * Get cache statistics
   */
  getStats(): { size: number; type: 'redis' | 'memory' } {
    if (this.useRedis) {
      return { size: 0, type: 'redis' };
    }
    return { size: this.memoryCache.size, type: 'memory' };
  }
}

// Export singleton instance
export const cache = new Cache();

// Export types
export type { CacheOptions };

