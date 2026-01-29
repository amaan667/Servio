import { Redis } from "ioredis";

interface CacheOptions {
  ttl?: number; // Time to live in seconds
  tags?: string[]; // Cache tags for invalidation
}

class RedisCache {
  private redis: Redis | null = null;
  private isConnected = false;

  constructor() {
    this.initializeRedis();
  }

  private async initializeRedis() {
    try {
      if (process.env.REDIS_URL) {
        this.redis = new Redis(process.env.REDIS_URL, {
          maxRetriesPerRequest: 3,
          lazyConnect: true,
        });

        this.redis.on("connect", () => {
          this.isConnected = true;
        });

        this.redis.on("error", (_error) => {
          this.isConnected = false;
          // Redis connection error handled silently
        });

        await this.redis.connect();
      } else {
        // Block handled
      }
    } catch (_error) {
      /* Error handled silently */
    }
  }

  /**
   * Get value from cache
   */
  async get<T>(key: string): Promise<T | null> {
    if (!this.redis || !this.isConnected) {
      return null;
    }

    try {
      const value = await this.redis.get(key);
      if (value) {
        return JSON.parse(value);
      }
      return null;
    } catch (_error) {
      return null;
    }
  }

  /**
   * Set value in cache
   */
  async set(
    key: string,
    value: unknown,
    options: CacheOptions = {
      /* Empty */
    }
  ): Promise<boolean> {
    if (!this.redis || !this.isConnected) {
      return false;
    }

    try {
      const serialized = JSON.stringify(value);
      const ttl = options.ttl || 3600; // Default 1 hour

      if (options.tags && options.tags.length > 0) {
        // Store with tags for invalidation
        const pipeline = this.redis.pipeline();
        pipeline.setex(key, ttl, serialized);

        // Add to tag sets
        options.tags.forEach((tag) => {
          pipeline.sadd(`tag:${tag}`, key);
          pipeline.expire(`tag:${tag}`, ttl);
        });

        await pipeline.exec();
      } else {
        await this.redis.setex(key, ttl, serialized);
      }

      return true;
    } catch (_error) {
      return false;
    }
  }

  /**
   * Delete value from cache
   */
  async delete(key: string): Promise<boolean> {
    if (!this.redis || !this.isConnected) {
      return false;
    }

    try {
      await this.redis.del(key);
      return true;
    } catch (_error) {
      return false;
    }
  }

  /**
   * Invalidate cache by tags
   */
  async invalidateByTags(tags: string[]): Promise<boolean> {
    if (!this.redis || !this.isConnected) {
      return false;
    }

    try {
      const pipeline = this.redis.pipeline();

      for (const tag of tags) {
        const keys = await this.redis.smembers(`tag:${tag}`);
        if (keys.length > 0) {
          pipeline.del(...keys);
          pipeline.del(`tag:${tag}`);
        }
      }

      await pipeline.exec();
      return true;
    } catch (_error) {
      return false;
    }
  }

  /**
   * Clear all cache
   */
  async clear(): Promise<boolean> {
    if (!this.redis || !this.isConnected) {
      return false;
    }

    try {
      await this.redis.flushdb();
      return true;
    } catch (_error) {
      return false;
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{
    connected: boolean;
    memory: string;
    keys: number;
    hits: number;
    misses: number;
  }> {
    if (!this.redis || !this.isConnected) {
      return {
        connected: false,
        memory: "0B",
        keys: 0,
        hits: 0,
        misses: 0,
      };
    }

    try {
      const info = await this.redis.info("memory");
      const keys = await this.redis.dbsize();

      return {
        connected: true,
        memory: this.parseMemoryInfo(info),
        keys,
        hits: 0, // Would need to track these separately
        misses: 0,
      };
    } catch (_error) {
      return {
        connected: false,
        memory: "0B",
        keys: 0,
        hits: 0,
        misses: 0,
      };
    }
  }

  private parseMemoryInfo(info: string): string {
    const match = info.match(/used_memory_human:([^\r\n]+)/);
    return (match?.[1] ?? "").trim() || "0B";
  }
}

// Singleton instance
export const redisCache = new RedisCache();

/**
 * Cache decorator for functions
 */
export function cached(ttl: number = 3600, tags: string[] = []) {
  return function (target: unknown, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;

    descriptor.value = async function (...args: unknown[]) {
      const targetName =
        (target &&
          typeof target === "object" &&
          "constructor" in target &&
          target.constructor?.name) ||
        "Unknown";
      const cacheKey = `${targetName}:${propertyName}:${JSON.stringify(args)}`;

      // Try to get from cache
      const cached = await redisCache.get(cacheKey);
      if (cached !== null) {
        return cached;
      }

      // Execute method and cache result
      const result = await method.apply(this, args);
      await redisCache.set(cacheKey, result, { ttl, tags });

      return result;
    };
  };
}

/**
 * Cache utility functions
 */
export const cacheUtils = {
  /**
   * Generate cache key for venue data
   */
  venueKey: (venueId: string, dataType: string) => `venue:${venueId}:${dataType}`,

  /**
   * Generate cache key for user data
   */
  userKey: (userId: string, dataType: string) => `user:${userId}:${dataType}`,

  /**
   * Generate cache key for orders
   */
  ordersKey: (
    venueId: string,
    filters: Record<string, unknown> = {
      /* Empty */
    }
  ) => `orders:${venueId}:${JSON.stringify(filters)}`,

  /**
   * Generate cache key for menu items
   */
  menuKey: (venueId: string) => `menu:${venueId}`,

  /**
   * Generate cache key for tables
   */
  tablesKey: (venueId: string) => `tables:${venueId}`,

  /**
   * Cache tags for invalidation
   */
  tags: {
    venue: (venueId: string) => `venue:${venueId}`,
    user: (userId: string) => `user:${userId}`,
    orders: (venueId: string) => `orders:${venueId}`,
    menu: (venueId: string) => `menu:${venueId}`,
    tables: (venueId: string) => `tables:${venueId}`,
  },
};
