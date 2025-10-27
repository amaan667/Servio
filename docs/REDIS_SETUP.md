# Redis Setup Guide

## Overview

Servio uses Redis for:
1. **Caching** - API response caching (orders, menu, analytics)
2. **Rate Limiting** - API endpoint protection
3. **Queue Management** - Background job processing (BullMQ)

## Configuration

### Environment Variable

Add to `.env.local`:
```bash
REDIS_URL=redis://localhost:6379
# Or for Redis Cloud/Upstash:
REDIS_URL=rediss://default:password@host:port
```

### Local Development

**Option 1: Docker**
```bash
docker run -d -p 6379:6379 redis:7-alpine
```

**Option 2: Homebrew (macOS)**
```bash
brew install redis
brew services start redis
```

**Option 3: Upstash (Cloud)**
- Free tier available
- Visit [upstash.com](https://upstash.com)
- Copy connection string to `REDIS_URL`

## Current Implementation

### Cache Architecture

```
lib/cache/
├── index.ts          # Unified cache interface (exports `cache`)
├── redis.ts          # Redis client wrapper (exports `redisCache`)
└── redis-cache.ts    # Alternative implementation
```

**Usage Pattern**:
```typescript
import { cache } from '@/lib/cache';

// Get cached data
const orders = await cache.get<Order[]>(`orders:${venueId}`);

// Set cache with TTL
await cache.set(`orders:${venueId}`, orders, { ttl: 60 });
```

### Automatic Fallback

If `REDIS_URL` is not set:
- ✅ Cache falls back to in-memory Map
- ✅ Rate limiting disabled (allows all requests)
- ✅ Queue will still work (in-memory)

**Note**: In-memory cache is per-instance, not shared across servers.

## Best Practices

### Cache Keys

Use consistent naming:
```typescript
import { cacheKeys } from '@/lib/cache';

const key = cacheKeys.orders(venueId);
// Returns: "orders:abc123"
```

### TTL Recommendations

```typescript
import { cacheTTL } from '@/lib/cache';

// Short-lived (1 min) - live data
cache.set(key, data, { ttl: cacheTTL.short });

// Medium (5 min) - frequently accessed
cache.set(key, data, { ttl: cacheTTL.medium });

// Long (30 min) - static data
cache.set(key, data, { ttl: cacheTTL.long });
```

### Cache Invalidation

```typescript
// Invalidate single key
await cache.delete(`orders:${venueId}`);

// Invalidate pattern
await cache.invalidate(`orders:${venueId}:*`);
```

## Production Setup

### Railway

1. Add Redis service in Railway dashboard
2. Copy connection string
3. Add to Railway environment variables:
   ```
   REDIS_URL=<connection-string>
   ```

### Vercel (Optional)

Use Upstash Redis (Vercel integration):
1. Add Upstash Redis in Vercel dashboard
2. Auto-configured via environment variables

## Monitoring

Check Redis connection:
```typescript
import { redisCache } from '@/lib/cache/redis';

// Test connection
const test = await redisCache.get('test');
```

Logs show Redis status:
- `[REDIS] Connected to Redis cache` - ✅ Connected
- `[REDIS] Redis URL not provided` - ⚠️ Using fallback
- `[REDIS] Connection error` - ❌ Connection failed

## Troubleshooting

### Cache Not Working

1. Check `REDIS_URL` is set
2. Verify Redis is running: `redis-cli ping` (should return `PONG`)
3. Check logs for connection errors

### Rate Limiting Not Working

- Without Redis, rate limiting is disabled
- Add `REDIS_URL` to enable

### Memory Issues

If using in-memory fallback:
- Cache grows unbounded
- Restart server periodically
- Better: Use Redis in production

## Performance

**With Redis**:
- ✅ Shared cache across instances
- ✅ Persistent across restarts
- ✅ ~1ms response time
- ✅ Supports millions of keys

**Without Redis** (fallback):
- ⚠️ Per-instance cache
- ⚠️ Lost on restart
- ✅ ~0.1ms response time
- ⚠️ Limited by server memory

## Security

For production:
- Use `rediss://` (SSL) instead of `redis://`
- Set Redis password in connection string
- Restrict Redis access to internal network
- Use Redis ACLs if available

