# Servio Architecture Documentation

## Overview

Servio is a modern, full-stack SaaS restaurant management platform built with cutting-edge technologies for scalability, performance, and developer experience.

## Technology Stack

### Frontend
- **Next.js 15** - React framework with App Router
- **TypeScript** - Type-safe development
- **Tailwind CSS** - Utility-first CSS framework
- **Shadcn/ui** - High-quality React components
- **React Query** - Server state management
- **Zustand** - Client state management

### Backend
- **Next.js API Routes** - Serverless API endpoints
- **Supabase** - PostgreSQL database, Auth, Realtime
- **OpenAI** - AI-powered assistant
- **Stripe** - Payment processing
- **Redis** - Caching and session storage (optional)

### Infrastructure
- **Railway** - Production deployment
- **Vercel** - Alternative deployment option
- **Sentry** - Error tracking and monitoring
- **GitHub Actions** - CI/CD pipeline

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                          Client Layer                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   Next.js    │  │   React      │  │  Tailwind   │          │
│  │  App Router  │  │  Components  │  │    CSS      │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└─────────────────────────────────────────────────────────────────┘
                               │
┌─────────────────────────────────────────────────────────────────┐
│                        Middleware Layer                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │     Auth     │  │  Rate Limit  │  │   Logging    │          │
│  │  Middleware  │  │  Protection  │  │   & Errors   │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└─────────────────────────────────────────────────────────────────┘
                               │
┌─────────────────────────────────────────────────────────────────┐
│                       API Routes Layer                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   Orders     │  │     Menu     │  │   Tables     │          │
│  │   /api/...   │  │   /api/...   │  │   /api/...   │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└─────────────────────────────────────────────────────────────────┘
                               │
┌─────────────────────────────────────────────────────────────────┐
│                      Business Logic Layer                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ Repositories │  │   Services   │  │  Validation  │          │
│  │   (DB ORM)   │  │  (Business)  │  │    (Zod)     │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└─────────────────────────────────────────────────────────────────┘
                               │
┌─────────────────────────────────────────────────────────────────┐
│                       Data & Cache Layer                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │  Supabase    │  │    Redis     │  │  External    │          │
│  │  PostgreSQL  │  │    Cache     │  │     APIs     │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└─────────────────────────────────────────────────────────────────┘
```

## Core Features & Modules

### 1. Order Management
**Path:** `app/api/orders/`, `lib/repositories/order-repository.ts`

- Real-time order tracking
- Status workflows (pending → confirmed → preparing → ready → served)
- KDS (Kitchen Display System) integration
- Payment processing integration
- Order history and analytics

**Key Components:**
- OrderRepository - Database operations
- OrderCard - UI component
- LiveOrders - Real-time updates

### 2. Menu Management
**Path:** `app/dashboard/[venueId]/menu-management/`

- Menu item CRUD operations
- Category management
- Image uploads
- Availability toggling
- Price management
- Allergen and dietary information

### 3. Table Management
**Path:** `app/dashboard/[venueId]/tables/`

- Table layout configuration
- Occupancy tracking
- Reservation system
- QR code generation
- Table sessions

### 4. Inventory Management
**Path:** `app/dashboard/[venueId]/inventory/`

- Ingredient tracking
- Stock levels
- Movement history
- Low stock alerts
- CSV import/export

### 5. AI Assistant
**Path:** `app/api/ai-assistant/`, `components/ai/`

- Natural language restaurant management
- Context-aware suggestions
- Automated task execution
- Conversation history
- Undo/redo capabilities

### 6. Analytics & Reporting
**Path:** `app/dashboard/[venueId]/analytics/`

- Revenue metrics
- Order trends
- Popular items
- Performance KPIs
- Custom date ranges

### 7. Staff Management
**Path:** `app/dashboard/[venueId]/staff/`

- Role-based access control (Owner, Manager, Staff)
- Email invitations
- Shift scheduling
- Permission management

## Data Model

### Core Entities

```typescript
// Venue
venues {
  venue_id: UUID (PK)
  name: string
  owner_user_id: UUID (FK → auth.users)
  organization_id: UUID (FK → organizations)
  settings: JSONB
  created_at: timestamp
}

// Order
orders {
  id: UUID (PK)
  venue_id: UUID (FK → venues)
  table_id: UUID? (FK → tables)
  items: JSONB
  status: enum
  payment_status: enum
  total_amount: decimal
  created_at: timestamp
}

// Menu Item
menu_items {
  id: UUID (PK)
  venue_id: UUID (FK → venues)
  name: string
  price: decimal
  category: string
  is_available: boolean
}

// Table
tables {
  id: UUID (PK)
  venue_id: UUID (FK → venues)
  table_number: string
  capacity: integer
  status: enum
}
```

## Security Architecture

### Authentication Flow
1. User signs in via Supabase Auth (email/OAuth)
2. Session token stored in HTTP-only cookie
3. Middleware validates session on each request
4. Expired tokens trigger automatic refresh

### Authorization Model
- **Row Level Security (RLS)** - Database-level access control
- **Middleware Guards** - Route-level protection
- **Role-Based Access Control** - Feature-level permissions

### Security Layers
1. **Network:** HTTPS-only, CORS configuration
2. **Application:** Rate limiting, input validation (Zod)
3. **Database:** RLS policies, prepared statements
4. **Session:** Secure cookies, CSRF protection

## Performance Optimizations

### Caching Strategy
- **Redis:** Session storage, frequently accessed data
- **In-Memory:** Short-lived cache for hot paths
- **CDN:** Static assets (images, CSS, JS)
- **Database:** Query result caching

### Database Optimizations
- Indexes on foreign keys and frequently queried columns
- Connection pooling via Supabase
- Batch operations for bulk updates
- Pagination for large datasets

### Frontend Optimizations
- Server-side rendering (SSR) for SEO
- Dynamic imports for code splitting
- Image optimization (Next.js Image)
- Web Vitals monitoring

## Monitoring & Observability

### Error Tracking
- **Sentry:** Application errors, performance issues
- **Custom Logger:** Structured logging with context
- **Breadcrumbs:** User action tracking

### Performance Monitoring
- Web Vitals (LCP, FID, CLS)
- API response times
- Database query performance
- Resource loading metrics

### Business Metrics
- Order volume and revenue
- User engagement
- Feature adoption
- Error rates by endpoint

## Deployment Architecture

### Production Environment
```
┌──────────────┐
│   Railway    │  ← Production App
│   Platform   │  ← Auto-deploy from main
└──────────────┘
      │
┌──────────────┐
│   Supabase   │  ← Database & Auth
│   Cloud      │  ← Managed PostgreSQL
└──────────────┘
      │
┌──────────────┐
│   External   │  ← Third-party services
│   Services   │  ← Stripe, OpenAI, etc.
└──────────────┘
```

### CI/CD Pipeline
1. **Push to GitHub** → Trigger Actions
2. **Lint & Type Check** → Quality gates
3. **Run Tests** → Unit + Integration
4. **Build** → Create production bundle
5. **Deploy** → Railway auto-deploy

### Environment Variables
- `DATABASE_URL` - Supabase connection
- `NEXT_PUBLIC_SUPABASE_URL` - Public Supabase URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Public API key
- `SUPABASE_SERVICE_ROLE_KEY` - Admin access
- `OPENAI_API_KEY` - AI features
- `STRIPE_SECRET_KEY` - Payments
- `REDIS_URL` - Cache (optional)
- `SENTRY_DSN` - Error tracking

## Development Workflow

### Local Setup
```bash
# Clone repository
git clone https://github.com/your-org/servio.git

# Install dependencies
pnpm install

# Set up environment
cp .env.example .env.local

# Run development server
pnpm dev
```

### Code Quality
- **TypeScript:** Strict mode enabled
- **ESLint:** Code linting
- **Prettier:** Code formatting
- **Husky:** Pre-commit hooks
- **Lint-staged:** Auto-fix on commit

### Testing Strategy
- **Unit Tests:** Vitest for business logic
- **Integration Tests:** API route testing
- **E2E Tests:** Playwright for user flows
- **Coverage Target:** 70%+

## API Design Principles

### RESTful Conventions
- `GET /api/orders` - List orders
- `POST /api/orders` - Create order
- `GET /api/orders/:id` - Get single order
- `PATCH /api/orders/:id` - Update order
- `DELETE /api/orders/:id` - Delete order

### Response Format
```typescript
// Success
{
  data: T,
  meta?: {
    pagination?, 
    timestamps?
  }
}

// Error
{
  error: string,
  message: string,
  details?: ValidationError[]
}
```

### Rate Limiting
- **Public:** 30 req/min
- **Standard:** 60 req/min
- **Relaxed:** 120 req/min
- **Strict:** 10 req/min (sensitive endpoints)

## Scaling Considerations

### Horizontal Scaling
- Stateless API design
- Session store in Redis
- Database connection pooling
- Load balancer ready

### Vertical Scaling
- Optimized queries
- Caching layers
- Background job processing
- Database read replicas

### Future Enhancements
- GraphQL API layer
- WebSocket for real-time features
- Microservices for complex modules
- Event-driven architecture

## Troubleshooting Guide

### Common Issues

**Issue:** Refresh token errors
**Solution:** Check auth cookie configuration, ensure `autoRefreshToken: false` on server

**Issue:** Slow query performance
**Solution:** Add database indexes, implement caching, paginate results

**Issue:** Memory leaks
**Solution:** Close database connections, clear intervals/timeouts, use weak references

## Additional Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [API Documentation](/api-docs)
- [Contributing Guide](./CONTRIBUTING.md)

