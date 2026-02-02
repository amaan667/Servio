# Query Result Caching

This document describes the implementation of query result caching for the Servio platform.

## Table of Contents

1. [Overview](#overview)
2. [Features](#features)
3. [Configuration](#configuration)
4. [Implementation](#implementation)
5. [Invalidation](#invalidation)
6. [Best Practices](#best-practices)

## Overview

Query result caching is a technique to store query results in memory to reduce database load and improve performance:

- **Reduced Load:** Reduce database load by caching results
- **Improved Performance:** Improve performance by serving cached results
- **Scalability:** Scale database queries effectively
- **Cost Effective:** Reduce database costs

## Features

### Configuration

```typescript
// lib/cache/query-cache.ts
import { Redis } from 'ioredis';

export interface QueryCacheConfig {
  enabled: boolean;
  ttl: number; // Time to live in seconds
  maxSize: number; // Maximum number of cached queries
  keyPrefix: string;
  compression: boolean;
  serialization: 'json' | 'msgpack';
}

export const DEFAULT_CACHE_CONFIG: QueryCacheConfig = {
  enabled: true,
  ttl: 300, // 5 minutes
  maxSize: 10000,
  keyPrefix: 'query:',
  compression: true,
  serialization: 'json',
};

export class QueryCache {
  private redis: Redis;
  private config: QueryCacheConfig;
  private cacheStats: CacheStats = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
  };

  constructor(redis: Redis, config: QueryCacheConfig = DEFAULT_CACHE_CONFIG) {
    this.redis = redis;
    this.config = config;
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.config.enabled) {
      return null;
    }

    const cacheKey = this.getCacheKey(key);

    try {
      const value = await this.redis.get(cacheKey);

      if (value === null) {
        this.cacheStats.misses++;
        return null;
      }

      this.cacheStats.hits++;

      // Decompress if needed
      const decompressed = this.config.compression
        ? await this.decompress(value)
        : value;

      // Deserialize
      return this.deserialize<T>(decompressed);
    } catch (error) {
      console.error('Cache get error:', error);
      return null;
    }
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    const cacheKey = this.getCacheKey(key);

    try {
      // Serialize
      const serialized = this.serialize(value);

      // Compress if needed
      const compressed = this.config.compression
        ? await this.compress(serialized)
        : serialized;

      // Set with TTL
      await this.redis.setex(cacheKey, ttl || this.config.ttl, compressed);

      this.cacheStats.sets++;
    } catch (error) {
      console.error('Cache set error:', error);
    }
  }

  async delete(key: string): Promise<void> {
    const cacheKey = this.getCacheKey(key);

    try {
      await this.redis.del(cacheKey);
      this.cacheStats.deletes++;
    } catch (error) {
      console.error('Cache delete error:', error);
    }
  }

  async deletePattern(pattern: string): Promise<void> {
    const cachePattern = this.getCacheKey(pattern);

    try {
      const keys = await this.redis.keys(cachePattern);

      if (keys.length > 0) {
        await this.redis.del(...keys);
        this.cacheStats.deletes += keys.length;
      }
    } catch (error) {
      console.error('Cache delete pattern error:', error);
    }
  }

  async clear(): Promise<void> {
    try {
      const keys = await this.redis.keys(`${this.config.keyPrefix}*`);

      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
    } catch (error) {
      console.error('Cache clear error:', error);
    }
  }

  getStats(): CacheStats {
    return { ...this.cacheStats };
  }

  resetStats(): void {
    this.cacheStats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
    };
  }

  private getCacheKey(key: string): string {
    return `${this.config.keyPrefix}${key}`;
  }

  private serialize<T>(value: T): string {
    if (this.config.serialization === 'json') {
      return JSON.stringify(value);
    } else {
      // Use msgpack for binary serialization
      const msgpack = require('msgpack-lite');
      return msgpack.encode(value).toString('base64');
    }
  }

  private deserialize<T>(value: string): T {
    if (this.config.serialization === 'json') {
      return JSON.parse(value);
    } else {
      const msgpack = require('msgpack-lite');
      return msgpack.decode(Buffer.from(value, 'base64'));
    }
  }

  private async compress(value: string): Promise<string> {
    const zlib = require('zlib');
    const gzip = require('util').promisify(zlib.gzip);

    const compressed = await gzip(value);
    return compressed.toString('base64');
  }

  private async decompress(value: string): Promise<string> {
    const zlib = require('zlib');
    const gunzip = require('util').promisify(zlib.gunzip);

    const decompressed = await gunzip(Buffer.from(value, 'base64'));
    return decompressed.toString();
  }
}

interface CacheStats {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
}

// Singleton instance
let queryCache: QueryCache | null = null;

export function getQueryCache(): QueryCache {
  if (!queryCache) {
    const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
    queryCache = new QueryCache(redis);
  }

  return queryCache;
}
```

### Cached Query Wrapper

```typescript
// lib/cache/cached-query.ts
import { getQueryCache } from './query-cache';

export interface CachedQueryOptions {
  key: string;
  ttl?: number;
  enabled?: boolean;
}

export async function cachedQuery<T>(
  queryFn: () => Promise<T>,
  options: CachedQueryOptions
): Promise<T> {
  const cache = getQueryCache();

  // Check if caching is enabled
  if (options.enabled === false) {
    return queryFn();
  }

  // Try to get from cache
  const cached = await cache.get<T>(options.key);

  if (cached !== null) {
    return cached;
  }

  // Execute query
  const result = await queryFn();

  // Cache result
  await cache.set(options.key, result, options.ttl);

  return result;
}

export async function invalidateCache(pattern: string): Promise<void> {
  const cache = getQueryCache();
  await cache.deletePattern(pattern);
}

export async function clearCache(): Promise<void> {
  const cache = getQueryCache();
  await cache.clear();
}
```

## Implementation

### Repository Pattern with Caching

```typescript
// lib/repositories/cached-repository.ts
import { BaseRepository } from './base-repository';
import { cachedQuery, invalidateCache } from '../cache/cached-query';

export class CachedRepository extends BaseRepository {
  protected async findByIdCached<T>(table: string, id: string, ttl?: number): Promise<T> {
    return cachedQuery(
      () => this.findById(table, id),
      {
        key: `${table}:${id}`,
        ttl,
      }
    );
  }

  protected async findAllCached<T>(table: string, options?: { limit?: number; offset?: number }, ttl?: number): Promise<T[]> {
    const cacheKey = `${table}:all:${options?.limit || 'all'}:${options?.offset || 0}`;

    return cachedQuery(
      () => this.findAll(table, options),
      {
        key: cacheKey,
        ttl,
      }
    );
  }

  protected async findManyCached<T>(table: string, conditions: any, ttl?: number): Promise<T[]> {
    const cacheKey = `${table}:${JSON.stringify(conditions)}`;

    return cachedQuery(
      () => this.findMany(table, conditions),
      {
        key: cacheKey,
        ttl,
      }
    );
  }

  protected async insertCached<T>(table: string, data: any): Promise<T> {
    const result = await this.insert(table, data);

    // Invalidate cache
    await invalidateCache(`${table}:*`);

    return result;
  }

  protected async updateCached<T>(table: string, id: string, data: any): Promise<T> {
    const result = await this.update(table, id, data);

    // Invalidate cache
    await invalidateCache(`${table}:*`);
    await invalidateCache(`${table}:${id}`);

    return result;
  }

  protected async deleteCached<T>(table: string, id: string): Promise<T> {
    const result = await this.delete(table, id);

    // Invalidate cache
    await invalidateCache(`${table}:*`);
    await invalidateCache(`${table}:${id}`);

    return result;
  }
}
```

### Service Layer with Caching

```typescript
// lib/services/CachedService.ts
import { BaseService } from './BaseService';
import { cachedQuery, invalidateCache } from '../cache/cached-query';

export abstract class CachedService extends BaseService {
  protected async getCached<T>(key: string, queryFn: () => Promise<T>, ttl?: number): Promise<T> {
    return cachedQuery(queryFn, { key, ttl });
  }

  protected async invalidateCache(pattern: string): Promise<void> {
    await invalidateCache(pattern);
  }
}
```

## Invalidation

### Cache Invalidation Strategies

```typescript
// lib/cache/invalidation.ts
import { getQueryCache } from './query-cache';

export class CacheInvalidator {
  private cache = getQueryCache();

  // Time-based invalidation
  async invalidateByTime(key: string, ttl: number): Promise<void> {
    await this.cache.set(key, null, ttl);
  }

  // Event-based invalidation
  async invalidateByEvent(event: CacheEvent): Promise<void> {
    switch (event.type) {
      case 'insert':
        await this.invalidateByInsert(event.table, event.data);
        break;
      case 'update':
        await this.invalidateByUpdate(event.table, event.id, event.data);
        break;
      case 'delete':
        await this.invalidateByDelete(event.table, event.id);
        break;
    }
  }

  private async invalidateByInsert(table: string, data: any): Promise<void> {
    // Invalidate all queries for this table
    await this.cache.deletePattern(`${table}:*`);

    // Invalidate related queries
    await this.invalidateRelatedQueries(table, data);
  }

  private async invalidateByUpdate(table: string, id: string, data: any): Promise<void> {
    // Invalidate specific query
    await this.cache.delete(`${table}:${id}`);

    // Invalidate all queries for this table
    await this.cache.deletePattern(`${table}:*`);

    // Invalidate related queries
    await this.invalidateRelatedQueries(table, data);
  }

  private async invalidateByDelete(table: string, id: string): Promise<void> {
    // Invalidate specific query
    await this.cache.delete(`${table}:${id}`);

    // Invalidate all queries for this table
    await this.cache.deletePattern(`${table}:*`);
  }

  private async invalidateRelatedQueries(table: string, data: any): Promise<void> {
    // Invalidate related queries based on foreign keys
    const relations = this.getRelations(table);

    for (const relation of relations) {
      const foreignKey = data[relation.foreignKey];

      if (foreignKey) {
        await this.cache.deletePattern(`${relation.table}:${foreignKey}:*`);
      }
    }
  }

  private getRelations(table: string): Relation[] {
    // Define table relations
    const relations: Record<string, Relation[]> = {
      orders: [
        { table: 'venues', foreignKey: 'venue_id' },
        { table: 'users', foreignKey: 'user_id' },
      ],
      menu_items: [
        { table: 'venues', foreignKey: 'venue_id' },
      ],
      // Add more relations...
    };

    return relations[table] || [];
  }
}

interface CacheEvent {
  type: 'insert' | 'update' | 'delete';
  table: string;
  id?: string;
  data: any;
}

interface Relation {
  table: string;
  foreignKey: string;
}

// Singleton instance
let cacheInvalidator: CacheInvalidator | null = null;

export function getCacheInvalidator(): CacheInvalidator {
  if (!cacheInvalidator) {
    cacheInvalidator = new CacheInvalidator();
  }

  return cacheInvalidator;
}
```

## Best Practices

### 1. Cache Read-Heavy Queries

Cache read-heavy queries:

```typescript
// Good: Cache read-heavy queries
const orders = await this.findAllCached('orders', { limit: 100 }, 300);

// Bad: Cache write-heavy queries
const orders = await this.findAllCached('orders', { limit: 100 }, 300);
await this.insertCached('orders', data); // This will invalidate cache
```

### 2. Set Appropriate TTL

Set appropriate TTL:

```typescript
// Good: Appropriate TTL
const orders = await this.findAllCached('orders', { limit: 100 }, 300); // 5 minutes

// Bad: Too short TTL
const orders = await this.findAllCached('orders', { limit: 100 }, 10); // 10 seconds

// Bad: Too long TTL
const orders = await this.findAllCached('orders', { limit: 100 }, 86400); // 1 day
```

### 3. Invalidate Cache on Writes

Invalidate cache on writes:

```typescript
// Good: Invalidate cache on writes
const result = await this.insert(table, data);
await invalidateCache(`${table}:*`);

// Bad: No cache invalidation
const result = await this.insert(table, data);
// No cache invalidation
```

### 4. Use Cache Keys Wisely

Use cache keys wisely:

```typescript
// Good: Use cache keys wisely
const cacheKey = `${table}:${id}`;
const cacheKey = `${table}:all:${limit}:${offset}`;
const cacheKey = `${table}:${JSON.stringify(conditions)}`;

// Bad: Poor cache keys
const cacheKey = 'query';
const cacheKey = `${table}`;
```

### 5. Monitor Cache Performance

Monitor cache performance:

```typescript
// Good: Monitor cache performance
const stats = cache.getStats();
const hitRate = stats.hits / (stats.hits + stats.misses);
console.log(`Cache hit rate: ${hitRate}`);

// Bad: No monitoring
// No monitoring
```

### 6. Use Compression

Use compression for large values:

```typescript
// Good: Use compression
const config = {
  compression: true,
};

// Bad: No compression
const config = {
  compression: false,
};
```

### 7. Document Cache Strategy

Document cache strategy:

```markdown
# Good: Document cache strategy
## Cache Strategy

- Orders: 5 minutes TTL
- Menu items: 10 minutes TTL
- Venues: 30 minutes TTL

# Bad: No documentation
# No documentation
```

## References

- [Redis Caching](https://redis.io/docs/manual/patterns/caching/)
- [Query Caching](https://www.postgresql.org/docs/current/sql-explain.html)
- [Cache Invalidation](https://martinfowler.com/bliki/TwoHardThings.html)
- [Caching Best Practices](https://aws.amazon.com/blogs/database/best-practices-for-working-with-postgresql/)
