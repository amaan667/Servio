# API Rate Limiting Per Tenant

This document describes the implementation of API rate limiting per tenant for Servio platform.

## Table of Contents

1. [Overview](#overview)
2. [Features](#features)
3. [Configuration](#configuration)
4. [Implementation](#implementation)
5. [Monitoring](#monitoring)
6. [Best Practices](#best-practices)

## Overview

API rate limiting per tenant ensures fair usage of API resources across all tenants:

- **Fair Usage:** Ensure fair usage across all tenants
- **Prevent Abuse:** Prevent abuse by individual tenants
- **Configurable:** Configure rate limits per tenant
- **Monitoring:** Monitor rate limit usage

## Features

### Configuration

```typescript
// lib/rate-limiting/tenant-config.ts
export interface TenantRateLimitConfig {
  tenantId: string;
  requestsPerMinute: number;
  requestsPerHour: number;
  requestsPerDay: number;
  burstLimit: number;
}

export interface RateLimitConfig {
  default: TenantRateLimitConfig;
  overrides: Map<string, TenantRateLimitConfig>;
}

export const DEFAULT_RATE_LIMIT_CONFIG: RateLimitConfig = {
  default: {
    tenantId: 'default',
    requestsPerMinute: 100,
    requestsPerHour: 1000,
    requestsPerDay: 10000,
    burstLimit: 200,
  },
  overrides: new Map(),
};

export function getTenantRateLimitConfig(tenantId: string): TenantRateLimitConfig {
  const config = DEFAULT_RATE_LIMIT_CONFIG;

  return config.overrides.get(tenantId) || config.default;
}

export function setTenantRateLimitConfig(tenantId: string, config: Partial<TenantRateLimitConfig>): void {
  const currentConfig = getTenantRateLimitConfig(tenantId);
  const newConfig = { ...currentConfig, ...config, tenantId };

  DEFAULT_RATE_LIMIT_CONFIG.overrides.set(tenantId, newConfig);
}
```

### Rate Limiter

```typescript
// lib/rate-limiting/tenant-rate-limiter.ts
import { Redis } from 'ioredis';
import { getTenantRateLimitConfig } from './tenant-config';

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  reset: number;
  limit: number;
  retryAfter?: number;
}

export class TenantRateLimiter {
  private redis: Redis;
  private keyPrefix: string;

  constructor(redis: Redis, keyPrefix: string = 'rate_limit:') {
    this.redis = redis;
    this.keyPrefix = keyPrefix;
  }

  async checkRateLimit(
    tenantId: string,
    endpoint: string,
    method: string
  ): Promise<RateLimitResult> {
    const config = getTenantRateLimitConfig(tenantId);

    // Check minute limit
    const minuteResult = await this.checkWindow(
      tenantId,
      endpoint,
      method,
      'minute',
      config.requestsPerMinute,
      60
    );

    if (!minuteResult.allowed) {
      return minuteResult;
    }

    // Check hour limit
    const hourResult = await this.checkWindow(
      tenantId,
      endpoint,
      method,
      'hour',
      config.requestsPerHour,
      3600
    );

    if (!hourResult.allowed) {
      return hourResult;
    }

    // Check day limit
    const dayResult = await this.checkWindow(
      tenantId,
      endpoint,
      method,
      'day',
      config.requestsPerDay,
      86400
    );

    return dayResult;
  }

  private async checkWindow(
    tenantId: string,
    endpoint: string,
    method: string,
    window: string,
    limit: number,
    windowSeconds: number
  ): Promise<RateLimitResult> {
    const key = `${this.keyPrefix}${tenantId}:${endpoint}:${method}:${window}`;
    const now = Math.floor(Date.now() / 1000);
    const windowStart = now - windowSeconds;

    // Remove old entries
    await this.redis.zremrangebyscore(key, 0, windowStart);

    // Count current requests
    const count = await this.redis.zcard(key);

    // Check if limit exceeded
    if (count >= limit) {
      // Get oldest request to calculate retry after
      const oldest = await this.redis.zrange(key, 0, 0, 'WITHSCORES');
      const retryAfter = oldest[1] ? parseInt(oldest[1]) + windowSeconds - now : windowSeconds;

      return {
        allowed: false,
        remaining: 0,
        reset: oldest[1] ? parseInt(oldest[1]) + windowSeconds : now + windowSeconds,
        limit,
        retryAfter,
      };
    }

    // Add current request
    await this.redis.zadd(key, now, `${now}-${Math.random()}`);

    // Set expiration
    await this.redis.expire(key, windowSeconds);

    return {
      allowed: true,
      remaining: limit - count - 1,
      reset: now + windowSeconds,
      limit,
    };
  }

  async resetRateLimit(tenantId: string, endpoint: string, method: string): Promise<void> {
    const keys = [
      `${this.keyPrefix}${tenantId}:${endpoint}:${method}:minute`,
      `${this.keyPrefix}${tenantId}:${endpoint}:${method}:hour`,
      `${this.keyPrefix}${tenantId}:${endpoint}:${method}:day`,
    ];

    await this.redis.del(...keys);
  }

  async getRateLimitStats(tenantId: string): Promise<RateLimitStats> {
    const keys = [
      `${this.keyPrefix}${tenantId}:*:minute`,
      `${this.keyPrefix}${tenantId}:*:hour`,
      `${this.keyPrefix}${tenantId}:*:day`,
    ];

    const stats: RateLimitStats = {
      minute: 0,
      hour: 0,
      day: 0,
    };

    for (const key of keys) {
      const count = await this.redis.zcard(key);

      if (key.endsWith(':minute')) {
        stats.minute += count;
      } else if (key.endsWith(':hour')) {
        stats.hour += count;
      } else if (key.endsWith(':day')) {
        stats.day += count;
      }
    }

    return stats;
  }
}

interface RateLimitStats {
  minute: number;
  hour: number;
  day: number;
}

// Singleton instance
let tenantRateLimiter: TenantRateLimiter | null = null;

export function getTenantRateLimiter(): TenantRateLimiter {
  if (!tenantRateLimiter) {
    const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
    tenantRateLimiter = new TenantRateLimiter(redis);
  }

  return tenantRateLimiter;
}
```

## Implementation

### Middleware

```typescript
// lib/middleware/tenant-rate-limit.ts
import { NextRequest, NextResponse } from 'next/server';
import { getTenantRateLimiter } from '../rate-limiting/tenant-rate-limiter';

export async function withTenantRateLimit(
  handler: (request: NextRequest) => Promise<NextResponse>
): Promise<NextResponse> {
  const request = handler.request;

  // Get tenant ID from request
  const tenantId = await getTenantId(request);

  if (!tenantId) {
    return handler(request);
  }

  // Get endpoint and method
  const url = new URL(request.url);
  const endpoint = url.pathname;
  const method = request.method;

  // Check rate limit
  const rateLimiter = getTenantRateLimiter();
  const result = await rateLimiter.checkRateLimit(tenantId, endpoint, method);

  // Add rate limit headers
  const response = await handler(request);

  response.headers.set('X-RateLimit-Limit', result.limit.toString());
  response.headers.set('X-RateLimit-Remaining', result.remaining.toString());
  response.headers.set('X-RateLimit-Reset', result.reset.toString());

  if (!result.allowed) {
    response.headers.set('Retry-After', result.retryAfter?.toString() || '60');

    return new NextResponse(
      JSON.stringify({
        error: 'Rate limit exceeded',
        message: 'Too many requests. Please try again later.',
        retryAfter: result.retryAfter,
      }),
      {
        status: 429,
        headers: response.headers,
      }
    );
  }

  return response;
}

async function getTenantId(request: NextRequest): Promise<string | null> {
  // Get tenant ID from header
  const tenantId = request.headers.get('X-Tenant-ID');

  if (tenantId) {
    return tenantId;
  }

  // Get tenant ID from JWT token
  const token = request.headers.get('Authorization')?.replace('Bearer ', '');

  if (token) {
    const decoded = await decodeJWT(token);
    return decoded.tenantId;
  }

  return null;
}

async function decodeJWT(token: string): Promise<any> {
  // Decode JWT token
  const jwt = require('jsonwebtoken');
  return jwt.verify(token, process.env.JWT_SECRET!);
}
```

### API Route Example

```typescript
// app/api/v1/venues/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { withTenantRateLimit } from '@/lib/middleware/tenant-rate-limit';
import { VenueService } from '@/services/VenueService';

const venueService = new VenueService();

export async function GET(request: NextRequest) {
  const venues = await venueService.findAll();
  return NextResponse.json(venues);
}

export async function POST(request: NextRequest) {
  const data = await request.json();
  const venue = await venueService.create(data);
  return NextResponse.json(venue);
}

// Wrap handlers with rate limiting
export const GET = withTenantRateLimit(GET);
export const POST = withTenantRateLimit(POST);
```

## Monitoring

### Rate Limit Metrics

```typescript
// lib/rate-limiting/metrics.ts
import { CloudWatchClient, PutMetricDataCommand } from '@aws-sdk/client-cloudwatch';

const cloudwatch = new CloudWatchClient({ region: 'us-east-1' });

export class RateLimitMetrics {
  async recordRateLimitHit(tenantId: string, endpoint: string): Promise<void> {
    const command = new PutMetricDataCommand({
      Namespace: 'Servio/RateLimit',
      MetricData: [
        {
          MetricName: 'RateLimitHit',
          Dimensions: [
            {
              Name: 'TenantId',
              Value: tenantId,
            },
            {
              Name: 'Endpoint',
              Value: endpoint,
            },
          ],
          Value: 1,
          Unit: 'Count',
        },
      ],
    });

    await cloudwatch.send(command);
  }

  async recordRateLimitUsage(tenantId: string, endpoint: string, usage: number, limit: number): Promise<void> {
    const command = new PutMetricDataCommand({
      Namespace: 'Servio/RateLimit',
      MetricData: [
        {
          MetricName: 'RateLimitUsage',
          Dimensions: [
            {
              Name: 'TenantId',
              Value: tenantId,
            },
            {
              Name: 'Endpoint',
              Value: endpoint,
            },
          ],
          Value: usage,
          Unit: 'Count',
        },
        {
          MetricName: 'RateLimitUtilization',
          Dimensions: [
            {
              Name: 'TenantId',
              Value: tenantId,
            },
            {
              Name: 'Endpoint',
              Value: endpoint,
            },
          ],
          Value: (usage / limit) * 100,
          Unit: 'Percent',
        },
      ],
    });

    await cloudwatch.send(command);
  }
}

// Singleton instance
let rateLimitMetrics: RateLimitMetrics | null = null;

export function getRateLimitMetrics(): RateLimitMetrics {
  if (!rateLimitMetrics) {
    rateLimitMetrics = new RateLimitMetrics();
  }

  return rateLimitMetrics;
}
```

## Best Practices

### 1. Set Appropriate Limits

Set appropriate limits:

```typescript
// Good: Appropriate limits
const config = {
  requestsPerMinute: 100,
  requestsPerHour: 1000,
  requestsPerDay: 10000,
};

// Bad: Too low limits
const config = {
  requestsPerMinute: 10,
  requestsPerHour: 100,
  requestsPerDay: 1000,
};

// Bad: Too high limits
const config = {
  requestsPerMinute: 10000,
  requestsPerHour: 100000,
  requestsPerDay: 1000000,
};
```

### 2. Use Multiple Windows

Use multiple time windows:

```typescript
// Good: Use multiple windows
const minuteResult = await this.checkWindow(tenantId, endpoint, method, 'minute', 100, 60);
const hourResult = await this.checkWindow(tenantId, endpoint, method, 'hour', 1000, 3600);
const dayResult = await this.checkWindow(tenantId, endpoint, method, 'day', 10000, 86400);

// Bad: Use only one window
const result = await this.checkWindow(tenantId, endpoint, method, 'minute', 100, 60);
```

### 3. Add Rate Limit Headers

Add rate limit headers:

```typescript
// Good: Add rate limit headers
response.headers.set('X-RateLimit-Limit', result.limit.toString());
response.headers.set('X-RateLimit-Remaining', result.remaining.toString());
response.headers.set('X-RateLimit-Reset', result.reset.toString());

// Bad: No rate limit headers
// No rate limit headers
```

### 4. Return 429 Status

Return 429 status when limit exceeded:

```typescript
// Good: Return 429 status
if (!result.allowed) {
  return new NextResponse(
    JSON.stringify({ error: 'Rate limit exceeded' }),
    { status: 429 }
  );
}

// Bad: Return 200 status
if (!result.allowed) {
  return new NextResponse(
    JSON.stringify({ error: 'Rate limit exceeded' }),
    { status: 200 }
  );
}
```

### 5. Provide Retry-After Header

Provide retry-after header:

```typescript
// Good: Provide retry-after header
if (!result.allowed) {
  response.headers.set('Retry-After', result.retryAfter?.toString() || '60');
}

// Bad: No retry-after header
if (!result.allowed) {
  // No retry-after header
}
```

### 6. Monitor Rate Limit Usage

Monitor rate limit usage:

```typescript
// Good: Monitor rate limit usage
await metrics.recordRateLimitUsage(tenantId, endpoint, usage, limit);

// Bad: No monitoring
// No monitoring
```

### 7. Document Rate Limits

Document rate limits:

```markdown
# Good: Document rate limits
## Rate Limits

- Default: 100 requests/minute, 1000 requests/hour, 10000 requests/day
- Custom limits available for enterprise plans
- Rate limit headers: X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset

# Bad: No documentation
# No documentation
```

## References

- [Rate Limiting](https://cloud.google.com/architecture/rate-limiting-strategies-techniques)
- [Redis Rate Limiting](https://redis.com/redis-best-practices/basic-rate-limiting/)
- [API Rate Limiting](https://restfulapi.net/rate-limiting/)
- [HTTP 429](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/429)
