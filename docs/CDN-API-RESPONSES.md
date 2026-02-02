# CDN for API Responses

This document describes the implementation of CDN for API responses for the Servio platform.

## Table of Contents

1. [Overview](#overview)
2. [Features](#features)
3. [Infrastructure](#infrastructure)
4. [Configuration](#configuration)
5. [Cache Headers](#cache-headers)
6. [Best Practices](#best-practices)

## Overview

CDN (Content Delivery Network) for API responses allows you to cache API responses at edge locations, reducing latency and improving performance:

- **Reduced Latency:** Reduce latency by serving responses from edge locations
- **Reduced Load:** Reduce load on origin servers
- **Improved Performance:** Improve performance for global users
- **Cost Effective:** Reduce bandwidth costs

## Features

### Infrastructure Setup

```yaml
# terraform/cdn/main.tf
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 4.0"
    }
  }
}

provider "aws" {
  region = "us-east-1"
}

provider "cloudflare" {
  api_token = var.cloudflare_api_token
}

# CloudFront Distribution
resource "aws_cloudfront_distribution" "api" {
  enabled             = true
  is_ipv6_enabled     = true
  price_class         = "PriceClass_All"

  origin {
    domain_name = var.api_domain
    origin_id   = "api"

    custom_origin_config {
      http_port              = 443
      https_port             = 443
      origin_protocol_policy = "https-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  default_cache_behavior {
    target_origin_id       = "api"
    viewer_protocol_policy = "redirect-to-https"
    compress               = true
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods        = ["GET", "HEAD"]
    min_ttl               = 0
    default_ttl           = 86400  # 1 day
    max_ttl               = 31536000  # 1 year

    forwarded_values {
      query_string = true
      cookies {
        forward = "none"
      }
    }
  }

  # Cache behavior for API endpoints
  ordered_cache_behavior {
    path_pattern           = "/api/v1/venues/*"
    target_origin_id       = "api"
    viewer_protocol_policy = "redirect-to-https"
    compress               = true
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods        = ["GET", "HEAD"]
    min_ttl               = 300  # 5 minutes
    default_ttl           = 3600  # 1 hour
    max_ttl               = 86400  # 1 day

    forwarded_values {
      query_string = true
      cookies {
        forward = "none"
      }
    }
  }

  # Cache behavior for static assets
  ordered_cache_behavior {
    path_pattern           = "/static/*"
    target_origin_id       = "api"
    viewer_protocol_policy = "redirect-to-https"
    compress               = true
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods        = ["GET", "HEAD"]
    min_ttl               = 86400  # 1 day
    default_ttl           = 604800  # 1 week
    max_ttl               = 31536000  # 1 year

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }
  }

  viewer_certificate {
    acm_certificate_arn      = var.acm_certificate_arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  tags = {
    Name        = "servio-api-cdn"
    Environment = "production"
  }
}

# Cloudflare CDN
resource "cloudflare_zone" "servio" {
  name = var.domain
}

resource "cloudflare_record" "api" {
  zone_id = cloudflare_zone.servio.id
  name    = "api"
  value   = aws_cloudfront_distribution.api.domain_name
  type    = "CNAME"
  proxied = true
}

resource "cloudflare_page_rule" "api_cache" {
  zone_id = cloudflare_zone.servio.id
  target  = "api.servio.com/*"

  actions {
    cache_level = "cache_everything"
    edge_cache_ttl = 3600  # 1 hour
  }
}

resource "cloudflare_page_rule" "static_cache" {
  zone_id = cloudflare_zone.servio.id
  target  = "api.servio.com/static/*"

  actions {
    cache_level = "cache_everything"
    edge_cache_ttl = 604800  # 1 week
  }
}
```

## Configuration

### Cache Headers Middleware

```typescript
// lib/middleware/cache-headers.ts
import { NextResponse } from 'next/server';

export interface CacheConfig {
  enabled: boolean;
  maxAge: number;
  sMaxAge: number;
  staleWhileRevalidate: number;
  staleIfError: number;
  public: boolean;
  mustRevalidate: boolean;
  noCache: boolean;
  noStore: boolean;
}

export const DEFAULT_CACHE_CONFIG: CacheConfig = {
  enabled: true,
  maxAge: 3600, // 1 hour
  sMaxAge: 86400, // 1 day
  staleWhileRevalidate: 300, // 5 minutes
  staleIfError: 600, // 10 minutes
  public: true,
  mustRevalidate: false,
  noCache: false,
  noStore: false,
};

export function addCacheHeaders(
  response: NextResponse,
  config: Partial<CacheConfig> = {}
): NextResponse {
  const cacheConfig = { ...DEFAULT_CACHE_CONFIG, ...config };

  if (!cacheConfig.enabled) {
    return response;
  }

  const headers = new Headers(response.headers);

  // Add Cache-Control header
  const cacheControlParts: string[] = [];

  if (cacheConfig.public) {
    cacheControlParts.push('public');
  } else {
    cacheControlParts.push('private');
  }

  if (cacheConfig.maxAge > 0) {
    cacheControlParts.push(`max-age=${cacheConfig.maxAge}`);
  }

  if (cacheConfig.sMaxAge > 0) {
    cacheControlParts.push(`s-maxage=${cacheConfig.sMaxAge}`);
  }

  if (cacheConfig.staleWhileRevalidate > 0) {
    cacheControlParts.push(`stale-while-revalidate=${cacheConfig.staleWhileRevalidate}`);
  }

  if (cacheConfig.staleIfError > 0) {
    cacheControlParts.push(`stale-if-error=${cacheConfig.staleIfError}`);
  }

  if (cacheConfig.mustRevalidate) {
    cacheControlParts.push('must-revalidate');
  }

  if (cacheConfig.noCache) {
    cacheControlParts.push('no-cache');
  }

  if (cacheConfig.noStore) {
    cacheControlParts.push('no-store');
  }

  headers.set('Cache-Control', cacheControlParts.join(', '));

  // Add ETag header
  const etag = generateETag(response.body);
  headers.set('ETag', etag);

  // Add Last-Modified header
  headers.set('Last-Modified', new Date().toUTCString());

  // Add Vary header
  headers.set('Vary', 'Accept, Accept-Encoding, Authorization');

  return new NextResponse(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export function addNoCacheHeaders(response: NextResponse): NextResponse {
  const headers = new Headers(response.headers);

  headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  headers.set('Pragma', 'no-cache');
  headers.set('Expires', '0');

  return new NextResponse(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export function addShortCacheHeaders(response: NextResponse): NextResponse {
  return addCacheHeaders(response, {
    maxAge: 60, // 1 minute
    sMaxAge: 300, // 5 minutes
  });
}

export function addLongCacheHeaders(response: NextResponse): NextResponse {
  return addCacheHeaders(response, {
    maxAge: 86400, // 1 day
    sMaxAge: 604800, // 1 week
  });
}

function generateETag(body: any): string {
  const crypto = require('crypto');
  const hash = crypto.createHash('md5').update(JSON.stringify(body)).digest('hex');
  return `"${hash}"`;
}
```

### API Route with Caching

```typescript
// app/api/v1/venues/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { addCacheHeaders, addNoCacheHeaders } from '@/lib/middleware/cache-headers';

export async function GET(request: NextRequest) {
  const venues = await getVenues();

  const response = NextResponse.json(venues);

  // Add cache headers for GET requests
  return addCacheHeaders(response, {
    maxAge: 300, // 5 minutes
    sMaxAge: 3600, // 1 hour
  });
}

export async function POST(request: NextRequest) {
  const data = await request.json();
  const venue = await createVenue(data);

  const response = NextResponse.json(venue);

  // Add no-cache headers for POST requests
  return addNoCacheHeaders(response);
}
```

## Cache Headers

### Cache-Control Header

```typescript
// lib/middleware/cache-headers.ts
export interface CacheControlOptions {
  maxAge?: number;
  sMaxAge?: number;
  staleWhileRevalidate?: number;
  staleIfError?: number;
  public?: boolean;
  private?: boolean;
  mustRevalidate?: boolean;
  noCache?: boolean;
  noStore?: boolean;
  noTransform?: boolean;
  proxyRevalidate?: boolean;
  immutable?: boolean;
}

export function buildCacheControl(options: CacheControlOptions): string {
  const parts: string[] = [];

  if (options.public) {
    parts.push('public');
  } else if (options.private) {
    parts.push('private');
  }

  if (options.maxAge !== undefined) {
    parts.push(`max-age=${options.maxAge}`);
  }

  if (options.sMaxAge !== undefined) {
    parts.push(`s-maxage=${options.sMaxAge}`);
  }

  if (options.staleWhileRevalidate !== undefined) {
    parts.push(`stale-while-revalidate=${options.staleWhileRevalidate}`);
  }

  if (options.staleIfError !== undefined) {
    parts.push(`stale-if-error=${options.staleIfError}`);
  }

  if (options.mustRevalidate) {
    parts.push('must-revalidate');
  }

  if (options.noCache) {
    parts.push('no-cache');
  }

  if (options.noStore) {
    parts.push('no-store');
  }

  if (options.noTransform) {
    parts.push('no-transform');
  }

  if (options.proxyRevalidate) {
    parts.push('proxy-revalidate');
  }

  if (options.immutable) {
    parts.push('immutable');
  }

  return parts.join(', ');
}
```

### Cache Strategies

```typescript
// lib/cache/strategies.ts
import { CacheControlOptions } from '../middleware/cache-headers';

export const CACHE_STRATEGIES: Record<string, CacheControlOptions> = {
  // No caching
  noCache: {
    noStore: true,
    noCache: true,
  },

  // Short cache (1 minute)
  short: {
    maxAge: 60,
    sMaxAge: 300,
  },

  // Medium cache (1 hour)
  medium: {
    maxAge: 3600,
    sMaxAge: 86400,
  },

  // Long cache (1 day)
  long: {
    maxAge: 86400,
    sMaxAge: 604800,
  },

  // Very long cache (1 week)
  veryLong: {
    maxAge: 604800,
    sMaxAge: 2592000,
    immutable: true,
  },

  // Static assets (1 year)
  static: {
    maxAge: 31536000,
    sMaxAge: 31536000,
    immutable: true,
  },

  // API responses (5 minutes)
  api: {
    maxAge: 300,
    sMaxAge: 3600,
    staleWhileRevalidate: 300,
    staleIfError: 600,
  },

  // Public data (1 hour)
  public: {
    maxAge: 3600,
    sMaxAge: 86400,
    public: true,
  },

  // Private data (no caching)
  private: {
    maxAge: 0,
    private: true,
    noCache: true,
  },
};

export function getCacheStrategy(name: string): CacheControlOptions {
  return CACHE_STRATEGIES[name] || CACHE_STRATEGIES.noCache;
}
```

## Best Practices

### 1. Cache GET Requests

Cache GET requests:

```typescript
// Good: Cache GET requests
export async function GET(request: NextRequest) {
  const venues = await getVenues();
  const response = NextResponse.json(venues);
  return addCacheHeaders(response, { maxAge: 300 });
}

// Bad: Don't cache GET requests
export async function GET(request: NextRequest) {
  const venues = await getVenues();
  return NextResponse.json(venues);
}
```

### 2. Don't Cache POST/PUT/DELETE Requests

Don't cache POST/PUT/DELETE requests:

```typescript
// Good: Don't cache POST requests
export async function POST(request: NextRequest) {
  const data = await request.json();
  const venue = await createVenue(data);
  const response = NextResponse.json(venue);
  return addNoCacheHeaders(response);
}

// Bad: Cache POST requests
export async function POST(request: NextRequest) {
  const data = await request.json();
  const venue = await createVenue(data);
  const response = NextResponse.json(venue);
  return addCacheHeaders(response, { maxAge: 300 });
}
```

### 3. Use Appropriate TTL

Use appropriate TTL:

```typescript
// Good: Appropriate TTL
const response = NextResponse.json(venues);
return addCacheHeaders(response, { maxAge: 300 }); // 5 minutes

// Bad: Too short TTL
const response = NextResponse.json(venues);
return addCacheHeaders(response, { maxAge: 10 }); // 10 seconds

// Bad: Too long TTL
const response = NextResponse.json(venues);
return addCacheHeaders(response, { maxAge: 86400 }); // 1 day
```

### 4. Use Stale-While-Revalidate

Use stale-while-revalidate:

```typescript
// Good: Use stale-while-revalidate
const response = NextResponse.json(venues);
return addCacheHeaders(response, {
  maxAge: 300,
  staleWhileRevalidate: 300,
});

// Bad: No stale-while-revalidate
const response = NextResponse.json(venues);
return addCacheHeaders(response, { maxAge: 300 });
```

### 5. Add ETag Headers

Add ETag headers:

```typescript
// Good: Add ETag headers
const response = NextResponse.json(venues);
const etag = generateETag(venues);
response.headers.set('ETag', etag);
return response;

// Bad: No ETag headers
const response = NextResponse.json(venues);
return response;
```

### 6. Use Vary Headers

Use Vary headers:

```typescript
// Good: Use Vary headers
const response = NextResponse.json(venues);
response.headers.set('Vary', 'Accept, Accept-Encoding, Authorization');
return response;

// Bad: No Vary headers
const response = NextResponse.json(venues);
return response;
```

### 7. Document Cache Strategy

Document cache strategy:

```markdown
# Good: Document cache strategy
## Cache Strategy

- Venues: 5 minutes TTL
- Menu items: 10 minutes TTL
- Orders: No caching
- Static assets: 1 year TTL

# Bad: No documentation
# No documentation
```

## References

- [HTTP Caching](https://developer.mozilla.org/en-US/docs/Web/HTTP/Caching)
- [Cache-Control](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Cache-Control)
- [CloudFront](https://aws.amazon.com/cloudfront/)
- [Cloudflare CDN](https://www.cloudflare.com/cdn/)
