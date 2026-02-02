# Edge Functions for Global Distribution

This document describes the implementation of edge functions for global distribution of the Servio platform.

## Table of Contents

1. [Overview](#overview)
2. [Features](#features)
3. [Infrastructure](#infrastructure)
4. [Edge Functions](#edge-functions)
5. [Deployment](#deployment)
6. [Best Practices](#best-practices)

## Overview

Edge functions allow you to run code closer to users, reducing latency and improving performance:

- **Global Distribution:** Deploy functions to edge locations worldwide
- **Low Latency:** Reduce latency by running code closer to users
- **Scalability:** Scale automatically with demand
- **Cost Effective:** Pay only for what you use

## Features

### Infrastructure Setup

```yaml
# terraform/edge-functions/main.tf
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

# Cloudflare Workers
resource "cloudflare_worker_script" "servio" {
  name    = "servio-edge"
  content = file("${path.module}/worker.js")
  zone_id = var.cloudflare_zone_id
}

# Cloudflare Worker Routes
resource "cloudflare_worker_route" "api" {
  zone_id     = var.cloudflare_zone_id
  pattern     = "api.servio.com/*"
  script_name = cloudflare_worker_script.servio.name
}

resource "cloudflare_worker_route" "static" {
  zone_id     = var.cloudflare_zone_id
  pattern     = "static.servio.com/*"
  script_name = cloudflare_worker_script.servio.name
}

# AWS Lambda@Edge
resource "aws_lambda_function" "edge" {
  filename         = "${path.module}/edge.zip"
  function_name    = "servio-edge"
  role            = aws_iam_role.lambda_edge.arn
  handler         = "edge.handler"
  runtime         = "nodejs20.x"
  timeout         = 5
  memory_size     = 128

  publish = true

  source_code_hash = filebase64sha256("${path.module}/edge.zip")
}

# IAM Role for Lambda@Edge
resource "aws_iam_role" "lambda_edge" {
  name = "servio-lambda-edge"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = [
            "lambda.amazonaws.com",
            "edgelambda.amazonaws.com"
          ]
        }
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "lambda_edge" {
  role       = aws_iam_role.lambda_edge.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# CloudFront Distribution
resource "aws_cloudfront_distribution" "servio" {
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

    forwarded_values {
      query_string = true
      cookies {
        forward = "all"
      }
    }

    lambda_function_association {
      event_type   = "viewer-request"
      lambda_arn   = aws_lambda_function.edge.qualified_arn
      include_body = false
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
    Name        = "servio-cloudfront"
    Environment = "production"
  }
}
```

### Edge Functions

```typescript
// edge/worker.js
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Handle API requests
    if (url.pathname.startsWith('/api/')) {
      return handleAPIRequest(request, env, ctx);
    }

    // Handle static assets
    if (url.pathname.startsWith('/static/')) {
      return handleStaticRequest(request, env, ctx);
    }

    // Handle health checks
    if (url.pathname === '/health') {
      return new Response(JSON.stringify({ status: 'ok' }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Default response
    return new Response('Not Found', { status: 404 });
  },
};

async function handleAPIRequest(request, env, ctx) {
  const url = new URL(request.url);
  const path = url.pathname.replace('/api/', '');

  // Rate limiting
  const rateLimit = await checkRateLimit(request, env);
  if (!rateLimit.allowed) {
    return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), {
      status: 429,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Cache GET requests
  if (request.method === 'GET') {
    const cache = caches.default;
    const cacheKey = new Request(url.toString(), request);

    const cached = await cache.match(cacheKey);
    if (cached) {
      return cached;
    }

    // Forward to origin
    const response = await fetch(request);

    // Cache response
    if (response.ok) {
      ctx.waitUntil(cache.put(cacheKey, response.clone()));
    }

    return response;
  }

  // Forward non-GET requests to origin
  return fetch(request);
}

async function handleStaticRequest(request, env, ctx) {
  const url = new URL(request.url);
  const path = url.pathname.replace('/static/', '');

  // Check cache
  const cache = caches.default;
  const cacheKey = new Request(url.toString(), request);

  const cached = await cache.match(cacheKey);
  if (cached) {
    return cached;
  }

  // Fetch from R2
  const object = await env.R2.get(path);
  if (!object) {
    return new Response('Not Found', { status: 404 });
  }

  const headers = new Headers();
  headers.set('Content-Type', object.httpMetadata?.contentType || 'application/octet-stream');
  headers.set('Cache-Control', 'public, max-age=31536000, immutable');

  const response = new Response(object.body, { headers });

  // Cache response
  ctx.waitUntil(cache.put(cacheKey, response.clone()));

  return response;
}

async function checkRateLimit(request, env) {
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const key = `rate_limit:${ip}`;

  const count = await env.KV.get(key, { type: 'json' }) || { count: 0, reset: Date.now() + 60000 };

  if (Date.now() > count.reset) {
    count.count = 0;
    count.reset = Date.now() + 60000;
  }

  count.count++;

  await env.KV.put(key, JSON.stringify(count), { expirationTtl: 60 });

  return {
    allowed: count.count <= 100, // 100 requests per minute
    remaining: 100 - count.count,
    reset: count.reset,
  };
}
```

### Lambda@Edge Function

```typescript
// edge/edge.ts
import { CloudFrontRequestEvent, CloudFrontRequestResult } from 'aws-lambda';

export const handler = async (event: CloudFrontRequestEvent): Promise<CloudFrontRequestResult> => {
  const request = event.Records[0].cf.request;
  const headers = request.headers;

  // Add security headers
  headers['x-content-type-options'] = [{ key: 'X-Content-Type-Options', value: 'nosniff' }];
  headers['x-frame-options'] = [{ key: 'X-Frame-Options', value: 'DENY' }];
  headers['x-xss-protection'] = [{ key: 'X-XSS-Protection', value: '1; mode=block' }];
  headers['strict-transport-security'] = [{ key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains; preload' }];
  headers['referrer-policy'] = [{ key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' }];

  // Add CORS headers
  headers['access-control-allow-origin'] = [{ key: 'Access-Control-Allow-Origin', value: '*' }];
  headers['access-control-allow-methods'] = [{ key: 'Access-Control-Allow-Methods', value: 'GET, POST, PUT, DELETE, OPTIONS' }];
  headers['access-control-allow-headers'] = [{ key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization' }];
  headers['access-control-max-age'] = [{ key: 'Access-Control-Max-Age', value: '86400' }];

  // Handle OPTIONS requests
  if (request.method === 'OPTIONS') {
    return {
      status: '204',
      headers,
    };
  }

  // Add request ID
  const requestId = generateRequestId();
  headers['x-request-id'] = [{ key: 'X-Request-ID', value: requestId }];

  // Add timestamp
  headers['x-timestamp'] = [{ key: 'X-Timestamp', value: Date.now().toString() }];

  return request;
};

function generateRequestId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
```

## Deployment

### Wrangler Configuration

```toml
# wrangler.toml
name = "servio-edge"
main = "edge/worker.js"
compatibility_date = "2024-01-01"

[vars]
ENVIRONMENT = "production"
API_URL = "https://api.servio.com"

[[routes]]
pattern = "api.servio.com/*"
zone_id = "your-zone-id"

[[routes]]
pattern = "static.servio.com/*"
zone_id = "your-zone-id"

[env.production]
vars = { ENVIRONMENT = "production" }

[env.staging]
vars = { ENVIRONMENT = "staging" }

[[env.production.routes]]
pattern = "api-staging.servio.com/*"
zone_id = "your-zone-id"

[[env.staging.routes]]
pattern = "api-staging.servio.com/*"
zone_id = "your-zone-id"

[build]
command = "npm run build:edge"

[build.upload]
format = "modules"
main = "./dist/worker.js"
```

### Deployment Script

```typescript
// scripts/deploy-edge.ts
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function deployEdge() {
  console.log('Deploying edge functions...');

  try {
    // Build edge functions
    console.log('Building edge functions...');
    await execAsync('npm run build:edge');

    // Deploy to Cloudflare Workers
    console.log('Deploying to Cloudflare Workers...');
    await execAsync('npx wrangler deploy');

    // Deploy Lambda@Edge
    console.log('Deploying Lambda@Edge...');
    await execAsync('npm run deploy:lambda-edge');

    console.log('Edge functions deployed successfully');
  } catch (error) {
    console.error('Edge deployment failed:', error);
    process.exit(1);
  }
}

deployEdge().catch(console.error);
```

## Best Practices

### 1. Use Edge Functions for Read-Heavy Operations

Use edge functions for read-heavy operations:

```typescript
// Good: Use edge functions for read-heavy operations
if (request.method === 'GET') {
  const cached = await cache.match(cacheKey);
  if (cached) {
    return cached;
  }
}

// Bad: Use edge functions for write-heavy operations
if (request.method === 'POST') {
  // Write operations should go to origin
}
```

### 2. Cache Responses

Cache responses:

```typescript
// Good: Cache responses
const cache = caches.default;
const cacheKey = new Request(url.toString(), request);

const cached = await cache.match(cacheKey);
if (cached) {
  return cached;
}

const response = await fetch(request);
ctx.waitUntil(cache.put(cacheKey, response.clone()));

// Bad: No caching
const response = await fetch(request);
return response;
```

### 3. Use Rate Limiting

Use rate limiting:

```typescript
// Good: Use rate limiting
const rateLimit = await checkRateLimit(request, env);
if (!rateLimit.allowed) {
  return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), {
    status: 429,
  });
}

// Bad: No rate limiting
// No rate limiting
```

### 4. Add Security Headers

Add security headers:

```typescript
// Good: Add security headers
headers['x-content-type-options'] = [{ key: 'X-Content-Type-Options', value: 'nosniff' }];
headers['x-frame-options'] = [{ key: 'X-Frame-Options', value: 'DENY' }];
headers['strict-transport-security'] = [{ key: 'Strict-Transport-Security', value: 'max-age=31536000' }];

// Bad: No security headers
// No security headers
```

### 5. Use CDN for Static Assets

Use CDN for static assets:

```typescript
// Good: Use CDN for static assets
if (url.pathname.startsWith('/static/')) {
  const object = await env.R2.get(path);
  const response = new Response(object.body, { headers });
  ctx.waitUntil(cache.put(cacheKey, response.clone()));
  return response;
}

// Bad: Serve static assets from origin
if (url.pathname.startsWith('/static/')) {
  return fetch(request);
}
```

### 6. Monitor Edge Functions

Monitor edge functions:

```typescript
// Good: Monitor edge functions
await env.KV.put(`metrics:${requestId}`, JSON.stringify({
  timestamp: Date.now(),
  path: url.pathname,
  method: request.method,
  status: response.status,
}));

// Bad: No monitoring
// No monitoring
```

### 7. Test Edge Functions

Test edge functions:

```bash
# Good: Test edge functions
# Test edge functions in staging
npx wrangler dev --env staging

# Bad: No testing
# No testing
```

## References

- [Cloudflare Workers](https://developers.cloudflare.com/workers/)
- [Lambda@Edge](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/lambda-at-the-edge.html)
- [CloudFront](https://aws.amazon.com/cloudfront/)
- [Edge Computing](https://www.cloudflare.com/learning/serverless/what-is-edge-computing/)
