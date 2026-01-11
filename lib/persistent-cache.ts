/**
 * Persistent Cache Utility
 *
 * Uses sessionStorage to cache data across page navigations
 * Eliminates flickering and loading states on return visits
 */

export class PersistentCache {
  private static prefix = "servio_cache_";

  /**
   * Get cached data by key
   */
  static get<T>(key: string): T | null {
    if (typeof window === "undefined") return null;

    try {
      const cached = sessionStorage.getItem(this.prefix + key);
      if (!cached) return null;

      const parsed = JSON.parse(cached);

      // Check if expired (optional TTL)
      if (parsed.expiresAt && Date.now() > parsed.expiresAt) {
        this.remove(key);
        return null;
      }

      return parsed.data as T;
    } catch (_error) {
      return null;
    }
  }

  /**
   * Set cached data with optional TTL (time-to-live in ms)
   */
  static set<T>(key: string, data: T, ttl?: number): void {
    if (typeof window === "undefined") return;

    try {
      const cacheData = {
        data,
        expiresAt: ttl ? Date.now() + ttl : null,
        cachedAt: Date.now(),
      };

      sessionStorage.setItem(this.prefix + key, JSON.stringify(cacheData));
    } catch (_error) {
      // Error handled silently
    }
  }

  /**
   * Remove cached data
   */
  static remove(key: string): void {
    if (typeof window === "undefined") return;

    try {
      sessionStorage.removeItem(this.prefix + key);
    } catch (_error) {
      // Error handled silently
    }
  }

  /**
   * Clear all cached data
   */
  static clear(): void {
    if (typeof window === "undefined") return;

    try {
      const keys = Object.keys(sessionStorage);
      keys.forEach((key) => {
        if (key.startsWith(this.prefix)) {
          sessionStorage.removeItem(key);
        }
      });
    } catch (_error) {
      // Error handled silently
    }
  }

  /**
   * Get cache size (in bytes)
   */
  static getSize(): number {
    if (typeof window === "undefined") return 0;

    try {
      let size = 0;
      const keys = Object.keys(sessionStorage);
      keys.forEach((key) => {
        if (key.startsWith(this.prefix)) {
          const value = sessionStorage.getItem(key);
          size += key.length + (value?.length || 0);
        }
      });
      return size;
    } catch {
      return 0;
    }
  }
}

/**
 * React hook for persistent query with cache
 */
export function getCachedQueryData<T>(queryKey: string[]): T | undefined {
  const cacheKey = queryKey.join("_");
  return PersistentCache.get<T>(cacheKey) || undefined;
}

export function setCachedQueryData<T>(queryKey: string[], data: T, ttl?: number): void {
  const cacheKey = queryKey.join("_");
  PersistentCache.set(cacheKey, data, ttl);
}
