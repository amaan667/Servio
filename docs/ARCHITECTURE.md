# Servio Architecture

This document provides an overview of Servio's technical architecture for developers and maintainers.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT LAYER                                    │
├──────────────────────────────────┬──────────────────────────────────────────┤
│     Customer App (Mobile/Web)    │        Dashboard (Admin/Staff)           │
│  - QR Code Scanning              │  - Menu Management                       │
│  - Menu Viewing                  │  - Order Management                      │
│  - Order Placement               │  - Analytics                             │
│  - Payment                       │  - Staff Management                      │
└──────────────────────────────────┴──────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              API LAYER (Next.js)                             │
├──────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                     Unified API Handler                              │    │
│  │  - Authentication & Authorization                                    │    │
│  │  - Rate Limiting                                                     │    │
│  │  - Input Validation (Zod)                                           │    │
│  │  - Error Handling                                                    │    │
│  │  - Performance Monitoring                                            │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                    │                                         │
│  ┌─────────────────────────────────┴───────────────────────────────────┐    │
│  │                     API Routes (209 endpoints)                       │    │
│  │  /api/menu/*     - Menu operations                                   │    │
│  │  /api/orders/*   - Order management                                  │    │
│  │  /api/tables/*   - Table management                                  │    │
│  │  /api/staff/*    - Staff management                                  │    │
│  │  /api/payments/* - Payment processing                                │    │
│  │  /api/kds/*      - Kitchen Display System                           │    │
│  │  /api/ai/*       - AI Assistant                                      │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           SERVICE LAYER                                      │
├──────────────────────────────────────────────────────────────────────────────┤
│  ┌───────────────┐ ┌───────────────┐ ┌───────────────┐ ┌───────────────┐    │
│  │ MenuService   │ │ OrderService  │ │ TableService  │ │ StaffService  │    │
│  └───────────────┘ └───────────────┘ └───────────────┘ └───────────────┘    │
│  ┌───────────────┐ ┌───────────────┐ ┌───────────────┐ ┌───────────────┐    │
│  │ StripeService │ │ KDSService    │ │InventoryServ.│ │ Reservation   │    │
│  └───────────────┘ └───────────────┘ └───────────────┘ └───────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         DATA & CACHING LAYER                                 │
├────────────────────────────────────┬────────────────────────────────────────┤
│          Supabase                  │              Redis                      │
│  - PostgreSQL Database             │  - Rate Limiting                        │
│  - Row-Level Security              │  - Session Caching                      │
│  - Real-time Subscriptions         │  - Menu Caching                         │
│  - Auth (Supabase Auth)            │  - Performance Caching                  │
│  - File Storage                    │                                         │
└────────────────────────────────────┴────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        EXTERNAL SERVICES                                     │
├──────────────────┬──────────────────┬──────────────────┬────────────────────┤
│     Stripe       │     Sentry       │     OpenAI       │     Resend         │
│  - Payments      │  - Error Track   │  - AI Assistant  │  - Email           │
│  - Subscriptions │  - Performance   │  - Menu Parser   │  - Receipts        │
└──────────────────┴──────────────────┴──────────────────┴────────────────────┘
```

## Directory Structure

```
servio/
├── app/                    # Next.js App Router
│   ├── api/               # API routes (209 endpoints)
│   │   ├── menu/          # Menu CRUD, uploads, categories
│   │   ├── orders/        # Order management
│   │   ├── tables/        # Table management
│   │   ├── staff/         # Staff management
│   │   ├── payments/      # Stripe webhooks & processing
│   │   ├── kds/           # Kitchen Display System
│   │   └── ai/            # AI assistant
│   ├── dashboard/         # Admin dashboard pages
│   │   └── [venueId]/     # Venue-specific routes
│   ├── order/             # Customer ordering flow
│   └── payment/           # Payment pages
│
├── components/            # Reusable UI components (182)
│   ├── ui/               # shadcn/ui components
│   ├── menu/             # Menu-related components
│   ├── orders/           # Order components
│   └── dashboard/        # Dashboard components
│
├── lib/                   # Core business logic
│   ├── services/         # Domain services (business logic)
│   ├── api/              # API utilities
│   │   ├── unified-handler.ts    # Central API handler
│   │   ├── standard-response.ts  # Response formatting
│   │   └── validation-schemas.ts # Zod schemas
│   ├── auth/             # Authentication utilities
│   ├── cache/            # Caching layer (Redis + memory)
│   ├── monitoring/       # APM, logging, error tracking
│   └── ai/               # AI assistant logic
│
├── hooks/                 # Custom React hooks
├── types/                 # TypeScript type definitions
└── __tests__/            # Test files
    ├── api/              # API route tests
    ├── integration/      # Integration tests
    ├── e2e/              # Playwright E2E tests
    └── lib/              # Service/utility tests
```

## Key Patterns

### 1. Unified API Handler

All API routes use `createUnifiedHandler` for consistency:

```typescript
export const GET = createUnifiedHandler(
  async (req, context) => {
    // Handler logic
    return data;
  },
  {
    requireAuth: true,
    requireVenueAccess: true,
    rateLimit: RATE_LIMITS.GENERAL,
    schema: requestSchema, // Zod validation
  }
);
```

Features:
- Automatic authentication/authorization
- Rate limiting
- Input validation
- Error handling
- Performance tracking

### 2. Service Layer

Business logic is encapsulated in services extending `BaseService`:

```typescript
class MenuService extends BaseService {
  async getMenuItems(venueId: string) {
    return this.withCache(
      cacheKey,
      async () => {
        // Database query
      },
      TTL_SECONDS
    );
  }
}
```

### 3. Caching Strategy

Three-tier caching:

1. **Edge Cache** (CDN) - Public endpoints with Cache-Control headers
2. **Redis Cache** - Shared cache across instances
3. **Memory Cache** - Fallback when Redis unavailable

### 4. Authentication Flow

```
Request → Middleware → Unified Handler → Route Logic
            │
            ├── Check session cookie
            ├── Verify Supabase auth
            ├── Validate venue access
            └── Check role permissions
```

### 5. Error Handling

Centralized error handling with Sentry integration:

```typescript
// Errors automatically captured and formatted
apiErrors.badRequest("Missing field");
apiErrors.unauthorized("Invalid token");
apiErrors.internal("Database error", { details });
```

## Database Schema (Supabase)

### Core Tables

- `venues` - Restaurant/venue records
- `menu_items` - Menu item catalog
- `menu_uploads` - PDF menu images
- `orders` - Customer orders
- `order_items` - Items in each order
- `tables` - Table configuration
- `table_sessions` - Active table sessions
- `staff_members` - Staff access records
- `payments` - Payment records

### Security

- Row-Level Security (RLS) on all tables
- Admin client (`createAdminClient`) for bypassing RLS when needed
- Service role key never exposed to client

## Performance Considerations

### API Performance

- 8-second server timeout on public endpoints
- Edge caching for menu data (60s client, 120s CDN)
- Parallelized database queries where possible
- Connection pooling via Supabase

### Frontend Performance

- Next.js automatic code splitting
- Optimized package imports (lucide-react, recharts, etc.)
- Image optimization with WebP/AVIF
- Aggressive caching in sessionStorage for offline resilience

### Monitoring

- Sentry for error tracking
- APM for transaction tracing
- Structured logging for debugging
- Performance metrics collection

## Security Measures

1. **Headers**: HSTS, CSP, X-Frame-Options, etc.
2. **Rate Limiting**: Redis-backed with configurable limits
3. **Input Validation**: Zod schemas on all inputs
4. **CSRF Protection**: Token-based for mutations
5. **XSS Protection**: DOMPurify sanitization
6. **Auth**: Supabase Auth with RLS

## Deployment

### Railway (Production)

- Auto-deploy on push to `main`
- Environment variables in Railway dashboard
- PostgreSQL via Supabase (external)

### CI/CD Pipeline

1. Lint & Type Check
2. Unit Tests
3. E2E Tests (Playwright)
4. Security Scan
5. Build
6. Deploy

## Testing Strategy

- **Unit Tests**: Services, utilities, components
- **Integration Tests**: API endpoints, database operations
- **E2E Tests**: Critical user flows (Playwright)

Coverage thresholds: 70-80%

## Future Considerations

1. Enable `noUncheckedIndexedAccess` (338 fixes needed)
2. Add more E2E test coverage
3. Consider edge functions for lower latency
4. Add WebSocket support for real-time updates
