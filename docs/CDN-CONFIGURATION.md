# CDN Configuration

This document describes how to configure Content Delivery Network (CDN) for Servio to improve performance, reduce latency, and enhance security.

## Overview

A CDN caches static assets at edge locations worldwide, serving content from the location closest to your users. This reduces latency, improves page load times, and reduces load on your origin server.

## Recommended CDN Providers

### 1. Vercel (Recommended for Next.js)

If deploying on Vercel, CDN is automatically configured for static assets.

```bash
# No additional configuration needed
# Vercel automatically:
# - Caches static assets at edge locations
# - Provides Gzip/Brotli compression
# - Sets appropriate cache headers
```

### 2. Cloudflare

Cloudflare provides free tier with excellent performance.

```bash
# Environment Variables
NEXT_PUBLIC_CLOUDFLARE_CDN_URL=https://cdn.yourdomain.com
CLOUDFLARE_ZONE_ID=your-zone-id
CLOUDFLARE_API_TOKEN=your-api-token
```

#### Setup Steps:

1. **Create Cloudflare account and add your domain**

2. **Update DNS settings**
   ```
   Type: CNAME
   Name: cdn
   Value: yourdomain.com
   Proxied: true (orange cloud)
   ```

3. **Configure caching rules** (Cloudflare Dashboard)
   ```
   Cache Level: Cache Everything
   Browser Cache TTL: 7 days
   Edge Cache TTL: 1 month
   ```

4. **Add page rules for static assets**
   ```
   URL: *.yourdomain.com/_next/static/*
   Cache Level: Cache Everything
   Edge Cache TTL: 1 month
   ```

### 3. AWS CloudFront

```bash
# Environment Variables
NEXT_PUBLIC_CLOUDFRONT_URL=https://cdn.yourdomain.com
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_REGION=us-east-1
```

#### Setup Steps:

1. **Create CloudFront distribution**
   ```bash
   # Using AWS CLI
   aws cloudfront create-distribution \
     --origin-domain-name your-app.vercel.app \
     --default-root-object index.html \
     --comment "Servio CDN"
   ```

2. **Configure origin settings**
   ```
   Origin Protocol Policy: HTTPS Only
   Viewer Protocol Policy: Redirect HTTP to HTTPS
   Allowed HTTP Methods: GET, HEAD, OPTIONS, PUT, POST, PATCH, DELETE
   ```

3. **Configure caching**
   ```
   Default TTL: 86400 (1 day)
   Max TTL: 31536000 (1 year)
   Min TTL: 0
   ```

### 4. Fastly

```bash
# Environment Variables
NEXT_PUBLIC_FASTLY_URL=https://cdn.yourdomain.com
FASTLY_SERVICE_ID=your-service-id
FASTLY_API_TOKEN=your-api-token
```

## Static Asset Optimization

### Next.js Image Optimization

```typescript
// next.config.js
module.exports = {
  images: {
    loader: "cloudinary",
    path: "https://cdn.yourdomain.com/",
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },
};
```

### Font Optimization

```typescript
// next.config.js
module.exports = {
  optimizeFonts: true,
  compiler: {
    removeConsole: process.env.NODE_ENV === "production",
  },
};
```

## Cache Headers Configuration

### Static Assets (JavaScript, CSS, Images)

```typescript
// lib/middleware/static-headers.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const staticExtensions = [".js", ".css", ".png", ".jpg", ".jpeg", ".gif", ".svg", ".ico", ".woff", ".woff2"];

export function addCacheHeaders(request: NextRequest): NextResponse {
  const response = NextResponse.next();
  const url = request.nextUrl.pathname;

  // Static assets - 1 year cache
  if (staticExtensions.some((ext) => url.endsWith(ext))) {
    response.headers.set("Cache-Control", "public, max-age=31536000, immutable");
  }

  // API routes - no cache
  if (url.startsWith("/api/")) {
    response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
  }

  return response;
}
```

### Dynamic Content

```typescript
// pages/api/orders.ts
export default function handler(req, res) {
  // Dynamic content - short cache
  res.setHeader(
    "Cache-Control",
    "private, max-age=60, s-maxage=60, stale-while-revalidate=30"
  );

  // ... your code
}
```

## Environment Variables

```bash
# .env.production

# CDN Configuration
NEXT_PUBLIC_CDN_URL=https://cdn.yourdomain.com
NEXT_PUBLIC_STATIC_URL=https://static.yourdomain.com
NEXT_PUBLIC_MEDIA_URL=https://media.yourdomain.com

# Cache Configuration
CACHE_CONTROL_MAX_AGE_STATIC=31536000
CACHE_CONTROL_MAX_AGE_DYNAMIC=60
CACHE_CONTROL_STALE_WHILE_REVALIDATE=30
```

## Image CDN (Cloudinary Example)

```bash
# Environment Variables
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=your-cloud-name
NEXT_PUBLIC_CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
```

```typescript
// lib/cloudinary.ts
export function getOptimizedImageUrl(
  url: string,
  options: {
    width?: number;
    height?: number;
    quality?: number;
    format?: "auto" | "webp" | "avif" | "jpg" | "png";
  } = {}
): string {
  const { width, height, quality = 80, format = "auto" } = options;

  // Example using Cloudinary URL transformation
  return `https://res.cloudinary.com/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/image/upload/w_${width},h_${height},q_${quality},f_${format}/${url}`;
}
```

## Performance Monitoring

### CDN Analytics

```typescript
// lib/monitoring/cdn-analytics.ts
export interface CDNMetrics {
  cacheHitRate: number;
  totalRequests: number;
  bandwidthSaved: number;
  latencyP50: number;
  latencyP95: number;
}

export async function getCDNMetrics(): Promise<CDNMetrics> {
  // Example: Fetch from Cloudflare Analytics API
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/zones/${process.env.CLOUDFLARE_ZONE_ID}/analytics/dashboard`,
    {
      headers: {
        Authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`,
      },
    }
  );

  const data = await response.json();
  return {
    cacheHitRate: data.result.totals.requests.cached / data.result.totals.requests.all,
    totalRequests: data.result.totals.requests.all,
    bandwidthSaved: data.result.totals.bandwidth.cached,
    latencyP50: data.result.totals.latency.p50,
    latencyP95: data.result.totals.latency.p95,
  };
}
```

## Best Practices

### 1. Cache Invalidation

```typescript
// lib/cache/invalidation.ts
export async function invalidateCDNCache(
  paths: string[]
): Promise<void> {
  // Cloudflare
  if (process.env.CLOUDFLARE_API_TOKEN) {
    await fetch(
      `https://api.cloudflare.com/client/v4/zones/${process.env.CLOUDFLARE_ZONE_ID}/purge_cache`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          files: paths.map((p) => `${process.env.NEXT_PUBLIC_APP_URL}${p}`),
        }),
      }
    );
  }

  // AWS CloudFront
  if (process.env.AWS_ACCESS_KEY_ID) {
    // Use AWS SDK to create invalidation
  }
}
```

### 2. Brotli/Gzip Compression

```bash
# next.config.js
module.exports = {
  compress: true,
  poweredByHeader: false,
};
```

### 3. HTTP/2 and HTTP/3

All major CDNs support HTTP/2 and HTTP/3 automatically. Ensure your origin server also supports these protocols.

### 4. Security Headers

```typescript
// lib/middleware/security-headers.ts
export const securityHeaders = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-XSS-Protection": "1; mode=block",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
};
```

## Deployment Checklist

- [ ] CDN URL configured in environment variables
- [ ] Cache headers properly set for static/dynamic content
- [ ] Image CDN configured for automatic optimization
- [ ] SSL/TLS configured (preferably automatic via CDN)
- [ ] Cache invalidation webhooks set up
- [ ] CDN analytics monitoring enabled
- [ ] Performance benchmarks recorded before/after
- [ ] CDN security settings reviewed
- [ ] Cache purge testing completed

## Performance Targets

| Metric | Target | Current Benchmark |
|--------|--------|-------------------|
| Time to First Byte (TTFB) | < 100ms | - |
| Cache Hit Rate | > 90% | - |
| Time to Interactive (TTI) | < 3s | - |
| Largest Contentful Paint (LCP) | < 2.5s | - |
| Cumulative Layout Shift (CLS) | < 0.1 | - |

## Related Documentation

- [Performance Optimization](../PERFORMANCE.md)
- [Monitoring & Observability](MONITORING.md)
- [Security Best Practices](SECURITY.md)
