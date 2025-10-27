# Setup Guide

Complete guide to setting up Servio for local development.

## Prerequisites

- Node.js 20+ (`node --version`)
- pnpm 9+ (`pnpm --version`)
- Supabase account (free tier works)
- Stripe account (for payments)

## Quick Start

### 1. Clone Repository

```bash
git clone <repository-url>
cd servio-mvp-cleaned
```

### 2. Install Dependencies

```bash
pnpm install
```

### 3. Environment Variables

Create `.env.local` file:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Stripe
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...

# Redis (optional, for rate limiting)
REDIS_URL=redis://localhost:6379

# Sentry (optional, for error tracking)
NEXT_PUBLIC_SENTRY_DSN=your_sentry_dsn

# Node Environment
NODE_ENV=development
```

### 4. Database Setup

1. Create a new Supabase project
2. Run migrations (or use Supabase dashboard)
3. Enable Row-Level Security (RLS) on all tables
4. Set up RLS policies for multi-tenancy

Key tables to create:
- `venues`
- `users`
- `staff`
- `orders`
- `menu_items`
- `tables`
- `inventory`

### 5. Run Development Server

```bash
pnpm dev
```

Visit `http://localhost:3000`

## Development Workflow

### Running Tests

```bash
# Unit tests
pnpm test

# Watch mode
pnpm test:watch

# E2E tests
pnpm test:e2e

# Coverage
pnpm test:coverage
```

### Type Checking

```bash
pnpm typecheck
```

### Linting

```bash
pnpm lint
pnpm lint:fix
```

### Building

```bash
pnpm build
pnpm start
```

## Project Structure

- `app/` - Next.js App Router pages and API routes
- `components/` - React components
- `lib/` - Utilities and shared code
- `hooks/` - Custom React hooks
- `types/` - TypeScript type definitions
- `__tests__/` - Test files

## Key Commands

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start dev server |
| `pnpm build` | Production build |
| `pnpm start` | Start production server |
| `pnpm test` | Run tests |
| `pnpm typecheck` | Type check |
| `pnpm lint` | Lint code |
| `pnpm format` | Format code |

## Common Issues

### Port Already in Use

```bash
# Kill process on port 3000
lsof -ti:3000 | xargs kill -9
```

### Supabase Connection Issues

- Check `.env.local` variables
- Verify Supabase project is active
- Check network connectivity

### TypeScript Errors

```bash
# Clear Next.js cache
rm -rf .next
pnpm typecheck
```

### Module Not Found

```bash
# Reinstall dependencies
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

## Next Steps

1. **Read Architecture** - See `docs/ARCHITECTURE.md`
2. **API Reference** - See `docs/API_REFERENCE.md`
3. **Contributing** - See `docs/CONTRIBUTING.md`

## Getting Help

- Check existing issues on GitHub
- Review documentation in `/docs`
- Ask in team chat

