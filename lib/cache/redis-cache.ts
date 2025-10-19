/**
 * Redis Caching Layer
 * Provides high-performance caching for hot paths
 */

import { Redis } from 'ioredis';
import { logger } from '@/lib/logger';

// Singleton Redis client
let redisClient: Redis | null = null;

/**
 * Get or create Redis client
 */
function getRedisClient(): Redis | null {
  if (redisClient) return redisClient;

  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    logger.warn('[REDIS] REDIS_URL not configured, caching disabled');
    return null;
  }

  try {
    redisClient = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
    });

    redisClient.on('error', (error) => {
      logger.error('[REDIS] Connection error:', { error });
    });

    redisClient.on('connect', () => {
      logger.debug('[REDIS] Connected successfully');
    });

    return redisClient;
  } catch (error) {
    logger.error('[REDIS] Failed to create client:', { error });
    return null;
  }
}

/**
 * Cache options
 */
export interface CacheOptions {
  ttl?: number; // Time to live in seconds (default: 60)
  keyPrefix?: string; // Prefix for cache keys
}

/**
 * Cache a value with automatic JSON serialization
 */
export async function cacheJson<T>(
  key: string,
  getValue: () => Promise<T>,
  options: CacheOptions = {}
): Promise<T> {
  const { ttl = 60, keyPrefix = 'cache' } = options;
  const redis = getRedisClient();

  if (!redis) {
    // If Redis is not available, just return the value
    return getValue();
  }

  const fullKey = `${keyPrefix}:${key}`;

  try {
    // Try to get from cache
    const cached = await redis.get(fullKey);
    if (cached) {
      logger.debug('[CACHE HIT]', { key: fullKey });
      return JSON.parse(cached) as T;
    }

    // Cache miss - fetch value
    logger.debug('[CACHE MISS]', { key: fullKey });
    const value = await getValue();

    // Store in cache
    await redis.set(fullKey, JSON.stringify(value), 'EX', ttl);

    return value;
  } catch (error) {
    logger.error('[CACHE ERROR]', { key: fullKey, error });
    // On error, just return the value without caching
    return getValue();
  }
}

/**
 * Cache a value with custom serialization
 */
export async function cache<T>(
  key: string,
  getValue: () => Promise<T>,
  options: CacheOptions & { serialize?: (value: T) => string } = {}
): Promise<T> {
  const { ttl = 60, keyPrefix = 'cache', serialize = JSON.stringify } = options;
  const redis = getRedisClient();

  if (!redis) {
    return getValue();
  }

  const fullKey = `${keyPrefix}:${key}`;

  try {
    const cached = await redis.get(fullKey);
    if (cached) {
      logger.debug('[CACHE HIT]', { key: fullKey });
      return JSON.parse(cached) as T;
    }

    const value = await getValue();
    await redis.set(fullKey, serialize(value), 'EX', ttl);

    return value;
  } catch (error) {
    logger.error('[CACHE ERROR]', { key: fullKey, error });
    return getValue();
  }
}

/**
 * Invalidate a cache key
 */
export async function invalidateCache(
  key: string,
  keyPrefix = 'cache'
): Promise<void> {
  const redis = getRedisClient();
  if (!redis) return;

  const fullKey = `${keyPrefix}:${key}`;

  try {
    await redis.del(fullKey);
    logger.debug('[CACHE INVALIDATE]', { key: fullKey });
  } catch (error) {
    logger.error('[CACHE INVALIDATE ERROR]', { key: fullKey, error });
  }
}

/**
 * Invalidate multiple cache keys with pattern
 */
export async function invalidateCachePattern(
  pattern: string,
  keyPrefix = 'cache'
): Promise<void> {
  const redis = getRedisClient();
  if (!redis) return;

  const fullPattern = `${keyPrefix}:${pattern}`;

  try {
    const keys = await redis.keys(fullPattern);
    if (keys.length > 0) {
      await redis.del(...keys);
      logger.debug('[CACHE INVALIDATE PATTERN]', {
        pattern: fullPattern,
        count: keys.length,
      });
    }
  } catch (error) {
    logger.error('[CACHE INVALIDATE PATTERN ERROR]', {
      pattern: fullPattern,
      error,
    });
  }
}

/**
 * Get cache statistics
 */
export async function getCacheStats(): Promise<{
  connected: boolean;
  memory?: string;
  keys?: number;
}> {
  const redis = getRedisClient();
  if (!redis) {
    return { connected: false };
  }

  try {
    const info = await redis.info('memory');
    const keys = await redis.dbsize();

    return {
      connected: true,
      memory: info,
      keys,
    };
  } catch (error) {
    logger.error('[CACHE STATS ERROR]', { error });
    return { connected: false };
  }
}

/**
 * Flush all cache
 */
export async function flushCache(): Promise<void> {
  const redis = getRedisClient();
  if (!redis) return;

  try {
    await redis.flushdb();
    logger.warn('[CACHE FLUSH] All cache cleared');
  } catch (error) {
    logger.error('[CACHE FLUSH ERROR]', { error });
  }
}

