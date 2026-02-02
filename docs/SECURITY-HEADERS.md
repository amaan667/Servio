# Security Headers for API Responses

This document describes the implementation of security headers for API responses on the Servio platform.

## Table of Contents

1. [Overview](#overview)
2. [Features](#features)
3. [Implementation](#implementation)
4. [Headers](#headers)
5. [Middleware](#middleware)
6. [Best Practices](#best-practices)

## Overview

Security headers are HTTP response headers that help protect web applications from various security vulnerabilities. They provide an additional layer of security by:

- **Preventing XSS attacks:** Content Security Policy (CSP)
- **Preventing clickjacking:** X-Frame-Options
- **Preventing MIME type sniffing:** X-Content-Type-Options
- **Enforcing HTTPS:** Strict-Transport-Security (HSTS)
- **Controlling referrer information:** Referrer-Policy
- **Preventing cross-origin attacks:** Cross-Origin-Opener-Policy, Cross-Origin-Resource-Policy

## Features

### Security Headers Middleware

```typescript
// lib/middleware/security-headers.ts
import { NextResponse } from 'next/server';

export function addSecurityHeaders(response: NextResponse): NextResponse {
  // Content Security Policy
  response.headers.set(
    'Content-Security-Policy',
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net; " +
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
    "font-src 'self' https://fonts.gstatic.com; " +
    "img-src 'self' data: https:; " +
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co; " +
    "frame-src 'none'; " +
    "object-src 'none'; " +
    "base-uri 'self'; " +
    "form-action 'self'; " +
    "frame-ancestors 'none'; " +
    "report-uri /api/csp-report"
  );

  // X-Frame-Options (prevent clickjacking)
  response.headers.set('X-Frame-Options', 'DENY');

  // X-Content-Type-Options (prevent MIME type sniffing)
  response.headers.set('X-Content-Type-Options', 'nosniff');

  // X-XSS-Protection (enable XSS filter)
  response.headers.set('X-XSS-Protection', '1; mode=block');

  // Strict-Transport-Security (enforce HTTPS)
  response.headers.set(
    'Strict-Transport-Security',
    'max-age=31536000; includeSubDomains; preload'
  );

  // Referrer-Policy (control referrer information)
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Permissions-Policy (control browser features)
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=()'
  );

  // Cross-Origin-Opener-Policy (control cross-origin opener)
  response.headers.set('Cross-Origin-Opener-Policy', 'same-origin');

  // Cross-Origin-Resource-Policy (control cross-origin resource)
  response.headers.set('Cross-Origin-Resource-Policy', 'same-origin');

  // Cache-Control (prevent caching of sensitive data)
  response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  response.headers.set('Pragma', 'no-cache');
  response.headers.set('Expires', '0');

  // X-Content-Type-Options (prevent MIME type sniffing)
  response.headers.set('X-Content-Type-Options', 'nosniff');

  // X-Permitted-Cross-Domain-Policies (restrict cross-domain policies)
  response.headers.set('X-Permitted-Cross-Domain-Policies', 'none');

  return response;
}
```

### API-Specific Security Headers

```typescript
// lib/middleware/api-security-headers.ts
import { NextResponse } from 'next/server';

export function addAPISecurityHeaders(response: NextResponse): NextResponse {
  // Add general security headers
  response = addSecurityHeaders(response);

  // API-specific headers
  response.headers.set('X-API-Version', '1.0');
  response.headers.set('X-RateLimit-Limit', '1000');
  response.headers.set('X-RateLimit-Remaining', '999');
  response.headers.set('X-RateLimit-Reset', Math.floor(Date.now() / 1000 + 60).toString());

  // CORS headers (if needed)
  response.headers.set('Access-Control-Allow-Origin', 'https://servio.com');
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  response.headers.set('Access-Control-Max-Age', '86400');
  response.headers.set('Access-Control-Allow-Credentials', 'true');

  // X-Request-ID (for tracing)
  response.headers.set('X-Request-ID', generateRequestId());

  return response;
}

function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
}
```

## Headers

### Content Security Policy (CSP)

The Content Security Policy (CSP) header helps prevent cross-site scripting (XSS) attacks by controlling which resources can be loaded.

```typescript
// Good: Strict CSP
response.headers.set(
  'Content-Security-Policy',
  "default-src 'self'; " +
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net; " +
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
  "font-src 'self' https://fonts.gstatic.com; " +
  "img-src 'self' data: https:; " +
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co; " +
  "frame-src 'none'; " +
  "object-src 'none'; " +
  "base-uri 'self'; " +
  "form-action 'self'; " +
  "frame-ancestors 'none'; " +
  "report-uri /api/csp-report"
);

// Bad: No CSP
// No CSP header
```

### X-Frame-Options

The X-Frame-Options header prevents clickjacking attacks by controlling whether the page can be embedded in a frame.

```typescript
// Good: DENY
response.headers.set('X-Frame-Options', 'DENY');

// Bad: ALLOWALL
response.headers.set('X-Frame-Options', 'ALLOWALL');
```

### X-Content-Type-Options

The X-Content-Type-Options header prevents MIME type sniffing attacks.

```typescript
// Good: nosniff
response.headers.set('X-Content-Type-Options', 'nosniff');

// Bad: No header
// No X-Content-Type-Options header
```

### X-XSS-Protection

The X-XSS-Protection header enables the browser's XSS filter.

```typescript
// Good: 1; mode=block
response.headers.set('X-XSS-Protection', '1; mode=block');

// Bad: 0
response.headers.set('X-XSS-Protection', '0');
```

### Strict-Transport-Security (HSTS)

The Strict-Transport-Security header enforces HTTPS connections.

```typescript
// Good: max-age=31536000; includeSubDomains; preload
response.headers.set(
  'Strict-Transport-Security',
  'max-age=31536000; includeSubDomains; preload'
);

// Bad: max-age=0
response.headers.set('Strict-Transport-Security', 'max-age=0');
```

### Referrer-Policy

The Referrer-Policy header controls how much referrer information is sent.

```typescript
// Good: strict-origin-when-cross-origin
response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

// Bad: unsafe-url
response.headers.set('Referrer-Policy', 'unsafe-url');
```

### Permissions-Policy

The Permissions-Policy header controls which browser features can be used.

```typescript
// Good: Restrict features
response.headers.set(
  'Permissions-Policy',
  'camera=(), microphone=(), geolocation=(), payment=()'
);

// Bad: Allow all features
response.headers.set('Permissions-Policy', '*');
```

## Middleware

### Next.js Middleware

```typescript
// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { addSecurityHeaders } from '@/lib/middleware/security-headers';

export function middleware(request: NextRequest) {
  const response = NextResponse.next();

  // Add security headers to all responses
  return addSecurityHeaders(response);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
```

### API Route Middleware

```typescript
// lib/middleware/api-route-middleware.ts
import { NextResponse } from 'next/server';
import { addAPISecurityHeaders } from './api-security-headers';

export function withAPISecurityHeaders(
  handler: (request: Request) => Promise<NextResponse>
) {
  return async (request: Request) => {
    const response = await handler(request);

    // Add API security headers
    return addAPISecurityHeaders(response);
  };
}
```

### Usage in API Routes

```typescript
// app/api/venues/route.ts
import { withAPISecurityHeaders } from '@/lib/middleware/api-route-middleware';

export const GET = withAPISecurityHeaders(async (request: Request) => {
  const { data } = await supabase.from('venues').select('*');

  return NextResponse.json({ data });
});

export const POST = withAPISecurityHeaders(async (request: Request) => {
  const body = await request.json();
  const { data } = await supabase.from('venues').insert(body).select().single();

  return NextResponse.json({ data }, { status: 201 });
});
```

## Best Practices

### 1. Use Strict CSP

Use a strict Content Security Policy:

```typescript
// Good: Strict CSP
response.headers.set(
  'Content-Security-Policy',
  "default-src 'self'; " +
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net; " +
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
  "font-src 'self' https://fonts.gstatic.com; " +
  "img-src 'self' data: https:; " +
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co; " +
  "frame-src 'none'; " +
  "object-src 'none'; " +
  "base-uri 'self'; " +
  "form-action 'self'; " +
  "frame-ancestors 'none'; " +
  "report-uri /api/csp-report"
);

// Bad: No CSP
// No CSP header
```

### 2. Use HSTS with Preload

Use HSTS with preload for better security:

```typescript
// Good: HSTS with preload
response.headers.set(
  'Strict-Transport-Security',
  'max-age=31536000; includeSubDomains; preload'
);

// Bad: HSTS without preload
response.headers.set(
  'Strict-Transport-Security',
  'max-age=31536000; includeSubDomains'
);
```

### 3. Use Report-Only Mode in Development

Use report-only mode in development:

```typescript
// Good: Report-only in development
if (process.env.NODE_ENV === 'development') {
  response.headers.set(
    'Content-Security-Policy-Report-Only',
    cspPolicy
  );
} else {
  response.headers.set('Content-Security-Policy', cspPolicy);
}

// Bad: Always enforce
response.headers.set('Content-Security-Policy', cspPolicy);
```

### 4. Implement CSP Reporting

Implement CSP reporting to detect violations:

```typescript
// app/api/csp-report/route.ts
export async function POST(request: Request) {
  const report = await request.json();

  // Log CSP violation
  console.error('CSP Violation:', report);

  // Store in database for analysis
  await supabase.from('csp_violations').insert({
    report,
    timestamp: new Date(),
  });

  return new Response(null, { status: 204 });
}
```

### 5. Use Nonce for Inline Scripts

Use nonce for inline scripts:

```typescript
// Good: Use nonce
const nonce = crypto.randomBytes(16).toString('base64');

response.headers.set(
  'Content-Security-Policy',
  `default-src 'self'; script-src 'self' 'nonce-${nonce}'`
);

// In the HTML
<script nonce={nonce}>
  // Inline script
</script>

// Bad: Use unsafe-inline
response.headers.set(
  'Content-Security-Policy',
  "default-src 'self'; script-src 'self' 'unsafe-inline'"
);
```

### 6. Test Security Headers

Test security headers regularly:

```typescript
// __tests__/security-headers.test.ts
import { addSecurityHeaders } from '@/lib/middleware/security-headers';

describe('Security Headers', () => {
  it('should add Content-Security-Policy header', () => {
    const response = new NextResponse();
    const securedResponse = addSecurityHeaders(response);

    expect(securedResponse.headers.get('Content-Security-Policy')).toBeDefined();
  });

  it('should add X-Frame-Options header', () => {
    const response = new NextResponse();
    const securedResponse = addSecurityHeaders(response);

    expect(securedResponse.headers.get('X-Frame-Options')).toBe('DENY');
  });

  it('should add Strict-Transport-Security header', () => {
    const response = new NextResponse();
    const securedResponse = addSecurityHeaders(response);

    expect(securedResponse.headers.get('Strict-Transport-Security')).toContain('max-age=31536000');
  });
});
```

### 7. Use Security Header Scanners

Use security header scanners to verify headers:

```bash
# Use securityheaders.com
curl -I https://api.servio.com | securityheaders

# Use Mozilla Observatory
npx observatory-cli scan api.servio.com

# Use Lighthouse
npx lighthouse https://api.servio.com --view
```

## References

- [OWASP Secure Headers](https://owasp.org/www-project-secure-headers/)
- [Content Security Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)
- [HTTP Strict Transport Security](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Strict-Transport-Security)
- [Mozilla Observatory](https://observatory.mozilla.org/)
- [Security Headers](https://securityheaders.com/)
