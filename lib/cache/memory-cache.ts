/**
 * In-Memory Cache Implementation
 * Simple LRU cache for frequently accessed data
 */

interface CacheEntry<T> {
  value: T;
  expires: number;
}

class MemoryCache {
  private cache: Map<string, CacheEntry<unknown>>;
  private maxSize: number;
  private defaultTTL: number;

  constructor(maxSize = 1000, defaultTTL = 5 * 60 * 1000) {
    this.cache = new Map();
    this.maxSize = maxSize;
    this.defaultTTL = defaultTTL;
  }

  /**
   * Get item from cache
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;

    if (!entry) {
      return null;
    }

    // Check if expired
    if (Date.now() > entry.expires) {
      this.cache.delete(key);
      return null;
    }

    return entry.value;
  }

  /**
   * Set item in cache
   */
  set<T>(key: string, value: T, ttl?: number): void {
    // Evict oldest entries if cache is full
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey as string);
      }
    }

    this.cache.set(key, {
      value,
      expires: Date.now() + (ttl || this.defaultTTL),
    });
  }

  /**
   * Delete item from cache
   */
  delete(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get or set pattern
   */
  async getOrSet<T>(key: string, fetcher: () => Promise<T>, ttl?: number): Promise<T> {
    const cached = this.get<T>(key);

    if (cached !== null) {
      return cached;
    }

    const value = await fetcher();
    this.set(key, value, ttl);
    return value;
  }

  /**
   * Clean up expired entries
   */
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expires) {
        this.cache.delete(key);
      }
    }
  }
}

// Export singleton instance
export const memoryCache = new MemoryCache();

// Run cleanup every 5 minutes
if (typeof setInterval !== "undefined") {
  setInterval(
    () => {
      memoryCache.cleanup();
    },
    5 * 60 * 1000
  );
}

// Cache key builders for consistency
export const cacheKeys = {
  menuItems: (venueId: string) => `menu:${venueId}`,
  venueDetails: (venueId: string) => `venue:${venueId}`,
  userVenues: (userId: string) => `user:${userId}:venues`,
  dashboardCounts: (venueId: string) => `dashboard:${venueId}:counts`,
  orders: (venueId: string, status?: string) => `orders:${venueId}:${status || "all"}`,
  inventory: (venueId: string) => `inventory:${venueId}`,
  kdsStations: (venueId: string) => `kds:${venueId}:stations`,
  subscription: (orgId: string) => `subscription:${orgId}`,
} as const;
