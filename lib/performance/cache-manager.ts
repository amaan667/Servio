// Advanced client-side cache manager with LRU eviction
interface CacheEntry<T> {

}

interface CacheStats {

}

export class CacheManager<T = unknown> {
  private cache = new Map<string, CacheEntry<T>>();
  private maxSize: number;
  private maxAge: number;
  private stats: CacheStats = {

  };

  constructor(maxSize = 100, maxAge = 5 * 60 * 1000) {
    this.maxSize = maxSize;
    this.maxAge = maxAge;
  }

  set(key: string, data: T, ttl?: number): void {
    const now = Date.now();
    const expiresAt = now + (ttl || this.maxAge);
    const size = this.estimateSize(data);

    // Evict if cache is full
    if (this.cache.size >= this.maxSize) {
      this.evictLRU();
    }

    this.cache.set(key, {
      data,

      expiresAt,
      size,

    this.stats.size += size;
  }

  get(key: string): T | null {
    const entry = this.cache.get(key);

    if (!entry) {
      this.stats.misses++;
      return null;
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.delete(key);
      this.stats.misses++;
      return null;
    }

    // Update hit count and stats
    entry.hits++;
    this.stats.hits++;

    return entry.data;
  }

  delete(key: string): void {
    const entry = this.cache.get(key);
    if (entry) {
      this.stats.size -= entry.size;
      this.cache.delete(key);
    }
  }

  clear(): void {
    this.cache.clear();
    this.stats = {

    };
  }

  // LRU eviction strategy
  private evictLRU(): void {
    let lruKey: string | null = null;
    let lruTimestamp = Infinity;
    let lruHits = Infinity;

    // Find least recently used (lowest hits + oldest timestamp)
    for (const [key, entry] of this.cache.entries()) {
      const score = entry.hits + (Date.now() - entry.timestamp) / 1000;
      if (score < lruTimestamp + lruHits) {
        lruKey = key;
        lruTimestamp = entry.timestamp;
        lruHits = entry.hits;
      }
    }

    if (lruKey) {
      this.delete(lruKey);
      this.stats.evictions++;
    }
  }

  private estimateSize(data: T): number {
    try {
      return JSON.stringify(data).length;
    } catch {
      return 1;
    }
  }

  getStats(): CacheStats {
    return { ...this.stats };
  }

  // Cleanup expired entries
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.delete(key);
      }
    }
  }
}

// Global cache instances for different data types
export const apiCache = new CacheManager(200, 5 * 60 * 1000); // 5 minutes
export const imageCache = new CacheManager(100, 30 * 60 * 1000); // 30 minutes
export const staticCache = new CacheManager(50, 60 * 60 * 1000); // 1 hour

// Periodic cleanup
if (typeof window !== "undefined") {
  setInterval(() => {
    apiCache.cleanup();
    imageCache.cleanup();
    staticCache.cleanup();
  }, 60000); // Every minute
}
