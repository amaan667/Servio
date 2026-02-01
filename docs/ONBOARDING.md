# Developer Onboarding Guide

Welcome to the Servio development team! This guide will help you get set up and familiar with the codebase.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Getting Started](#getting-started)
3. [Project Structure](#project-structure)
4. [Development Workflow](#development-workflow)
5. [Common Tasks](#common-tasks)
6. [Testing](#testing)
7. [Debugging](#debugging)
8. [Deployment](#deployment)
9. [Resources](#resources)

## Prerequisites

### Required Software

- **Node.js**: Version 20 or higher
  ```bash
  node --version  # Should be v20.x.x or higher
  ```

- **pnpm**: Version 9 or higher
  ```bash
  npm install -g pnpm@latest
  pnpm --version  # Should be 9.x.x or higher
  ```

- **Git**: Latest version
  ```bash
  git --version
  ```

### Required Accounts

- **Supabase**: Create account at [supabase.com](https://supabase.com)
- **Stripe**: Create account at [stripe.com](https://stripe.com) (for payment features)
- **GitHub**: For code collaboration

### Recommended Tools

- **VS Code**: Recommended IDE with extensions:
  - ESLint
  - Prettier
  - TypeScript Vue Plugin (Volar)
  - Tailwind CSS IntelliSense

- **Postman** or **Insomnia**: For API testing

## Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/amaan667/Servio.git
cd Servio
```

### 2. Install Dependencies

```bash
pnpm install
```

### 3. Set Up Environment Variables

Copy the example environment file:

```bash
cp .env.example .env.local
```

Edit `.env.local` and add your credentials:

```bash
# Supabase (Required)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# Stripe (Required for payments)
STRIPE_SECRET_KEY=sk_test_your-secret-key-here
STRIPE_WEBHOOK_SECRET=whsec_your-webhook-secret-here
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_your-publishable-key-here

# Application URLs
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# Optional: Redis (for production rate limiting)
# REDIS_URL=redis://localhost:6379

# Optional: OpenAI (for AI features)
# OPENAI_API_KEY=sk-your-openai-key-here

# Optional: Sentry (for error tracking)
# SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id
```

### 4. Start Development Server

```bash
pnpm dev
```

The application will be available at [http://localhost:3000](http://localhost:3000)

### 5. Verify Setup

1. Open [http://localhost:3000](http://localhost:3000)
2. Check that the page loads without errors
3. Open browser console - should see no errors
4. Run health check: [http://localhost:3000/api/health](http://localhost:3000/api/health)

## Project Structure

```
servio-mvp/
├── app/                      # Next.js App Router pages
│   ├── api/                 # API routes (209 endpoints)
│   ├── dashboard/            # Admin dashboard pages
│   ├── order/               # Customer ordering flow
│   └── auth/               # Authentication pages
├── components/               # Reusable React components (182 components)
│   ├── ui/                 # shadcn/ui components
│   ├── orders/              # Order-related components
│   ├── menu/                # Menu-related components
│   └── ...                 # Other feature components
├── lib/                     # Core business logic
│   ├── services/            # Domain services (Order, Menu, etc.)
│   ├── repositories/        # Database access layer
│   ├── api/                # API utilities and handlers
│   ├── auth/               # Authentication utilities
│   ├── cache/              # Caching layer
│   ├── monitoring/          # Error tracking and performance
│   └── ...                # Other utilities
├── hooks/                   # Custom React hooks
├── types/                   # TypeScript type definitions
├── __tests__/              # Test files
├── docs/                   # Documentation
├── public/                  # Static assets
└── scripts/                 # Utility scripts
```

### Key Directories Explained

#### `app/`
Contains all Next.js pages and API routes using the App Router.

- **API Routes**: `app/api/*` - All backend endpoints
- **Dashboard**: `app/dashboard/*` - Admin interface
- **Order Flow**: `app/order/*` - Customer ordering experience

#### `components/`
Reusable React components organized by feature.

- **UI Components**: `components/ui/*` - Base UI components (buttons, inputs, etc.)
- **Feature Components**: Organized by domain (orders, menu, tables, etc.)

#### `lib/`
Core application logic and utilities.

- **Services**: Business logic for each domain
- **Repositories**: Database access abstraction
- **API**: Request/response handling, validation
- **Auth**: Authentication and authorization
- **Cache**: Caching strategies
- **Monitoring**: Error tracking, performance

#### `hooks/`
Custom React hooks for reusable stateful logic.

#### `types/`
TypeScript type definitions for the entire application.

## Development Workflow

### Code Style

We use ESLint and Prettier for consistent code style:

```bash
# Lint code
pnpm lint

# Fix linting issues
pnpm lint:fix

# Format code
pnpm format
```

### Type Checking

TypeScript strict mode is enabled. Always check types before committing:

```bash
pnpm typecheck
```

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

### Pre-commit Hooks

Husky runs pre-commit hooks automatically:

1. Lint staged files
2. Format staged files
3. Run type checking

If hooks fail, fix the issues and try again.

### Git Workflow

1. Create a feature branch:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. Make your changes

3. Commit with descriptive messages:
   ```bash
   git add .
   git commit -m "feat: add order cancellation feature"
   ```

4. Push and create pull request:
   ```bash
   git push origin feature/your-feature-name
   ```

### Commit Message Convention

Follow conventional commits:

- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation changes
- `style:` Code style changes (formatting)
- `refactor:` Code refactoring
- `test:` Adding or updating tests
- `chore:` Maintenance tasks

Examples:
```
feat: add bulk order completion
fix: resolve payment webhook timeout
docs: update API documentation
test: add unit tests for OrderService
```

## Common Tasks

### Adding a New API Endpoint

1. Create route file in `app/api/`:
   ```typescript
   // app/api/venues/:venueId/custom/route.ts
   import { createUnifiedHandler } from "@/lib/api/unified-handler";
   import { z } from "zod";

   const schema = z.object({
     name: z.string(),
   });

   export const POST = createUnifiedHandler(
     async (req, { body, venueId }) => {
       // Your logic here
       return { success: true };
     },
     {
       schema,
       requireAuth: true,
       requireVenueAccess: true,
     }
   );
   ```

2. Test the endpoint
3. Add documentation to `docs/API.md`

### Adding a New Service

1. Create service file in `lib/services/`:
   ```typescript
   // lib/services/CustomService.ts
   import { BaseService } from "./BaseService";

   export class CustomService extends BaseService {
     async getCustomData(venueId: string) {
       const cacheKey = this.getCacheKey("custom", venueId);
       return this.withCache(cacheKey, async () => {
         // Your logic here
       });
     }
   }

   export const customService = new CustomService();
   ```

2. Add tests in `__tests__/services/`
3. Export from `lib/services/index.ts`

### Adding a New Component

1. Create component file in `components/`:
   ```typescript
   // components/custom/CustomComponent.tsx
   import { Button } from "@/components/ui/button";

   export function CustomComponent() {
     return (
       <div>
         <Button>Click me</Button>
       </div>
     );
   }
   ```

2. Add tests in `__tests__/components/`
3. Export from appropriate index file

### Adding Database Migration

1. Create migration file in `supabase/migrations/`:
   ```sql
   -- supabase/migrations/20240101000000_add_custom_table.sql
   CREATE TABLE custom_table (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     venue_id UUID NOT NULL REFERENCES venues(id),
     name TEXT NOT NULL,
     created_at TIMESTAMPTZ DEFAULT NOW()
   );

   -- Add RLS policy
   ALTER TABLE custom_table ENABLE ROW LEVEL SECURITY;

   CREATE POLICY "Users can view their venue's data"
     ON custom_table
     FOR SELECT
     USING (venue_id IN (
       SELECT venue_id FROM venue_users
       WHERE user_id = auth.uid()
     ));
   ```

2. Run migration:
   ```bash
   pnpm migrate
   ```

## Testing

### Unit Tests

Unit tests test individual functions and classes in isolation.

```typescript
// __tests__/services/OrderService.test.ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import { OrderService } from "@/lib/services/OrderService";

describe("OrderService", () => {
  it("should create an order", async () => {
    // Test implementation
  });
});
```

### Integration Tests

Integration tests test multiple components working together.

```typescript
// __tests__/integration/order-flow.test.ts
import { describe, it, expect } from "vitest";

describe("Order Flow", () => {
  it("should complete full order flow", async () => {
    // Test implementation
  });
});
```

### E2E Tests

E2E tests test the application from the user's perspective.

```typescript
// __tests__/e2e/ordering.spec.ts
import { test, expect } from "@playwright/test";

test("customer can place an order", async ({ page }) => {
  await page.goto("/order/venue-1");
  await page.click('[data-testid="add-to-cart"]');
  await page.click('[data-testid="checkout"]');
  await expect(page.locator('[data-testid="order-success"]')).toBeVisible();
});
```

### Test Coverage

Generate coverage report:

```bash
pnpm test:coverage
```

View coverage at `coverage/index.html`.

## Debugging

### VS Code Debugging

1. Create `.vscode/launch.json`:
   ```json
   {
     "version": "0.2.0",
     "configurations": [
       {
         "name": "Next.js: debug server-side",
         "type": "node-terminal",
         "request": "launch",
         "command": "pnpm dev"
       },
       {
         "name": "Next.js: debug client-side",
         "type": "chrome",
         "request": "launch",
         "url": "http://localhost:3000"
       }
     ]
   }
   ```

2. Set breakpoints in your code
3. Press F5 or use the debug panel

### Browser DevTools

1. Open Chrome DevTools (F12)
2. Use Console for client-side logging
3. Use Network tab for API requests
4. Use React DevTools for component inspection

### Server-Side Logging

Logs are structured and sent to Sentry in production. In development:

```typescript
import { logger } from "@/lib/monitoring/structured-logger";

logger.info("Order created", { orderId: "123", venueId: "venue-1" });
logger.error("Payment failed", { orderId: "123" }, error);
```

## Deployment

### Railway (Recommended)

1. Connect GitHub repository to Railway
2. Set environment variables in Railway dashboard
3. Deploy automatically on push to `main`

### Vercel

1. Import project to Vercel
2. Set environment variables
3. Deploy

### Environment Variables

Required for production:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`

### Health Checks

- **Liveness**: `/api/health` - Returns "ok"
- **Readiness**: `/api/ready` - Checks DB, Redis, Stripe

## Resources

### Documentation

- [Architecture](./ARCHITECTURE.md) - System architecture overview
- [API Documentation](./API.md) - Complete API reference
- [README](../README.md) - Project overview

### External Documentation

- [Next.js Docs](https://nextjs.org/docs)
- [Supabase Docs](https://supabase.com/docs)
- [React Query Docs](https://tanstack.com/query/latest)
- [Tailwind CSS Docs](https://tailwindcss.com/docs)
- [Radix UI Docs](https://www.radix-ui.com/)

### Team Communication

- **Slack**: #servio-dev
- **GitHub Issues**: Report bugs and feature requests
- **Standups**: Daily at 10 AM EST

## Getting Help

### Common Issues

**Issue**: Dependencies won't install
```bash
# Clear cache and reinstall
rm -rf node_modules .next
pnpm install
```

**Issue**: Type errors after pulling changes
```bash
# Rebuild TypeScript
rm -rf .next
pnpm typecheck
```

**Issue**: Tests failing locally
```bash
# Clear test cache
rm -rf coverage
pnpm test
```

### Asking for Help

1. Check existing documentation
2. Search GitHub issues
3. Ask in Slack #servio-dev
4. Create a GitHub issue with:
   - Clear description
   - Steps to reproduce
   - Expected vs actual behavior
   - Environment details

## Best Practices

### Code Quality

- Write self-documenting code
- Keep functions small and focused
- Use TypeScript for type safety
- Add tests for new features
- Follow existing patterns

### Performance

- Use server components when possible
- Implement caching for expensive operations
- Optimize database queries
- Lazy load components

### Security

- Never commit secrets
- Validate all inputs
- Use prepared statements
- Follow principle of least privilege
- Keep dependencies updated

### Collaboration

- Review pull requests promptly
- Provide constructive feedback
- Document your changes
- Share knowledge with team

## Next Steps

Now that you're set up:

1. Explore the codebase
2. Read the [Architecture](./ARCHITECTURE.md) documentation
3. Review the [API Documentation](./API.md)
4. Pick up a good first issue from GitHub
5. Join the team Slack channel

Welcome aboard! 🚀
