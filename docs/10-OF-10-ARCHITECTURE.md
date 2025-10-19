# 10/10 Architecture Documentation

**Version:** 2.0  
**Last Updated:** January 2025  
**Status:** Production-Ready

---

## Overview

This document describes the comprehensive 10/10 architecture overhaul implemented for Servio. The system now follows industry best practices for modern SaaS platforms.

---

## Architecture Principles

### 1. **Separation of Concerns**
- **Presentation Layer**: React components (UI)
- **Business Logic Layer**: Service classes and hooks
- **Data Access Layer**: Supabase client wrappers
- **Infrastructure Layer**: Caching, rate limiting, monitoring

### 2. **Type Safety**
- Full TypeScript coverage
- Zod schema validation
- Strict type checking in CI/CD

### 3. **Error Handling**
- Standardized error responses
- Centralized error logging
- Graceful degradation

### 4. **Performance**
- Redis caching for hot paths
- Request rate limiting
- Database query optimization

### 5. **Testing**
- Unit tests for utilities
- Integration tests for API routes
- E2E tests for critical flows

---

## Core Components

### API Response Helpers

**Location:** `lib/api/response-helpers.ts`

Standardized response formatting for all API routes:

```typescript
import { ok, fail, validationError } from '@/lib/api/response-helpers';

// Success response
return ok({ data: result });

// Error response
return fail('Error message', 400);

// Validation error
return validationError('Invalid input', details);
```

**Available Helpers:**
- `ok<T>(data, status)` - Success response
- `fail(error, status, details)` - Error response
- `validationError(error, details)` - 400 Bad Request
- `unauthorized(error)` - 401 Unauthorized
- `forbidden(error)` - 403 Forbidden
- `notFound(error)` - 404 Not Found
- `serverError(error, details)` - 500 Internal Server Error
- `rateLimited(error)` - 429 Too Many Requests

### API Handler Wrapper

**Location:** `lib/api/handler-wrapper.ts`

Consistent error handling and logging:

```typescript
import { withErrorHandling } from '@/lib/api/handler-wrapper';

export const POST = withErrorHandling(async (req, body) => {
  // Your handler logic
  return result;
}, {
  requireAuth: true,
  logRequest: true,
  logResponse: true,
});
```

**Features:**
- Automatic error catching and logging
- Zod validation error handling
- Request/response logging
- Standardized error responses

### Redis Caching

**Location:** `lib/cache/redis-cache.ts`

High-performance caching for hot paths:

```typescript
import { cacheJson, invalidateCache } from '@/lib/cache/redis-cache';

// Cache with automatic JSON serialization
const menu = await cacheJson(
  `menu:${venueId}`,
  async () => {
    // Fetch from database
    return await fetchMenu(venueId);
  },
  { ttl: 60, keyPrefix: 'menu' }
);

// Invalidate cache
await invalidateCache(`menu:${venueId}`, 'menu');
```

**Features:**
- Automatic JSON serialization
- Configurable TTL (time-to-live)
- Cache invalidation
- Pattern-based invalidation
- Graceful degradation (works without Redis)

### Rate Limiting

**Location:** `lib/middleware/rate-limit.ts`

Protect API endpoints from abuse:

```typescript
import { withRateLimit, RateLimits } from '@/lib/middleware/rate-limit';

// Apply rate limiting to a route
export const POST = withRateLimit(RateLimits.AUTHENTICATED)(async (req) => {
  // Your handler
});
```

**Pre-configured Limits:**
- `PUBLIC`: 60 req/min
- `AUTHENTICATED`: 120 req/min
- `HIGH_FREQUENCY`: 300 req/min
- `WEBHOOK`: 1000 req/min

**Features:**
- Sliding window counter
- IP-based and user-based limiting
- Automatic retry-after headers
- Graceful degradation

---

## Testing Infrastructure

### Test Utilities

**Location:** `test/utils/next-api.ts`

Helper for testing Next.js API routes:

```typescript
import { callRoute } from '@/test/utils/next-api';

const { status, json } = await callRoute<ResponseType>(handler, {
  method: 'POST',
  body: { data: 'test' },
  headers: { 'content-type': 'application/json' },
});
```

### Test Coverage

**Target:** 60%+ coverage on critical routes

**Current Coverage:**
- Unit tests: 7 test files
- Integration tests: 5 API routes
- E2E tests: 1 critical flow

**Running Tests:**
```bash
pnpm test              # Run all tests
pnpm test:watch        # Watch mode
pnpm test:coverage     # With coverage report
pnpm test:e2e          # E2E tests
```

---

## Development Workflow

### Git Hooks (Husky)

**Pre-commit:**
- Runs `lint-staged`
- Fixes ESLint errors
- Formats with Prettier

**Pre-push:**
- Runs TypeScript type check
- Runs test suite
- Prevents push if tests fail

### Lint-Staged Configuration

**Location:** `package.json`

```json
{
  "lint-staged": {
    "*.{ts,tsx}": ["eslint --fix"],
    "*.{js,jsx,css,md,json}": ["prettier -w"]
  }
}
```

---

## CI/CD Pipeline

**Location:** `.github/workflows/ci.yml`

**Pipeline Steps:**
1. **Lint** - ESLint checks
2. **Type Check** - TypeScript compilation
3. **Tests** - Unit and integration tests
4. **Coverage** - Generate coverage report
5. **Build** - Next.js production build
6. **Security Scan** - Trivy vulnerability scan
7. **Deploy** - Deploy to Railway (main branch only)

**Artifacts:**
- Test coverage report (7 days retention)
- Build artifacts (1 day retention)

---

## Performance Optimizations

### 1. Redis Caching

**Hot Paths Cached:**
- Menu items (60s TTL)
- Order counts (30s TTL)
- Venue settings (300s TTL)
- User sessions (600s TTL)

**Cache Invalidation:**
- Automatic on data mutations
- Pattern-based bulk invalidation
- Manual invalidation hooks

### 2. Rate Limiting

**Protected Endpoints:**
- Order creation: 120 req/min
- Menu updates: 60 req/min
- Payment processing: 300 req/min
- Stripe webhooks: 1000 req/min

### 3. Database Optimization

- Indexed queries
- Connection pooling
- Query result caching
- N+1 query prevention

---

## Error Handling Standards

### Error Response Format

```typescript
{
  ok: false,
  error: "Human-readable error message",
  details?: {
    // Additional error details
    code: "ERROR_CODE",
    field: "field_name",
    value: "invalid_value"
  }
}
```

### Error Logging

All errors are logged with:
- Error message
- Stack trace
- Request context
- User ID (if authenticated)
- Timestamp

### Error Types

- **Validation Errors** (400) - Invalid input
- **Authentication Errors** (401) - Not authenticated
- **Authorization Errors** (403) - Not authorized
- **Not Found Errors** (404) - Resource not found
- **Rate Limit Errors** (429) - Too many requests
- **Server Errors** (500) - Internal server error

---

## Security Best Practices

### 1. Authentication
- OAuth 2.0 with PKCE
- JWT token validation
- Secure cookie storage
- Session management

### 2. Authorization
- Row-Level Security (RLS)
- Role-based access control
- Middleware authorization
- API route protection

### 3. Data Protection
- HTTPS everywhere
- Environment variable secrets
- Input validation (Zod)
- SQL injection prevention

### 4. Rate Limiting
- IP-based limiting
- User-based limiting
- Endpoint-specific limits
- Automatic blocking

---

## Code Quality Metrics

### Current Status

| Metric | Target | Current | Status |
|--------|--------|---------|--------|
| TypeScript Coverage | 100% | 100% | ✅ |
| Test Coverage | 60%+ | 25% | 🟡 |
| Lint Errors | 0 | 0 | ✅ |
| Build Time | <2min | ~1.5min | ✅ |
| Bundle Size | <500KB | ~450KB | ✅ |

### Large Files (Refactoring Needed)

| File | Lines | Target | Status |
|------|-------|--------|--------|
| LiveOrdersClient.tsx | 1,791 | <600 | 🟡 |
| MenuManagementClient.tsx | 1,511 | <600 | 🟡 |
| tool-executors.ts | 1,861 | <600 | 🟡 |

---

## Migration Guide

### Upgrading Existing Routes

**Before:**
```typescript
export async function POST(req: Request) {
  try {
    const body = await req.json();
    // ... logic
    return NextResponse.json({ ok: true, data: result });
  } catch (error) {
    return NextResponse.json({ ok: false, error: 'Failed' }, { status: 500 });
  }
}
```

**After:**
```typescript
import { withErrorHandling } from '@/lib/api/handler-wrapper';
import { ok } from '@/lib/api/response-helpers';

export const POST = withErrorHandling(async (req, body) => {
  // ... logic
  return result;
});
```

### Adding Caching

**Before:**
```typescript
export async function GET(req: Request) {
  const menu = await fetchMenu(venueId);
  return NextResponse.json({ ok: true, data: menu });
}
```

**After:**
```typescript
import { cacheJson } from '@/lib/cache/redis-cache';

export async function GET(req: Request) {
  const menu = await cacheJson(
    `menu:${venueId}`,
    () => fetchMenu(venueId),
    { ttl: 60 }
  );
  return ok(menu);
}
```

### Adding Rate Limiting

```typescript
import { withRateLimit, RateLimits } from '@/lib/middleware/rate-limit';

export const POST = withRateLimit(RateLimits.AUTHENTICATED)(
  async (req: Request) => {
    // ... handler
  }
);
```

---

## Future Improvements

### Phase 2: Large File Refactoring
- [ ] Refactor LiveOrdersClient.tsx (<600 lines)
- [ ] Refactor MenuManagementClient.tsx (<600 lines)
- [ ] Refactor tool-executors.ts (<600 lines)
- [ ] Extract reusable components
- [ ] Create custom hooks

### Phase 3: Enhanced Testing
- [ ] Achieve 60%+ test coverage
- [ ] Add E2E tests for all critical flows
- [ ] Add visual regression tests
- [ ] Add performance tests

### Phase 4: Advanced Caching
- [ ] Implement cache warming
- [ ] Add cache analytics
- [ ] Implement cache invalidation strategies
- [ ] Add distributed caching

### Phase 5: Monitoring & Observability
- [ ] Add APM (Application Performance Monitoring)
- [ ] Implement distributed tracing
- [ ] Add custom metrics
- [ ] Create dashboards

---

## Resources

- [Architecture Documentation](./ARCHITECTURE.md)
- [API Documentation](./API.md)
- [Performance Guide](./PERFORMANCE_OPTIMIZATION_GUIDE.md)
- [Testing Guide](../README.md#testing)

---

## Support

For questions or issues:
- GitHub Issues: [Create an issue](https://github.com/amaan667/Servio/issues)
- Documentation: [Read the docs](./)
- Team: Contact the development team

---

**Last Updated:** January 2025  
**Maintained By:** Servio Development Team

