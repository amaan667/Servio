// ============================================================================
// COALESCING CACHE (REQUEST DEDUPLICATION)
// Prevents cache stampede by coalescing concurrent requests for the same key
// ============================================================================

export interface CacheCoalescerConfig {
  ttlMs: number;
  lockTimeoutMs: number;
  maxConcurrent: number;
}

export interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

export interface PendingRequest<T> {
  promise: Promise<T>;
  count: number;
  timestamp: number;
}

export const DEFAULT_CACHE_COALESCER_CONFIG: CacheCoalescerConfig = {
  ttlMs: 30000,
  lockTimeoutMs: 5000,
  maxConcurrent: 10,
};

export class CacheCoalescer<T = unknown> {
  private cache = new Map<string, CacheEntry<T>>();
  private pending = new Map<string, PendingRequest<T>>();

  constructor(
    private config: CacheCoalescerConfig = DEFAULT_CACHE_COALESCER_CONFIG,
    private fetcher?: (key: string) => Promise<T>
  ) {}

  async get(key: string, fetcher?: () => Promise<T>): Promise<T> {
    const effectiveFetcher = fetcher ?? this.fetcher;
    const cached = this.cache.get(key);
    if (cached && Date.now() < cached.expiresAt) {
      return cached.data;
    }

    const existing = this.pending.get(key);
    if (existing) {
      existing.count++;
      return existing.promise;
    }

    if (!effectiveFetcher) {
      throw new Error("No fetcher provided");
    }

    const promise = effectiveFetcher(key).then((data) => {
      this.cache.set(key, { data, expiresAt: Date.now() + this.config.ttlMs });
      this.pending.delete(key);
      return data;
    });

    this.pending.set(key, { promise, count: 1, timestamp: Date.now() });

    return promise;
  }

  invalidate(key: string): void {
    this.cache.delete(key);
    this.pending.delete(key);
  }

  clear(): void {
    this.cache.clear();
    this.pending.clear();
  }

  getStats() {
    return { size: this.cache.size, pendingCount: this.pending.size };
  }

  cleanup(): number {
    const now = Date.now();
    let removed = 0;
    for (const [key, entry] of this.cache.entries()) {
      if (now >= entry.expiresAt) {
        this.cache.delete(key);
        removed++;
      }
    }
    return removed;
  }
}

export interface StampedeProtectionConfig {
  baseTtlMs: number;
  earlyExpirationPercent: number;
  refreshProbability: number;
}

export const DEFAULT_STAMPEDE_PROTECTION_CONFIG: StampedeProtectionConfig = {
  baseTtlMs: 30000,
  earlyExpirationPercent: 80,
  refreshProbability: 0.5,
};

export class StampedeProtectedCache<T = unknown> {
  private cache = new Map<string, CacheEntry<T>>();
  private config: StampedeProtectionConfig;

  constructor(config?: Partial<StampedeProtectionConfig>) {
    this.config = { ...DEFAULT_STAMPEDE_PROTECTION_CONFIG, ...config };
  }

  async get(key: string, fetcher: () => Promise<T>): Promise<T> {
    const entry = this.cache.get(key);

    if (entry && Date.now() < entry.expiresAt) {
      const ttlRemaining = entry.expiresAt - Date.now();
      const threshold = this.config.baseTtlMs * (this.config.earlyExpirationPercent / 100);

      if (ttlRemaining < threshold && Math.random() < this.config.refreshProbability) {
        this.refresh(key, fetcher).catch(() => {});
      }

      return entry.data;
    }

    return this.refresh(key, fetcher);
  }

  private async refresh(key: string, fetcher: () => Promise<T>): Promise<T> {
    const data = await fetcher();
    this.cache.set(key, { data, expiresAt: Date.now() + this.config.baseTtlMs });
    return data;
  }

  invalidate(key: string): void {
    this.cache.delete(key);
  }

  size(): number {
    return this.cache.size;
  }

  clear(): void {
    this.cache.clear();
  }
}
