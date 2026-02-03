# Engineer Onboarding Guide

Welcome to the Servio team! This guide will help you get up to speed with our codebase, development workflow, and best practices.

## Table of Contents

1. [Quick Start](#quick-start)
2. [Development Environment Setup](#development-environment-setup)
3. [Project Structure](#project-structure)
4. [Key Concepts](#key-concepts)
5. [Development Workflow](#development-workflow)
6. [Testing](#testing)
7. [Deployment](#deployment)
8. [Common Tasks](#common-tasks)
9. [Troubleshooting](#troubleshooting)
10. [Resources](#resources)

---

## Quick Start

### Prerequisites

- Node.js 20.x or higher
- pnpm 9.x or higher
- Git
- VS Code (recommended) with extensions

### Initial Setup

1. **Clone the repository**:
   ```bash
   git clone https://github.com/your-org/servio-mvp.git
   cd servio-mvp
   ```

2. **Install dependencies**:
   ```bash
   pnpm install
   ```

3. **Set up environment variables**:
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your local values
   ```

4. **Start development server**:
   ```bash
   pnpm dev
   ```

5. **Open in browser**:
   - Navigate to http://localhost:3000
   - Sign up or sign in

---

## Development Environment Setup

### Required Environment Variables

Copy `.env.example` to `.env.local` and configure:

```bash
# Supabase (Required)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Stripe (Required for payments)
STRIPE_SECRET_KEY=sk_test_your-secret-key
STRIPE_WEBHOOK_SECRET=whsec_your-webhook-secret
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_your-publishable-key

# Redis (Optional for development, Required for production)
REDIS_URL=redis://localhost:6379

# Application URLs
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Recommended VS Code Extensions

- **ESLint**: Built-in linting
- **Prettier**: Code formatting
- **TypeScript**: Built-in TypeScript support
- **GitLens**: Git supercharged
- **Error Lens**: Error diagnostics
- **Thunder Client**: GraphQL client (if needed)

### VS Code Settings

Create `.vscode/settings.json`:

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "typescript.tsdk": "latest",
  "typescript.enablePromptUseWorkspaceTsdk": true
}
```

---

## Project Structure

### Directory Overview

```
servio-mvp/
├── app/                    # Next.js App Router
│   ├── api/               # API routes
│   ├── dashboard/          # Dashboard pages
│   └── auth/              # Authentication pages
├── components/             # Reusable React components
├── hooks/                 # Custom React hooks
├── lib/                   # Core business logic
│   ├── services/           # Service layer (OrderService, etc.)
│   ├── ai/                # AI assistant logic
│   ├── monitoring/         # Logging and error tracking
│   └── supabase/          # Supabase client factory
├── types/                 # TypeScript type definitions
├── __tests__/             # Test files
├── docs/                  # Documentation
└── scripts/               # Utility scripts
```

### Key Files to Know

- **`lib/supabase/index.ts`**: Supabase client factory - ONLY place to create Supabase clients
- **`lib/api/unified-handler.ts`**: Unified API handler with auth, rate limiting, validation
- **`lib/services/`**: Service layer for business logic
- **`middleware.ts`**: Request middleware for auth and headers
- **`tsconfig.json`**: TypeScript configuration

---

## Key Concepts

### Multi-Tenancy

Servio is a multi-tenant SaaS where each venue is a separate tenant:

- **Venue**: A restaurant/location with its own data
- **Organization**: Groups venues under one billing account
- **RLS (Row Level Security)**: Database-level tenant isolation
- **Role-Based Access**: Owner, Manager, Staff, Kitchen, Server, Cashier

**Critical Rule**: Never use `createAdminClient` in non-admin code. It bypasses RLS and exposes all tenant data.

### Authentication Flow

1. User signs in via Supabase Auth
2. Middleware validates session and sets headers:
   - `x-user-id`: Authenticated user ID
   - `x-user-email`: User email
   - `x-user-role`: User role for venue
   - `x-user-tier`: Subscription tier
   - `x-venue-id`: Current venue ID
3. API routes use unified handler for auth checks
4. RLS policies enforce tenant isolation at database level

### Service Layer Pattern

Services extend `BaseService` and provide:

- **Caching**: Automatic caching with TTL
- **Error Handling**: Consistent error handling
- **Type Safety**: Full TypeScript support

Example:
```typescript
import { OrderService } from '@/lib/services/OrderService';

const orderService = new OrderService();
const orders = await orderService.getOrders(venueId);
```

### Rate Limiting

- **Redis Required**: Production deployments require Redis
- **Per-Endpoint Limits**: Different limits for different endpoints
- **Metrics Export**: Rate limit metrics for monitoring

---

## Development Workflow

### Branch Strategy

- **`main`**: Production code
- **`develop`**: Integration branch
- **`feature/*`**: Feature branches
- **`bugfix/*`**: Bug fix branches
- **`hotfix/*`**: Urgent production fixes

### Commit Convention

```
<type>(<scope>): <subject>

<body>

<footer>
```

Examples:
- `feat(order): add order cancellation`
- `fix(auth): resolve session timeout issue`
- `docs(readme): update onboarding guide`

### Pull Request Process

1. Create feature branch from `develop`
2. Make changes with clear commits
3. Run tests: `pnpm test`
4. Run linting: `pnpm lint`
5. Run type checking: `pnpm typecheck`
6. Create pull request to `develop`
7. Request review from at least one team member
8. Update PR based on feedback

### Code Review Checklist

- [ ] Code follows project conventions
- [ ] TypeScript types are correct
- [ ] No `createAdminClient` in non-admin code
- [ ] Tests added for new features
- [ ] Documentation updated
- [ ] No console.log in production code
- [ ] Error handling is consistent
- [ ] Rate limiting is appropriate
- [ ] RLS policies are respected

---

## Testing

### Running Tests

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run tests with coverage
pnpm test:coverage

# Run E2E tests
pnpm test:e2e

# Run integration tests
pnpm test:integration
```

### Test Structure

```
__tests__/
├── api/              # API route tests
├── services/          # Service layer tests
├── components/        # Component tests
├── integration/       # Integration tests
└── e2e/             # End-to-end tests
```

### Writing Tests

Follow these patterns:

1. **Arrange-Act-Assert**:
   ```typescript
   describe('OrderService', () => {
     it('should create order', async () => {
       // Arrange
       const venueId = 'venue-123';
       const orderData = { ... };
       
       // Act
       const order = await orderService.createOrder(venueId, orderData);
       
       // Assert
       expect(order).toBeDefined();
       expect(order.venue_id).toBe(venueId);
     });
   });
   ```

2. **Mock external dependencies**:
   ```typescript
   vi.mock('@/lib/supabase', () => ({
     createAdminClient: vi.fn(),
     createServerSupabase: vi.fn(),
   }));
   ```

3. **Test error cases**:
   ```typescript
   it('should handle duplicate order', async () => {
     await expect(
       orderService.createOrder(venueId, duplicateData)
     ).rejects.toThrow('Order already exists');
   });
   ```

---

## Deployment

### Pre-Deployment Checklist

- [ ] All tests passing
- [ ] No linting errors
- [ ] No TypeScript errors
- [ ] Environment variables configured
- [ ] Database migrations run
- [ ] Redis configured (production)
- [ ] Stripe webhooks configured
- [ ] Sentry DSN configured
- [ ] Bundle size analyzed

### Deployment Process

**Railway**:
```bash
# Push to main
git push origin main

# Railway auto-deploys on push
# Monitor deployment at https://railway.app
```

**Vercel**:
```bash
# Push to main
git push origin main

# Vercel auto-deploys on push
# Monitor deployment at https://vercel.com
```

### Post-Deployment Verification

1. Check health endpoint: `curl https://app.servio.com/api/health`
2. Check Sentry for errors
3. Monitor rate limit metrics
4. Test critical user flows
5. Verify Stripe webhooks are receiving events

---

## Common Tasks

### Adding a New API Route

1. Create route file: `app/api/your-endpoint/route.ts`
2. Use `createUnifiedHandler`:
   ```typescript
   import { createUnifiedHandler } from '@/lib/api/unified-handler';
   
   export const POST = createUnifiedHandler(
     async (req, { user, body }) => {
       // Your logic here
       return { success: true, data: result };
     },
     {
       requireAuth: true,
       rateLimit: RATE_LIMITS.GENERAL,
     }
   );
   ```
3. Add tests in `__tests__/api/your-endpoint.test.ts`

### Adding a New Service

1. Create service file: `lib/services/YourService.ts`
2. Extend `BaseService`:
   ```typescript
   import { BaseService } from './BaseService';
   
   export class YourService extends BaseService {
     async getItems(venueId: string) {
       return this.withCache(
         this.getCacheKey('items', venueId),
         async () => {
           // Your logic here
         },
         300 // 5 minute TTL
       );
     }
   }
   ```
3. Export singleton: `export const yourService = new YourService();`

### Adding Database Migration

1. Create migration file: `supabase/migrations/YYYYMMDDHHMMSS_description.sql`
2. Write SQL migration:
   ```sql
   -- Add new table
   CREATE TABLE IF NOT EXISTS your_table (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     venue_id UUID NOT NULL REFERENCES venues(venue_id),
     created_at TIMESTAMPTZ DEFAULT NOW()
   );
   
   -- Enable RLS
   ALTER TABLE your_table ENABLE ROW LEVEL SECURITY;
   
   -- Add RLS policy
   CREATE POLICY "Users can view own venue data"
     ON your_table
     FOR SELECT
     TO authenticated
     USING (
       venue_id IN (
         SELECT venue_id FROM venues WHERE owner_user_id = auth.uid()
       )
     );
   ```
3. Run migration: `pnpm migrate`

### Adding a New Page

1. Create page file: `app/dashboard/[venueId]/your-page/page.tsx`
2. Use server components for data fetching
3. Use client components for interactivity
4. Add loading and error states

---

## Troubleshooting

### Common Issues

**Issue**: "Redis is required in production"
- **Solution**: Set `REDIS_URL` environment variable
- **Reference**: [Deployment Requirements](./DEPLOYMENT-REQUIREMENTS.md)

**Issue**: "createAdminClient bypasses RLS"
- **Solution**: Use `createServerSupabase()` or `createClient()` instead
- **Reference**: Linting rule will catch this

**Issue**: Tests failing with "Module not found"
- **Solution**: Run `pnpm install` to install dependencies
- **Check**: Verify import paths are correct

**Issue**: Type errors after pulling latest changes
- **Solution**: Run `pnpm install` to update dependencies
- **Check**: Clear TypeScript cache: `rm -rf .next`

**Issue**: Rate limiting not working in development
- **Solution**: Redis is optional in development
- **Check**: Verify `NODE_ENV=development`

**Issue**: Stripe webhooks not being received
- **Solution**: Verify webhook URL is accessible from Stripe
- **Check**: Verify webhook secret matches
- **Reference**: [Production Runbook](./PRODUCTION-RUNBOOK.md#stripe-webhook-failures)

### Getting Help

1. **Check documentation**: Look in `docs/` folder
2. **Search codebase**: Use VS Code search to find examples
3. **Ask team**: Post in team chat or Slack
4. **Create issue**: Create GitHub issue for bugs

---

## Resources

### Internal Documentation

- [Architecture Documentation](./ARCHITECTURE.md)
- [Deployment Requirements](./DEPLOYMENT-REQUIREMENTS.md)
- [Production Runbook](./PRODUCTION-RUNBOOK.md)
- [API Reference](./API.md)
- [ADR Index](./adr/0060-index.md)

### External Documentation

- [Next.js Documentation](https://nextjs.org/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [Stripe Documentation](https://stripe.com/docs)
- [TypeScript Documentation](https://www.typescriptlang.org/docs)

### Tools

- [pnpm](https://pnpm.io/)
- [Vitest](https://vitest.dev/)
- [Playwright](https://playwright.dev/)
- [ESLint](https://eslint.org/)

### Team Communication

- **Slack**: [Team Slack Channel]
- **GitHub**: [GitHub Repository]
- **Email**: [Team Email]

---

## Next Steps

1. Complete the Quick Start section
2. Set up your development environment
3. Read through the Key Concepts section
4. Explore the project structure
5. Try running some tests
6. Make your first commit!

**Welcome to the team! We're excited to have you on board.** 🚀
