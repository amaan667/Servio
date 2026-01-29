/**
 * Redis Cache Implementation
 * Provides high-performance caching with Redis
 */

import Redis from "ioredis";

let redis: Redis | null = null;

function getRedisClient(): Redis | null {
  if (redis) {
    return redis;
  }

  const redisUrl = process.env.REDIS_URL;

  if (!redisUrl) {
    return null;
  }

  try {
    redis = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      reconnectOnError(err) {
        const targetError = "READONLY";
        if (err.message.includes(targetError)) {
          return true;
        }
        return false;
      },
    });

    redis.on("error", (_err) => {
      // Redis connection error handled silently
    });

    redis.on("connect", () => {
      /* Empty */
    });

    return redis;
  } catch (_error) {
    return null;
  }
}

export class RedisCache {
  private client: Redis | null;

  constructor() {
    this.client = getRedisClient();
  }

  /**
   * Get value from cache
   */
  async get<T>(key: string): Promise<T | null> {
    if (!this.client) {
      return null;
    }

    try {
      const value = await this.client.get(key);
      if (!value) {
        return null;
      }
      return JSON.parse(value) as T;
    } catch (_error) {
      return null;
    }
  }

  /**
   * Set value in cache with TTL
   */
  async set<T>(key: string, value: T, ttlSeconds: number = 300): Promise<boolean> {
    if (!this.client) {
      return false;
    }

    try {
      await this.client.setex(key, ttlSeconds, JSON.stringify(value));
      return true;
    } catch (_error) {
      return false;
    }
  }

  /**
   * Delete value from cache
   */
  async delete(key: string): Promise<boolean> {
    if (!this.client) {
      return false;
    }

    try {
      await this.client.del(key);
      return true;
    } catch (_error) {
      return false;
    }
  }

  /**
   * Delete multiple keys matching pattern
   */
  async deletePattern(pattern: string): Promise<boolean> {
    if (!this.client) {
      return false;
    }

    try {
      const keys = await this.client.keys(pattern);
      if (keys.length > 0) {
        await this.client.del(...keys);
      }
      return true;
    } catch (_error) {
      return false;
    }
  }

  /**
   * Check if key exists
   */
  async exists(key: string): Promise<boolean> {
    if (!this.client) {
      return false;
    }

    try {
      const result = await this.client.exists(key);
      return result === 1;
    } catch (_error) {
      return false;
    }
  }

  /**
   * Get TTL for key
   */
  async ttl(key: string): Promise<number> {
    if (!this.client) {
      return -1;
    }

    try {
      return await this.client.ttl(key);
    } catch (_error) {
      return -1;
    }
  }

  /**
   * Increment counter
   */
  async increment(key: string, by: number = 1): Promise<number> {
    if (!this.client) {
      return 0;
    }

    try {
      return await this.client.incrby(key, by);
    } catch (_error) {
      return 0;
    }
  }

  /**
   * Get multiple keys at once
   */
  async mget<T>(keys: string[]): Promise<(T | null)[]> {
    if (!this.client || keys.length === 0) {
      return [];
    }

    try {
      const values = await this.client.mget(...keys);
      return values.map((v) => (v ? JSON.parse(v) : null)) as T[];
    } catch (_error) {
      return [];
    }
  }

  /**
   * Set multiple key-value pairs
   */
  async mset(items: Array<{ key: string; value: unknown; ttl?: number }>): Promise<boolean> {
    if (!this.client || items.length === 0) {
      return false;
    }

    try {
      const pipeline = this.client.pipeline();

      for (const item of items) {
        if (item.ttl) {
          pipeline.setex(item.key, item.ttl, JSON.stringify(item.value));
        } else {
          pipeline.set(item.key, JSON.stringify(item.value));
        }
      }

      await pipeline.exec();
      return true;
    } catch (_error) {
      return false;
    }
  }

  /**
   * Clear all cache (use with caution!)
   */
  async clear(): Promise<boolean> {
    if (!this.client) {
      return false;
    }

    try {
      await this.client.flushdb();
      return true;
    } catch (_error) {
      return false;
    }
  }

  /**
   * Close Redis connection
   */
  async close(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      redis = null;
    }
  }
}

// Export singleton instance
export const redisCache = new RedisCache();
