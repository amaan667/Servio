# Servio Setup Guide

## Prerequisites

- Node.js 18+ (LTS recommended)
- pnpm 8+ (or npm/yarn)
- Git
- Supabase account
- Stripe account (for payments)
- OpenAI API key (for AI features)

## Local Development Setup

### 1. Clone the Repository

```bash
git clone https://github.com/amaan667/Servio.git
cd servio-mvp-cleaned
```

### 2. Install Dependencies

```bash
pnpm install
```

### 3. Environment Configuration

Create a `.env.local` file in the root directory:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# OpenAI
OPENAI_API_KEY=your_openai_api_key

# Stripe
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=your_stripe_publishable_key
STRIPE_SECRET_KEY=your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret

# App Configuration
NEXT_PUBLIC_APP_URL=http://localhost:3000
NODE_ENV=development

# Redis (Optional - for caching)
REDIS_URL=redis://localhost:6379

# Sentry (Optional - for error tracking)
SENTRY_DSN=your_sentry_dsn
SENTRY_AUTH_TOKEN=your_sentry_auth_token
```

### 4. Database Setup

#### Option A: Using Supabase (Recommended)

1. Create a new Supabase project at [supabase.com](https://supabase.com)
2. Copy your project URL and anon key to `.env.local`
3. Run database migrations:

```bash
# The app will create tables automatically on first run
# Or manually run migrations via Supabase dashboard
```

#### Option B: Local PostgreSQL

```bash
# Start PostgreSQL
brew services start postgresql

# Create database
createdb servio_dev

# Update DATABASE_URL in .env.local
DATABASE_URL=postgresql://localhost:5432/servio_dev
```

### 5. Redis Setup (Optional)

For production-grade caching:

```bash
# Install Redis
brew install redis

# Start Redis
brew services start redis

# Verify Redis is running
redis-cli ping
# Should return: PONG
```

### 6. Stripe Setup

1. Create a Stripe account at [stripe.com](https://stripe.com)
2. Get your API keys from the Dashboard
3. Set up webhook endpoint:
   - URL: `http://localhost:3000/api/stripe/webhook`
   - Events: `checkout.session.completed`, `customer.subscription.*`

### 7. Run Development Server

```bash
pnpm dev
```

Navigate to [http://localhost:3000](http://localhost:3000)

## Production Deployment

### Railway Deployment

1. Create a Railway account at [railway.app](https://railway.app)
2. Connect your GitHub repository
3. Add environment variables
4. Deploy automatically from `main` branch

#### Railway Configuration

Create `railway.toml`:

```toml
[build]
builder = "nixpacks"
buildCommand = "pnpm install && pnpm run build"

[deploy]
startCommand = "pnpm start"
restartPolicyType = "on-failure"
restartPolicyMaxRetries = 10

[[services]]
name = "web"
```

### Vercel Deployment

```bash
# Install Vercel CLI
pnpm add -g vercel

# Deploy
vercel --prod
```

### Environment Variables for Production

Ensure all environment variables are set in your deployment platform:
- Use production keys (not test keys)
- Set `NODE_ENV=production`
- Configure custom domain
- Set up SSL certificates

## Testing Setup

### Unit Tests

```bash
# Run unit tests
pnpm test

# Run with coverage
pnpm test:coverage

# Watch mode
pnpm test:watch
```

### E2E Tests

```bash
# Install Playwright browsers
pnpm exec playwright install

# Run E2E tests
pnpm test:e2e

# Run in UI mode
pnpm exec playwright test --ui
```

## Database Migrations

### Create Migration

```bash
# Using Supabase CLI
supabase migration new migration_name

# Edit the migration file in supabase/migrations/
```

### Apply Migrations

```bash
# Local
supabase db push

# Production (via Supabase dashboard or CLI)
supabase db push --db-url $DATABASE_URL
```

## Troubleshooting

### Common Issues

**Issue: Module not found**
```bash
# Clear cache and reinstall
rm -rf node_modules .next
pnpm install
```

**Issue: Database connection failed**
- Check Supabase project status
- Verify environment variables
- Check network/firewall settings

**Issue: Build fails**
```bash
# Check TypeScript errors
pnpm run type-check

# Check linting errors
pnpm run lint

# Clear build cache
rm -rf .next
```

**Issue: Stripe webhook not working locally**
```bash
# Use Stripe CLI for local testing
stripe listen --forward-to localhost:3000/api/stripe/webhook

# Copy the webhook signing secret to .env.local
STRIPE_WEBHOOK_SECRET=whsec_...
```

## Development Tools

### Recommended VS Code Extensions

- ESLint
- Prettier
- Tailwind CSS IntelliSense
- TypeScript and JavaScript Language Features
- GitLens
- Supabase

### Useful Commands

```bash
# Type checking
pnpm run type-check

# Linting
pnpm run lint
pnpm run lint:fix

# Formatting
pnpm run format
pnpm run format:check

# Build
pnpm run build

# Start production server locally
pnpm start
```

## Next Steps

1. Read the [Architecture Documentation](./ARCHITECTURE.md)
2. Review the [API Documentation](/api-docs)
3. Check out the [Contributing Guide](./CONTRIBUTING.md)
4. Explore the [Testing Guide](./TESTING.md)

## Support

- GitHub Issues: [github.com/amaan667/Servio/issues](https://github.com/amaan667/Servio/issues)
- Email: support@servio.com
- Documentation: [servio.com/docs](https://servio.com/docs)

