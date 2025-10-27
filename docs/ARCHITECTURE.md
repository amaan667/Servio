# Architecture Documentation

## Overview

Servio is a modern restaurant management SaaS platform built with Next.js 14, TypeScript, and Supabase. This document outlines the system architecture, design patterns, and key technical decisions.

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript (strict mode enabled)
- **Database**: Supabase (PostgreSQL with Row-Level Security)
- **Authentication**: Supabase Auth
- **UI Framework**: Tailwind CSS + Shadcn UI (Radix UI)
- **State Management**: React Query (TanStack Query)
- **Payments**: Stripe
- **Monitoring**: Sentry
- **Testing**: Vitest + Playwright
- **Deployment**: Railway

## Architecture Patterns

### 1. Server Components First

Next.js App Router encourages server components by default. We use server components for:
- Data fetching with direct database access
- SEO-critical pages
- Pages that don't require interactivity

Client components are used only when needed for:
- User interactions (forms, buttons)
- Real-time updates
- Browser APIs

### 2. API Route Structure

All API routes follow this pattern:
```
app/api/[feature]/route.ts
```

Routes are organized by feature domain:
- `/api/orders/*` - Order management
- `/api/menu/*` - Menu management
- `/api/staff/*` - Staff management
- `/api/inventory/*` - Inventory tracking
- `/api/payments/*` - Payment processing
- `/api/stripe/*` - Stripe integration
- `/api/ai-assistant/*` - AI features

### 3. Authentication & Authorization

**Pattern**: Server-side authentication with Supabase

- Middleware handles route protection
- Server components use `getAuthenticatedUser()` 
- Client components use `useAuth()` hook
- Row-Level Security (RLS) enforces data access at DB level

**Authorization Levels**:
- `owner` - Full access to venue
- `manager` - Operational access
- `server` - Limited access (orders, tables)

### 4. Error Handling

**Structured Error Handling**:
- API routes use `withErrorHandling` wrapper
- Errors logged with context to Sentry
- User-friendly error messages
- Error boundaries for UI resilience

**Error Types**:
- `ValidationError` - 400 (Zod validation)
- `UnauthorizedError` - 401
- `ForbiddenError` - 403
- `NotFoundError` - 404
- `RateLimitError` - 429
- `ServerError` - 500

### 5. Data Fetching

**Server Components**:
- Direct Supabase queries in server components
- No API layer needed for internal data

**Client Components**:
- React Query for data fetching
- Optimistic updates
- Cache invalidation
- Real-time subscriptions with Supabase

### 6. Real-time Features

Using Supabase Realtime:
- Live order updates
- Table status changes
- Staff activity
- KDS ticket updates

### 7. Caching Strategy

**Multi-layer Caching**:
1. **React Query** - Client-side cache (5min default)
2. **Redis** - Server-side cache (1min for dynamic data)
3. **Next.js** - Static page cache (ISR)

**Cache Invalidation**:
- On write operations
- Time-based expiration
- Manual invalidation via API

## Directory Structure

```
servio/
├── app/                    # Next.js App Router
│   ├── api/                # API routes
│   ├── dashboard/          # Dashboard pages
│   │   └── [venueId]/      # Venue-specific routes
│   ├── auth/               # Auth pages
│   └── (auth)/             # Auth layout group
├── components/             # React components
│   ├── ui/                 # Shadcn UI components
│   └── error-boundaries/   # Error handling
├── lib/                    # Utilities & services
│   ├── supabase/           # Database client
│   ├── api/                # API helpers
│   ├── auth/               # Auth utilities
│   ├── monitoring/         # Observability
│   └── validation/        # Zod schemas
├── hooks/                  # Custom React hooks
├── types/                  # TypeScript types
└── __tests__/              # Test files
```

## Key Design Decisions

### 1. Type Safety

- TypeScript strict mode enabled
- No `any` types allowed
- Zod for runtime validation
- Shared types between client/server

### 2. Security

- Row-Level Security (RLS) on all tables
- API route authentication middleware
- CSRF protection via SameSite cookies
- Rate limiting on API endpoints
- Input validation on all endpoints

### 3. Performance

- Server-side rendering for SEO
- Code splitting by route
- Image optimization with Next.js
- Database query optimization
- Redis caching for hot paths

### 4. Scalability

- Stateless API design
- Horizontal scaling ready
- Database connection pooling
- Queue system for background jobs (BullMQ)

## Database Schema

Key tables:
- `venues` - Restaurant locations
- `users` - User accounts
- `staff` - Staff members with roles
- `orders` - Customer orders
- `menu_items` - Menu catalog
- `tables` - Table management
- `inventory` - Stock tracking
- `kds_tickets` - Kitchen display system

All tables use RLS policies for multi-tenancy.

## API Design

### Response Format

```typescript
{
  ok: boolean;
  data?: T;
  error?: string;
  message?: string;
}
```

### Standard Status Codes

- `200` - Success
- `400` - Bad Request (validation)
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `429` - Rate Limited
- `500` - Server Error

## Monitoring & Observability

- **Sentry** - Error tracking with context
- **Structured Logging** - JSON logs for parsing
- **Performance Monitoring** - API response times
- **Custom Metrics** - Business KPIs

## Testing Strategy

- **Unit Tests** - Vitest for utilities
- **Integration Tests** - API route testing
- **E2E Tests** - Playwright for critical flows
- **Coverage Threshold** - 70% minimum

## Deployment

- **Platform**: Railway
- **CI/CD**: GitHub Actions (optional)
- **Environment**: Production + Staging
- **Database**: Supabase (managed PostgreSQL)
- **CDN**: Vercel Edge Network (optional)

## Future Improvements

1. **API Versioning** - Add `/api/v1/*` structure
2. **GraphQL** - Consider for complex queries
3. **Microservices** - Split by domain (orders, menu, etc.)
4. **Event Sourcing** - For audit trails
5. **WebSocket** - Real-time communication

