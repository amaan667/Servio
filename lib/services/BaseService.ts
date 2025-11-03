/**
 * Base Service
 * Provides common functionality for all services
 */

import { cache } from "@/lib/cache";

export abstract class BaseService {
  protected cache = cache;

  /**
   * Get cache key with prefix
   */
  protected getCacheKey(prefix: string, ...parts: (string | number)[]): string {
    return `${prefix}:${parts.join(":")}`;
  }

  /**
   * Execute with caching
   * Disables caching in test mode (when NODE_ENV=test)
   */
  protected async withCache<T>(
    key: string,
    callback: () => Promise<T>,
    ttl: number = 300
  ): Promise<T> {
    // Skip caching in test mode
    if (process.env.NODE_ENV === "test") {
      return callback();
    }

    // Try to get from cache first
    const cached = await this.cache.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    // Execute callback and cache result
    const value = await callback();
    await this.cache.set(key, value, { ttl });
    return value;
  }

  /**
   * Invalidate cache
   */
  protected async invalidateCache(key: string): Promise<void> {
    if (process.env.NODE_ENV === "test") return;
    await this.cache.delete(key);
  }

  /**
   * Invalidate cache pattern
   */
  protected async invalidateCachePattern(pattern: string): Promise<void> {
    if (process.env.NODE_ENV === "test") return;
    await this.cache.invalidate(pattern);
  }
}
