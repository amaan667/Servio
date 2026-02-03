# Architecture Documentation

This document outlines the architectural patterns, design decisions, and best practices used in the Servio multi-tenant SaaS application.

## Table of Contents

1. [Overview](#overview)
2. [Core Architectural Patterns](#core-architectural-patterns)
3. [Multi-Tenancy Strategy](#multi-tenancy-strategy)
4. [API Design Patterns](#api-design-patterns)
5. [Database Design](#database-design)
6. [Security Architecture](#security-architecture)
7. [Service Layer Pattern](#service-layer-pattern)
8. [Monitoring & Observability](#monitoring--observability)
9. [Performance Optimization](#performance-optimization)
10. [Deployment Architecture](#deployment-architecture)

## Overview

Servio is a multi-tenant SaaS application built with:
- **Frontend**: Next.js 14 with App Router
- **Backend**: Next.js API Routes with Supabase
- **Database**: PostgreSQL (via Supabase)
- **Authentication**: Supabase Auth
- **Payments**: Stripe
- **Caching**: Redis (production), in-memory (development)
- **Monitoring**: Sentry, custom structured logging

### Technology Stack

| Layer | Technology | Purpose |
|--------|-------------|---------|
| Frontend | Next.js 14, React, Tailwind CSS | UI and routing |
| Backend | Next.js API Routes | Server-side logic |
| Database | PostgreSQL (Supabase) | Data persistence |
| Auth | Supabase Auth | User authentication |
| Payments | Stripe | Payment processing |
| Caching | Redis | Distributed caching |
| Monitoring | Sentry | Error tracking and APM |
| AI | OpenAI GPT-4 | AI assistant |

## Core Architectural Patterns

### 1. Unified Handler Pattern

The `createUnifiedHandler` function provides a consistent API handler with built-in:
- Rate limiting
- Authentication
- Authorization (venue access)
- Role-based access control
- Idempotency
- Input validation (Zod schemas)
- Error handling
- APM tracking

**Location**: [`lib/api/unified-handler.ts`](../lib/api/unified-handler.ts)

**Usage Example**:
```typescript
export const POST = createUnifiedHandler(
  async (req, context) => {
    const { body, user, venueId } = context;
    // Business logic here
    return { success: true, data: result };
  },
  {
    schema: mySchema,
    requireAuth: true,
    requireVenueAccess: true,
    requireRole: ["owner", "manager"],
    rateLimit: RATE_LIMITS.GENERAL,
    enforceIdempotency: true, // Critical for payments
  }
);
```

**Benefits**:
- Consistent error handling
- Automatic rate limiting
- Built-in authentication
- Venue access enforcement
- Idempotency support
- APM tracking

### 2. Service Layer Pattern

The service layer encapsulates business logic and provides:
- Caching
- Error handling
- Consistent interfaces
- Reusable functionality

**Location**: [`lib/services/`](../lib/services/)

**Services**:
- [`OrderService`](../lib/services/OrderService.ts) - Order management
- [`MenuService`](../lib/services/MenuService.ts) - Menu management
- [`InventoryService`](../lib/services/InventoryService.ts) - Inventory management
- [`KDSService`](../lib/services/KDSService.ts) - Kitchen Display System
- [`ReservationService`](../lib/services/ReservationService.ts) - Reservation management
- [`StaffService`](../lib/services/StaffService.ts) - Staff management
- [`TableService`](../lib/services/TableService.ts) - Table management
- [`StripeService`](../lib/services/StripeService.ts) - Stripe integration

**Base Service**: [`BaseService`](../lib/services/BaseService.ts)

**Benefits**:
- Centralized business logic
- Consistent caching strategy
- Reusable error handling
- Easy to test

### 3. Repository Pattern

The repository pattern provides data access abstraction with:
- Type-safe queries
- Consistent error handling
- Caching support

**Location**: [`lib/repositories/`](../lib/repositories/) (if exists)

**Benefits**:
- Separation of concerns
- Easy to mock for testing
- Consistent data access patterns

## Multi-Tenancy Strategy

### Tenant Isolation

Servio uses **venue-based multi-tenancy** with Row Level Security (RLS):

1. **Tenant Column**: Each tenant-specific table has a `venue_id` column
2. **RLS Policies**: Database-level policies enforce tenant isolation
3. **Venue Access Table**: [`venue_access`](../migrations/role-based-access-control.sql) table maps users to venues

### RLS Policy Structure

```sql
-- Enable RLS
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their venue's data
CREATE POLICY "Users can read own venue data"
ON public.orders
FOR SELECT
TO authenticated
USING (
  venue_id IN (
    SELECT venue_id FROM venue_access
    WHERE user_id = auth.uid()
  )
);

-- Policy: Service role can manage all data
CREATE POLICY "Service role can manage all"
ON public.orders
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);
```

### Tenant-Aware Client Factory

**Location**: [`lib/ai/client-factory.ts`](../lib/ai/client-factory.ts)

**Functions**:
- `createAIClient({ venueId })` - Creates RLS-respecting client for AI tools
- `createAIClientWithUser({ userId, venueId })` - Creates client with user context
- `addTenantFilter(query, venueId)` - Adds venue filtering to queries
- `verifyVenueAccess(userId, venueId)` - Checks user has venue access

**Usage Example**:
```typescript
import { createAIClient, addTenantFilter } from "@/lib/ai/client-factory";

// Create RLS-respecting client
const supabase = await createAIClient({ venueId: "venue-123" });

// Query with automatic tenant filtering
const query = addTenantFilter(
  supabase.from("orders").select("*"),
  "venue-123"
);

const { data } = await query;
```

**Security Rule**: AI tools MUST use `createAIClient()` instead of `createAdminClient()` to prevent cross-tenant data access.

## API Design Patterns

### RESTful API Design

All API routes follow RESTful conventions:

| Method | Endpoint | Purpose | Idempotent |
|--------|----------|---------|-------------|
| GET | `/api/orders` | List orders | Yes |
| POST | `/api/orders` | Create order | No (use idempotency key) |
| GET | `/api/orders/[id]` | Get order | Yes |
| PATCH | `/api/orders/[id]` | Update order | No (use idempotency key) |
| DELETE | `/api/orders/[id]` | Delete order | No (use idempotency key) |

### Idempotency Pattern

**Location**: [`lib/db/idempotency.ts`](../lib/db/idempotency.ts)

**Table**: [`idempotency_keys`](../supabase/migrations/20260203000000_idempotency_keys.sql)

**Implementation**:
1. Client sends `x-idempotency-key` header
2. Server checks if key exists in `idempotency_keys` table
3. If exists, return cached response
4. If not exists, execute operation and cache response
5. Keys expire after 1 hour (configurable)

**Usage**:
```typescript
// Enable idempotency in unified handler
export const POST = createUnifiedHandler(
  async (req, context) => {
    // Business logic
    return { success: true };
  },
  {
    enforceIdempotency: true, // Enable idempotency
  }
);
```

**Critical for**: Payment operations, order creation, inventory updates

### Rate Limiting Pattern

**Location**: [`lib/rate-limit.ts`](../lib/rate-limit.ts)

**Implementation**:
- Redis-based distributed rate limiting (production)
- In-memory rate limiting (development)
- Per-endpoint tier configuration
- Metrics export for monitoring

**Tiers**:
```typescript
export const RATE_LIMITS = {
  GENERAL: { limit: 100, window: 60 },      // 100 requests per minute
  PAYMENTS: { limit: 10, window: 60 },     // 10 payments per minute
  WEBHOOKS: { limit: 50, window: 60 },    // 50 webhooks per minute
  AI: { limit: 20, window: 60 },         // 20 AI requests per minute
};
```

**Health Check**: [`checkRedisHealth()`](../lib/rate-limit.ts) function monitors Redis connectivity

## Database Design

### Atomic Operations

**RPC Functions**:
1. [`create_order_atomic`](../supabase/migrations/20260203000001_atomic_order_creation.sql) - Atomic order creation with inventory deduction
2. [`process_payment_atomic`](../supabase/migrations/20260203000002_atomic_payment_processing.sql) - Atomic payment processing with idempotency check
3. [`deduct_inventory_atomic`](../supabase/migrations/20260203000003_atomic_inventory_deduction.sql) - Atomic inventory deduction with stock validation

**Benefits**:
- Prevents race conditions
- Ensures data consistency
- All-or-nothing semantics
- Automatic rollback on error

### Transaction Safety

**Pattern**: Use database transactions for multi-step operations

**Example**:
```sql
BEGIN;
  -- Step 1: Create order
  INSERT INTO orders (...) VALUES (...);
  
  -- Step 2: Create order items
  INSERT INTO order_items (...) VALUES (...);
  
  -- Step 3: Update inventory
  UPDATE inventory_items SET stock = stock - quantity WHERE ...;
COMMIT;
```

### Indexing Strategy

**Indexes**:
- Primary keys on all tables
- Foreign key indexes
- `venue_id` indexes for tenant filtering
- `created_at` indexes for time-based queries
- Composite indexes for common query patterns

**Example**:
```sql
CREATE INDEX idx_orders_venue_id_created_at 
  ON orders(venue_id, created_at DESC);

CREATE INDEX idx_order_items_order_id 
  ON order_items(order_id);
```

## Security Architecture

### Authentication Flow

1. **User Registration/Login**: Supabase Auth
2. **Session Management**: Supabase Auth sessions
3. **Token Refresh**: Automatic token refresh
4. **Role-Based Access**: [`lib/entitlements/guards.ts`](../lib/entitlements/guards.ts)

### Authorization Layers

1. **Authentication**: User is logged in
2. **Venue Access**: User has access to venue (via [`venue_access`](../migrations/role-based-access-control.sql) table)
3. **Role-Based**: User has required role (owner, manager, staff, server, kitchen)
4. **Tier-Based**: Organization tier allows certain features

**Location**: [`lib/access/getAccessContext.ts`](../lib/access/getAccessContext.ts)

### RLS Enforcement

**Critical Rule**: Never use `createAdminClient()` in user-facing routes

**Allowed Usage**:
- Admin routes: `app/api/admin/**`
- Background jobs
- Webhooks (with proper signature verification)

**Forbidden Usage**:
- User-facing API routes
- AI tools (use [`createAIClient()`](../lib/ai/client-factory.ts) instead)

**ESLint Rule**: [`eslint.config.mjs`](../eslint.config.mjs) enforces this rule

### Payment Security

1. **Stripe Webhook Signature Verification**: All webhooks verify Stripe signatures
2. **Idempotency**: Payment operations use idempotency keys
3. **Atomic Operations**: Payment processing uses atomic RPC functions
4. **Audit Trail**: [`payment_transactions`](../supabase/migrations/20260203000002_atomic_payment_processing.sql) table tracks all payments

## Service Layer Pattern

### Base Service

**Location**: [`lib/services/BaseService.ts`](../lib/services/BaseService.ts)

**Features**:
- Caching with TTL
- Error handling
- Logging
- Metrics tracking

**Example**:
```typescript
export class OrderService extends BaseService {
  async getOrder(id: string) {
    // Check cache first
    const cached = await this.cache.get(`order:${id}`);
    if (cached) return cached;

    // Fetch from database
    const order = await this.supabase.from('orders').select('*').eq('id', id).single();

    // Cache result
    await this.cache.set(`order:${id}`, order, 300); // 5 minutes

    return order;
  }
}
```

### Service Interface

All services implement consistent interfaces:
- `getById(id)`
- `list(filters)`
- `create(data)`
- `update(id, data)`
- `delete(id)`

## Monitoring & Observability

### Structured Logging

**Location**: [`lib/monitoring/structured-logger.ts`](../lib/monitoring/structured-logger.ts)

**Log Levels**:
- `error` - Critical errors
- `warn` - Warning conditions
- `info` - Informational messages
- `debug` - Debug information

**Log Structure**:
```typescript
logger.info("Order created", {
  orderId: order.id,
  venueId: order.venue_id,
  userId: context.user.id,
  type: "order_created",
});
```

### Error Tracking

**Location**: [`lib/monitoring/error-tracking.ts`](../lib/monitoring/error-tracking.ts)

**Features**:
- Sentry integration
- Error context capture
- User information
- Request correlation

**Usage**:
```typescript
trackError(error, {
  action: "create_order",
  orderId: order.id,
  userId: user.id,
}, "high");
```

### Performance Monitoring

**Location**: [`lib/monitoring/performance.ts`](../lib/monitoring/performance.ts)

**Metrics**:
- API response times
- Database query times
- Cache hit rates
- External service call times

**APM Integration**: [`lib/monitoring/apm.ts`](../lib/monitoring/apm.ts)

### Health Checks

**Endpoints**:
- `/api/ready` - Overall system health
- `/api/sli` - Service Level Indicators
- Redis health check: [`checkRedisHealth()`](../lib/rate-limit.ts)

**Response Format**:
```typescript
{
  status: "ok" | "degraded" | "error",
  checks: {
    database: "ok" | "error",
    redis: "ok" | "error",
    stripe: "ok" | "error",
  },
  timestamp: string,
}
```

## Performance Optimization

### Caching Strategy

**Multi-Layer Caching**:
1. **In-Memory Cache**: [`lib/cache/memory-cache.ts`](../lib/cache/memory-cache.ts) - Fast, local cache
2. **Redis Cache**: [`lib/cache/redis.ts`](../lib/cache/redis.ts) - Distributed cache for production
3. **Dashboard Counts Cache**: [`lib/cache/dashboard-counts-server-cache.ts`](../lib/cache/dashboard-counts-server-cache.ts) - Cached dashboard metrics

**Cache Keys**:
- `order:${orderId}` - Order data
- `menu:${venueId}` - Menu data
- `inventory:${venueId}` - Inventory data
- `counts:${venueId}` - Dashboard counts

**TTL Configuration**:
- Orders: 5 minutes
- Menu: 10 minutes
- Inventory: 5 minutes
- Counts: 1 minute

### Query Optimization

**Strategies**:
1. **Selective Columns**: Only query required columns
2. **Index Usage**: Leverage indexes for filtering
3. **Pagination**: Use cursor-based pagination for large datasets
4. **Batch Operations**: Batch inserts/updates where possible

**Example**:
```typescript
// ❌ BAD - Fetches all columns
const { data } = await supabase.from('orders').select('*');

// ✅ GOOD - Fetches only required columns
const { data } = await supabase.from('orders').select('id, venue_id, order_status, total_amount');
```

### Bundle Size Optimization

**Strategies**:
1. **Code Splitting**: Dynamic imports for large libraries
2. **Tree Shaking**: Remove unused code
3. **Image Optimization**: Next.js Image Optimization
4. **Font Optimization**: Subset fonts

## Deployment Architecture

### Environment Configuration

**Required Environment Variables**:
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `SUPABASE_ANON_KEY` - Supabase anon key (RLS)
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key (admin only)
- `STRIPE_SECRET_KEY` - Stripe secret key
- `STRIPE_WEBHOOK_SECRET` - Stripe webhook secret
- `STRIPE_CUSTOMER_WEBHOOK_SECRET` - Stripe customer webhook secret
- `REDIS_URL` - Redis connection URL (production)
- `NEXT_PUBLIC_SITE_URL` - Application URL
- `SENTRY_DSN` - Sentry DSN (production)

**See**: [`.env.example`](../.env.example)

### Deployment Platforms

**Development**:
- Local development with hot reload
- In-memory caching
- Debug logging enabled

**Staging**:
- Railway or Vercel
- Redis required
- Production-like configuration

**Production**:
- Railway or Vercel
- Redis required
- Sentry enabled
- Optimized builds

### Scaling Considerations

**Horizontal Scaling**:
- Stateless API routes
- Redis for distributed caching
- Database connection pooling (handled by Supabase)
- CDN for static assets

**Vertical Scaling**:
- Increase database instance size
- Increase Redis instance size
- Optimize queries and indexes

## Best Practices

### Code Organization

```
app/
├── api/              # API routes
│   ├── admin/        # Admin-only routes (use createAdminClient)
│   ├── dashboard/     # Dashboard routes (use createServerSupabase)
│   ├── orders/        # Order management
│   └── payments/       # Payment processing
├── dashboard/         # Dashboard pages
└── (venueId)/       # Venue-specific pages

lib/
├── api/              # API utilities (unified handler, validation)
├── services/         # Business logic services
├── repositories/      # Data access layer (if exists)
├── monitoring/        # Logging and monitoring
├── cache/            # Caching layer
└── ai/              # AI tools and client factory

docs/                  # Documentation
migrations/             # Database migrations
```

### Naming Conventions

**Files**: `kebab-case.ts` (e.g., `order-service.ts`)
**Components**: `PascalCase.tsx` (e.g., `OrderCard.tsx`)
**Functions**: `camelCase` (e.g., `createOrder`)
**Constants**: `UPPER_SNAKE_CASE` (e.g., `RATE_LIMITS`)
**Database Tables**: `snake_case` (e.g., `order_items`)
**Database Columns**: `snake_case` (e.g., `venue_id`)

### Error Handling

**Standard Error Response**:
```typescript
{
  success: false,
  error: "Error message",
  code: "ERROR_CODE",
  details: { ... }, // Development only
}
```

**Error Types**:
- `apiErrors.badRequest()` - 400 Bad Request
- `apiErrors.unauthorized()` - 401 Unauthorized
- `apiErrors.forbidden()` - 403 Forbidden
- `apiErrors.notFound()` - 404 Not Found
- `apiErrors.rateLimit()` - 429 Rate Limit
- `apiErrors.internal()` - 500 Internal Server Error

### Testing Strategy

**Unit Tests**: Test individual functions and components
**Integration Tests**: Test API endpoints and database operations
**E2E Tests**: Test critical user flows
**Load Tests**: Test performance under load

**Test Organization**:
```
__tests__/
├── unit/             # Unit tests
├── integration/        # Integration tests
├── e2e/               # End-to-end tests
└── load/              # Load tests
```

## Migration Strategy

**Database Migrations**: Located in [`supabase/migrations/`](../supabase/migrations/)

**Naming Convention**: `YYYYMMDDHHMMSS_description.sql`

**Recent Migrations**:
- `20260203000000_idempotency_keys.sql` - Idempotency keys table
- `20260203000001_atomic_order_creation.sql` - Atomic order creation
- `20260203000002_atomic_payment_processing.sql` - Atomic payment processing
- `20260203000003_atomic_inventory_deduction.sql` - Atomic inventory deduction

**Migration Best Practices**:
1. Always use `IF NOT EXISTS` for table creation
2. Use `CREATE OR REPLACE FUNCTION` for functions
3. Include comments explaining purpose
4. Grant permissions explicitly
5. Test migrations locally before deploying

## References

- [Deployment Requirements](./DEPLOYMENT-REQUIREMENTS.md)
- [Production Runbook](./PRODUCTION-RUNBOOK.md)
- [RLS Policy Requirements](./RLS-POLICY-REQUIREMENTS.md)
- [Onboarding Guide](./ONBOARDING.md)
- [RBAC Flow](./RBAC-FLOW.md)
