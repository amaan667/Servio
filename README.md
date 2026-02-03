# Servio

A modern restaurant management platform for seamless ordering, payments, and operations.

## Features

- **QR Code Ordering** - Customers scan QR codes to view menus and place orders
- **Menu Management** - Upload PDFs, manage items, categories, and pricing
- **Order Management** - Real-time order tracking with KDS (Kitchen Display System)
- **Table Management** - Manage tables, reservations, and seating
- **Payment Processing** - Stripe integration for secure payments
- **Staff Management** - Role-based access control for owners, managers, and staff
- **Analytics Dashboard** - Revenue, orders, and performance insights
- **AI Assistant** - Menu optimization and operational suggestions

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript (strict mode)
- **UI**: React 19, Tailwind CSS, Radix UI, shadcn/ui
- **Database**: Supabase (PostgreSQL)
- **Payments**: Stripe
- **Caching**: Redis (optional, with memory fallback)
- **Testing**: Vitest, Playwright
- **Monitoring**: Sentry

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 9+
- Supabase account
- Stripe account (for payments)

### Installation

```bash
# Clone the repository
git clone https://github.com/amaan667/Servio.git
cd Servio

# Install dependencies
pnpm install

# Copy environment variables
cp .env.example .env.local

# Configure your environment variables (see .env.example for details)
# Required: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, 
#           SUPABASE_SERVICE_ROLE_KEY, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET

# Run development server
pnpm dev
```

### Environment Setup

1. **Supabase**: Create a project at [supabase.com](https://supabase.com)
   - Copy your project URL and anon key to `.env.local`
   - Copy the service role key (keep this secret!)

2. **Stripe**: Get API keys from [dashboard.stripe.com](https://dashboard.stripe.com/apikeys)
   - Use test keys for development (`sk_test_*`, `pk_test_*`)
   - Set up webhook endpoint: `your-url/api/webhooks/stripe`

3. **Redis** (optional): For production rate limiting and caching
   - Without Redis, the app uses in-memory fallbacks

## Development

```bash
# Start development server
pnpm dev

# Run type checking
pnpm typecheck

# Run linting
pnpm lint

# Run tests
pnpm test

# Run E2E tests
pnpm test:e2e

# Run all validations
pnpm validate
```

## Project Structure

```
├── app/                    # Next.js App Router pages and API routes
│   ├── api/               # API endpoints (209 routes)
│   ├── dashboard/         # Admin dashboard pages
│   ├── order/             # Customer ordering flow
│   └── payment/           # Payment processing
├── components/            # Reusable React components (182 components)
├── hooks/                 # Custom React hooks
├── lib/                   # Core business logic
│   ├── services/         # Domain services (Menu, Order, Table, etc.)
│   ├── cache/            # Caching layer (Redis + memory)
│   ├── api/              # API utilities and handlers
│   └── auth/             # Authentication utilities
├── types/                 # TypeScript type definitions
└── __tests__/            # Test files (494 test files)
```

## API Documentation

API documentation is available at `/api-docs/swagger` when running the development server.

See [docs/API_SPEC.md](docs/API_SPEC.md) for detailed API specifications.

## Testing

```bash
# Unit tests
pnpm test

# Unit tests with coverage
pnpm test:coverage

# E2E tests (Playwright)
pnpm test:e2e

# Integration tests
pnpm test:integration

# All tests
pnpm test:all
```

## Deployment

### Railway (Recommended)

1. Connect your GitHub repository to Railway
2. Set environment variables in Railway dashboard
3. Deploy automatically on push to `main`

### Vercel

1. Import project to Vercel
2. Set environment variables
3. Deploy

### Environment Variables

See [.env.example](.env.example) for all available configuration options.

**Required for production:**
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`

## Contributing

1. Create a feature branch: `git checkout -b feature/my-feature`
2. Make your changes
3. Run validations: `pnpm validate`
4. Commit with descriptive message
5. Push and create a Pull Request

## Security

- All API endpoints use rate limiting
- Input validation with Zod schemas
- CSRF protection on mutations
- XSS sanitization with DOMPurify
- Row-Level Security (RLS) in Supabase
- Security headers configured (HSTS, X-Frame-Options, etc.)

## License

Private - All rights reserved.

---

## Operations Runbook

### Service Level Indicators (SLIs) & Objectives (SLOs)

| Service | Indicator | Target | Critical Threshold |
|---------|-----------|--------|-------------------|
| API Latency | P95 response time | < 500ms | < 1000ms |
| API Availability | Success rate | > 99.9% | > 99.5% |
| Database | Query latency | < 100ms | < 500ms |
| Cache Hit Rate | Redis/memory hits | > 80% | > 60% |
| Error Rate | 5xx errors | < 0.1% | < 1% |
| Uptime | System availability | > 99.95% | > 99.9% |

### Health Checks

The platform provides the following health check endpoints:

- **`/api/health`** - Basic health check (returns 200 if application is running)
- **`/api/ready`** - Readiness check (returns 200 if application can serve traffic)
- **`/api/ping`** - Liveness probe (returns 200 if process is alive)

```bash
# Check health
curl https://servio-production.up.railway.app/api/health

# Check readiness  
curl https://servio-production.up.railway.app/api/ready

# Check ping
curl https://servio-production.up.railway.app/api/ping
```

### Monitoring Dashboard

Access the real-time monitoring dashboard at `/dashboard/:venueId/monitoring` to view:
- API performance metrics (requests, response times, success/failure rates)
- Error tracking with recent error messages
- System health (uptime, memory usage, active connections)

### Deployment Rollback

#### Automated Rollback via GitHub Actions

1. Go to Actions → Rollback Deployment workflow
2. Click "Run workflow"
3. Select environment (staging/production)
4. Enter service name and reason for rollback
5. Click "Run"

#### Manual Railway Rollback

```bash
# Install Railway CLI
npm install -g @railway/cli

# Link to project
railway link

# Rollback to previous deployment
railway rollback --service servio-production

# Or via Railway Dashboard:
# 1. Go to https://railway.app
# 2. Select service: servio-production
# 3. Go to Deployments tab
# 4. Find previous working deployment
# 5. Click "Redeploy"
```

### Incident Response Procedures

#### Severity Levels

| Level | Description | Response Time |
|-------|-------------|---------------|
| P1 (Critical) | Complete outage, data loss | 15 minutes |
| P2 (High) | Major feature broken | 1 hour |
| P3 (Medium) | Minor feature degraded | 4 hours |
| P4 (Low) | Non-critical issues | 24 hours |

#### P1 (Critical) Incident Checklist

1. **Acknowledge** - Confirm incident within 15 minutes
2. **Assess** - Check `/api/health` and `/api/ready` endpoints
3. **Check Logs** - Review Railway logs and Sentry for errors
4. **Determine Cause** - Recent deploy? Database issue? External dependency?
5. **Mitigate** - Roll back if caused by recent change
6. **Communicate** - Notify stakeholders
7. **Document** - Create incident report

#### Common Issues & Solutions

| Issue | Symptoms | Resolution |
|-------|----------|------------|
| 503 Auth Unavailable | Auth infrastructure down | Check Supabase status, verify env vars |
| High API Latency | Slow responses | Check database connections, Redis cache |
| Memory Exhaustion | OOM errors | Review memory usage, check for leaks |
| Database Connection Failures | Queries timing out | Check connection pool, Redis health |

### Log Aggregation

Logs are aggregated from multiple sources:
- **Application Logs**: Structured JSON logs via `lib/structured-logger.ts`
- **Error Tracking**: Sentry for error aggregation
- **Performance Metrics**: `/api/performance` endpoint
- **Audit Logs**: Security events logged via `lib/monitoring/security-audit.ts`

### Performance Tuning

#### Database Optimization

- Use connection pooling via `lib/db/connection-pool.ts`
- Enable query optimization with `lib/db/query-optimizer.ts`
- Implement caching for frequent queries

#### Cache Strategy

- **Short TTL (1 min)**: User sessions, rate limits
- **Medium TTL (5 min)**: Menu items, venue settings
- **Long TTL (30 min)**: Analytics data, cached computations
- **Very Long TTL (1 hr)**: AI categorization results

### Security Incident Response

1. **Detect** - Review security logs, Snyk alerts, CodeQL findings
2. **Assess** - Determine severity and impact
3. **Contain** - Block affected endpoints if needed
4. **Remediate** - Apply patches, update dependencies
5. **Verify** - Run security scans to confirm fix
6. **Document** - Create security incident report

### On-Call Schedule

| Week | Primary | Secondary |
|------|---------|-----------|
| Week 1 | On-Call Engineer 1 | On-Call Engineer 2 |
| Week 2 | On-Call Engineer 2 | On-Call Engineer 1 |

### Escalation Path

1. On-Call Engineer → 
2. Engineering Lead → 
3. CTO → 
4. Executive Team

### Useful Commands

```bash
# Run database migrations
pnpm migrate:prod

# Clear cache
pnpm cache:clear

# Check cache statistics
pnpm cache:stats

# Run health check
pnpm health:check

# Analyze performance
pnpm perf:analyze

# Run all tests
pnpm test:all

# Lint and format
pnpm validate
```

### Environment URLs

| Environment | URL | Status |
|-------------|-----|--------|
| Production | https://servio-production.up.railway.app | ✅ |
| Staging | https://servio-staging.up.railway.app | ✅ |
| Development | localhost:3000 | Local |

### Support Contacts

| Issue Type | Contact |
|------------|---------|
| Infrastructure | DevOps Team |
| Database | DBA Team |
| Security | Security Team |
| Application | Development Team |
