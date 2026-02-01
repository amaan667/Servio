# Servio Architecture Documentation

## Overview

Servio is a modern restaurant management platform built with Next.js 15, React 19, TypeScript, and Supabase. The application follows a layered architecture with clear separation of concerns.

## Technology Stack

### Frontend
- **Framework**: Next.js 15 (App Router)
- **UI Library**: React 19
- **Styling**: Tailwind CSS + Radix UI + shadcn/ui
- **State Management**: React Query (@tanstack/react-query)
- **Forms**: React Hook Form + Zod validation

### Backend
- **Runtime**: Node.js 20+
- **API**: Next.js API Routes (App Router)
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **Caching**: Redis (with in-memory fallback)
- **Job Queue**: BullMQ

### Infrastructure
- **Deployment**: Railway / Vercel
- **Monitoring**: Sentry
- **Error Tracking**: Enhanced error tracking with context
- **Performance**: APM integration (Datadog/New Relic optional)

## Architecture Layers

### 1. Presentation Layer (`app/`, `components/`)

**Purpose**: Handle user interface and user interactions

**Key Components**:
- **Pages**: Next.js App Router pages in `app/`
- **Components**: Reusable UI components in `components/`
- **Hooks**: Custom React hooks in `hooks/`

**Patterns**:
- Server Components for data fetching
- Client Components for interactivity
- Shared components for consistency

### 2. API Layer (`app/api/`, `lib/api/`)

**Purpose**: Handle HTTP requests and responses

**Key Components**:
- **Unified Handler**: [`createUnifiedHandler`](../lib/api/unified-handler.ts) - Single source of truth for all API routes
- **Standard Response**: [`ApiResponse`](../lib/api/standard-response.ts) - Consistent response format
- **Middleware**: Authentication, rate limiting, validation

**Features**:
- Authentication & authorization
- Rate limiting (Redis + memory fallback)
- Request validation (Zod schemas)
- Error handling
- Idempotency support
- Performance tracking
- APM monitoring

### 3. Service Layer (`lib/services/`)

**Purpose**: Business logic and domain operations

**Key Services**:
- [`OrderService`](../lib/services/OrderService.ts) - Order management
- [`MenuService`](../lib/services/MenuService.ts) - Menu management
- [`TableService`](../lib/services/TableService.ts) - Table management
- [`InventoryService`](../lib/services/InventoryService.ts) - Inventory management
- [`StaffService`](../lib/services/StaffService.ts) - Staff management
- [`StripeService`](../lib/services/StripeService.ts) - Payment processing
- [`ReservationService`](../lib/services/ReservationService.ts) - Reservation management
- [`KDSService`](../lib/services/KDSService.ts) - Kitchen Display System

**Base Class**: [`BaseService`](../lib/services/BaseService.ts)
- Caching abstraction
- Cache invalidation
- Error handling

### 4. Repository Layer (`lib/repositories/`)

**Purpose**: Database access abstraction

**Key Repositories**:
- [`BaseRepository`](../lib/repositories/base-repository.ts) - Generic CRUD operations
- [`OrderRepository`](../lib/repositories/order-repository.ts) - Order-specific queries
- [`MenuRepository`](../lib/repositories/menu-repository.ts) - Menu-specific queries
- [`VenueRepository`](../lib/repositories/venue-repository.ts) - Venue-specific queries

**Features**:
- Generic CRUD operations
- Pagination
- Query building
- Error tracking

### 5. Data Access Layer (`lib/supabase/`, `lib/db/`)

**Purpose**: Direct database interactions

**Key Components**:
- [`createSupabaseClient`](../lib/supabase/index.ts) - Supabase client factory
- Database functions and RPC calls
- Row-Level Security (RLS) policies

### 6. Cross-Cutting Concerns (`lib/`)

**Purpose**: Shared utilities and infrastructure

**Key Modules**:
- **Authentication**: [`lib/auth/`](../lib/auth/) - Auth utilities and middleware
- **Authorization**: [`lib/access/`](../lib/access/) - Access control and permissions
- **Caching**: [`lib/cache/`](../lib/cache/) - Unified caching interface
- **Rate Limiting**: [`lib/rate-limit.ts`](../lib/rate-limit.ts) - Rate limiting utilities
- **Security**: [`lib/security.ts`](../lib/security.ts) - Security utilities
- **Monitoring**: [`lib/monitoring/`](../lib/monitoring/) - Error tracking and performance
- **Validation**: [`lib/validation/`](../lib/validation/) - Input validation
- **AI**: [`lib/ai/`](../lib/ai/) - AI-powered features

## Data Flow

### Request Flow

```
Client Request
    ↓
Middleware (auth, rate limiting)
    ↓
API Route Handler
    ↓
Unified Handler (validation, auth, rate limiting)
    ↓
Service Layer (business logic)
    ↓
Repository Layer (data access)
    ↓
Database (Supabase)
    ↓
Response (standardized format)
```

### Authentication Flow

```
Client
    ↓
Supabase Auth (login/signup)
    ↓
Session Token (JWT)
    ↓
Middleware (validate token, refresh if needed)
    ↓
Request Headers (x-user-id, x-user-email, x-user-tier, x-user-role)
    ↓
API Handler (check permissions)
```

### Caching Strategy

```
Request
    ↓
Check Cache (Redis → Memory)
    ↓
Cache Hit? → Return cached data
    ↓
Cache Miss? → Query Database
    ↓
Store in Cache (with TTL)
    ↓
Return Data
```

## Security Architecture

### Authentication
- Supabase Auth with JWT tokens
- Session refresh in middleware
- Token validation on every request

### Authorization
- Role-Based Access Control (RBAC)
- Tier-based feature restrictions
- Row-Level Security (RLS) in database
- Venue-level access control

### Rate Limiting
- Per-IP rate limiting
- Per-user rate limiting (when authenticated)
- Redis-backed with in-memory fallback
- Configurable limits per endpoint

### Input Validation
- Zod schemas for all API inputs
- XSS sanitization with DOMPurify
- SQL injection prevention (parameterized queries)

### Security Headers
- HSTS
- X-Frame-Options
- X-Content-Type-Options
- Content Security Policy

## Multi-Tenancy

### Tenant Isolation
- Each venue is a separate tenant
- Row-Level Security (RLS) policies enforce isolation
- Venue ID required for all operations

### Access Control
- Owner: Full access to venue
- Manager: Full access except billing
- Staff: Limited access (orders, tables)
- Customer: Public access only

### Tier System
- **Starter**: Basic features
- **Pro**: Advanced features
- **Enterprise**: Full features + priority support

## Performance Optimization

### Caching
- Redis for distributed caching
- In-memory fallback
- Cache invalidation on data changes
- TTL-based expiration

### Database Optimization
- Indexed columns
- Query optimization
- Connection pooling
- Read replicas (future)

### API Optimization
- Response compression
- CDN for static assets
- Edge caching for public endpoints
- Lazy loading

### Frontend Optimization
- Code splitting
- Image optimization
- Lazy loading
- Server components

## Error Handling

### Error Tracking
- Sentry integration
- Enhanced error context
- User and venue context
- Performance tracking

### Error Boundaries
- React error boundaries
- Graceful degradation
- User-friendly error messages

### Logging
- Structured logging
- Log levels (debug, info, warn, error)
- Request/response logging
- Error aggregation

## Monitoring & Observability

### Metrics
- API response times
- Database query times
- Error rates
- Cache hit rates

### Tracing
- Distributed tracing
- Request ID tracking
- Performance profiling

### Alerts
- Error rate thresholds
- Performance degradation
- Service availability

## Deployment Architecture

### Environments
- **Development**: Local development
- **Staging**: Pre-production testing
- **Production**: Live application

### Deployment Pipeline
- Git push to main
- Automated tests
- Build process
- Deploy to Railway/Vercel
- Health checks

### Infrastructure
- Railway (recommended)
- Vercel (alternative)
- Supabase (database)
- Redis (caching, optional)

## Scalability Considerations

### Horizontal Scaling
- Stateless API servers
- Distributed caching (Redis)
- Load balancing
- Auto-scaling

### Database Scaling
- Read replicas
- Connection pooling
- Query optimization
- Indexing strategy

### Caching Strategy
- Multi-level caching
- Cache warming
- Invalidation strategies
- CDN integration

## Development Workflow

### Local Development
```bash
pnpm dev          # Start development server
pnpm typecheck    # Type checking
pnpm lint         # Linting
pnpm test         # Run tests
```

### Code Quality
- ESLint for code quality
- Prettier for formatting
- Husky for pre-commit hooks
- Type checking with TypeScript

### Testing
- Unit tests (Vitest)
- Integration tests (Vitest)
- E2E tests (Playwright)
- Test coverage reporting

## Key Design Patterns

### Repository Pattern
Abstract database access behind repository interfaces for testability and flexibility.

### Service Layer
Business logic encapsulated in service classes, reusable across different contexts.

### Factory Pattern
Supabase client factory for creating configured clients.

### Strategy Pattern
Different caching strategies (Redis vs in-memory) based on availability.

### Observer Pattern
Real-time subscriptions for live updates.

## Future Enhancements

### Planned Features
- GraphQL API
- WebSocket for real-time updates
- Advanced analytics
- Machine learning for demand prediction
- Mobile apps (React Native)

### Technical Improvements
- Microservices architecture
- Event-driven architecture
- Advanced caching strategies
- Database sharding
- Global CDN

## Contributing

When contributing to Servio:

1. Follow the layered architecture
2. Use the unified API handler for new routes
3. Add tests for new features
4. Update documentation
5. Follow code style guidelines
6. Ensure type safety

## Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [React Query Documentation](https://tanstack.com/query/latest)
- [Radix UI Documentation](https://www.radix-ui.com/)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
