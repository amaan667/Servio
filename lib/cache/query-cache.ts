import { redisCache, cacheUtils } from "./redis-cache";
import { logger } from "@/lib/logger";

interface QueryCacheOptions {
  ttl?: number;
  tags?: string[];
  skipCache?: boolean;
}

/**
 * Database query cache with automatic invalidation
 */
export class QueryCache {
  /**
   * Cache database query result
   */
  static async cacheQuery<T>(
    key: string,
    queryFn: () => Promise<T>,
    options: QueryCacheOptions = {}
  ): Promise<T> {
    const { ttl = 300, tags = [], skipCache = false } = options;

    // Skip cache if requested or in development
    if (skipCache || process.env.NODE_ENV === "development") {
      return await queryFn();
    }

    try {
      // Try to get from cache first
      const cached = await redisCache.get<T>(key);
      if (cached !== null) {
        logger.debug("[QUERY CACHE] Cache hit:", { key });
        return cached;
      }

      // Execute query and cache result
      logger.debug("[QUERY CACHE] Cache miss, executing query:", { key });
      const result = await queryFn();

      await redisCache.set(key, result, { ttl, tags });
      return result;
    } catch (_error) {
      logger.warn("[QUERY CACHE] Cache error, falling back to direct query:", error as Record<string, unknown>);
      return await queryFn();
    }
  }

  /**
   * Cache venue data
   */
  static async cacheVenueData<T>(
    venueId: string,
    dataType: string,
    queryFn: () => Promise<T>,
    options: QueryCacheOptions = {}
  ): Promise<T> {
    const key = cacheUtils.venueKey(venueId, dataType);
    const tags = [cacheUtils.tags.venue(venueId)];

    return this.cacheQuery(key, queryFn, { ...options, tags });
  }

  /**
   * Cache user data
   */
  static async cacheUserData<T>(
    userId: string,
    dataType: string,
    queryFn: () => Promise<T>,
    options: QueryCacheOptions = {}
  ): Promise<T> {
    const key = cacheUtils.userKey(userId, dataType);
    const tags = [cacheUtils.tags.user(userId)];

    return this.cacheQuery(key, queryFn, { ...options, tags });
  }

  /**
   * Cache orders with filters
   */
  static async cacheOrders<T>(
    venueId: string,
    filters: Record<string, unknown>,
    queryFn: () => Promise<T>,
    options: QueryCacheOptions = {}
  ): Promise<T> {
    const key = cacheUtils.ordersKey(venueId, filters);
    const tags = [cacheUtils.tags.orders(venueId)];

    return this.cacheQuery(key, queryFn, { ...options, tags });
  }

  /**
   * Cache menu items
   */
  static async cacheMenuItems<T>(
    venueId: string,
    queryFn: () => Promise<T>,
    options: QueryCacheOptions = {}
  ): Promise<T> {
    const key = cacheUtils.menuKey(venueId);
    const tags = [cacheUtils.tags.menu(venueId)];

    return this.cacheQuery(key, queryFn, { ...options, tags });
  }

  /**
   * Cache tables
   */
  static async cacheTables<T>(
    venueId: string,
    queryFn: () => Promise<T>,
    options: QueryCacheOptions = {}
  ): Promise<T> {
    const key = cacheUtils.tablesKey(venueId);
    const tags = [cacheUtils.tags.tables(venueId)];

    return this.cacheQuery(key, queryFn, { ...options, tags });
  }

  /**
   * Invalidate venue cache
   */
  static async invalidateVenue(venueId: string): Promise<void> {
    const tags = [
      cacheUtils.tags.venue(venueId),
      cacheUtils.tags.orders(venueId),
      cacheUtils.tags.menu(venueId),
      cacheUtils.tags.tables(venueId),
    ];

    await redisCache.invalidateByTags(tags);
    logger.info("[QUERY CACHE] Invalidated venue cache:", { venueId });
  }

  /**
   * Invalidate user cache
   */
  static async invalidateUser(userId: string): Promise<void> {
    const tags = [cacheUtils.tags.user(userId)];
    await redisCache.invalidateByTags(tags);
    logger.info("[QUERY CACHE] Invalidated user cache:", { userId });
  }

  /**
   * Invalidate orders cache
   */
  static async invalidateOrders(venueId: string): Promise<void> {
    const tags = [cacheUtils.tags.orders(venueId)];
    await redisCache.invalidateByTags(tags);
    logger.info("[QUERY CACHE] Invalidated orders cache:", { venueId });
  }

  /**
   * Invalidate menu cache
   */
  static async invalidateMenu(venueId: string): Promise<void> {
    const tags = [cacheUtils.tags.menu(venueId)];
    await redisCache.invalidateByTags(tags);
    logger.info("[QUERY CACHE] Invalidated menu cache:", { venueId });
  }

  /**
   * Invalidate tables cache
   */
  static async invalidateTables(venueId: string): Promise<void> {
    const tags = [cacheUtils.tags.tables(venueId)];
    await redisCache.invalidateByTags(tags);
    logger.info("[QUERY CACHE] Invalidated tables cache:", { venueId });
  }

  /**
   * Clear all cache
   */
  static async clearAll(): Promise<void> {
    await redisCache.clear();
    logger.info("[QUERY CACHE] Cleared all cache");
  }

  /**
   * Get cache statistics
   */
  static async getStats() {
    return await redisCache.getStats();
  }
}

/**
 * Cache middleware for API routes
 */
export function withCache(options: QueryCacheOptions = {}) {
  return function (target: unknown, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;

    descriptor.value = async function (...args: unknown[]) {
      const cacheKey = `${target.constructor.name}:${propertyName}:${JSON.stringify(args)}`;

      return QueryCache.cacheQuery(cacheKey, () => method.apply(this, args), options);
    };
  };
}
