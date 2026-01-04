# Deployment Guide

This guide covers deploying Servio to production and staging environments.

## Overview

Servio is deployed on **Railway** with automatic deployments from GitHub. The application uses:
- **Next.js** for the application server
- **PostgreSQL** via Supabase
- **Redis** (optional, for caching)
- **Stripe** for payments

## Prerequisites

1. Railway account
2. GitHub repository connected
3. Supabase project
4. Stripe account
5. Environment variables configured

## Environment Setup

### Required Environment Variables

Configure these in Railway dashboard:

```env
# Supabase (Required)
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx
SUPABASE_SERVICE_ROLE_KEY=xxx

# Stripe (Required)
STRIPE_SECRET_KEY=sk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
STRIPE_CUSTOMER_WEBHOOK_SECRET=whsec_xxx
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_xxx

# App URLs (Required)
NEXT_PUBLIC_APP_URL=https://servio-production.up.railway.app
NODE_ENV=production

# Optional (Recommended)
REDIS_URL=redis://xxx
OPENAI_API_KEY=sk-xxx (for AI features)
SENTRY_DSN=https://xxx@sentry.io/xxx
CRON_SECRET=your-secure-random-string
```

### Optional Environment Variables

```env
# Monitoring
SENTRY_AUTH_TOKEN=xxx
SENTRY_ENABLE_DEV=false

# Logging
LOG_LEVEL=info

# Service Worker Cache
NEXT_PUBLIC_SW_CACHE_VERSION=v1.0.0
```

## Deployment Process

### 1. Connect Repository to Railway

1. Go to Railway dashboard
2. Click "New Project"
3. Select "Deploy from GitHub repo"
4. Choose your repository
5. Railway will automatically detect Next.js

### 2. Configure Environment Variables

1. In Railway project settings, go to "Variables"
2. Add all required environment variables (see above)
3. **Important**: Use production values (Supabase production project, Stripe live keys)

### 3. Database Setup

1. **Run Migrations**:
   ```bash
   # Via Railway CLI
   railway run pnpm migrate:prod
   
   # Or via Supabase Dashboard SQL Editor
   # Run migrations from migrations/ directory
   ```

2. **Verify Migration**:
   - Check Supabase Dashboard → Database → Tables
   - Ensure all tables exist (venues, orders, menu_items, etc.)
   - Verify RLS policies are enabled

### 4. Stripe Webhook Configuration

1. Go to Stripe Dashboard → Developers → Webhooks
2. Add endpoint: `https://servio-production.up.railway.app/api/stripe/webhook`
3. Select events:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
4. Copy webhook signing secret to `STRIPE_WEBHOOK_SECRET`

### 5. Initial Deployment

Railway automatically deploys when you push to `main` branch:

```bash
git push origin main
```

Railway will:
1. Build the Next.js application
2. Install dependencies
3. Run build command
4. Deploy to production

### 6. Verify Deployment

1. **Health Check**:
   ```bash
   curl https://servio-production.up.railway.app/api/health
   # Should return: ok
   ```

2. **Readiness Check**:
   ```bash
   curl https://servio-production.up.railway.app/api/ready
   # Should return JSON with status: "ready"
   ```

3. **Manual Testing**:
   - Visit production URL
   - Test sign-up flow
   - Test order creation
   - Test payment processing

## Staging Deployment

Staging environment is automatically deployed on push to `staging` branch.

### Staging Environment Variables

Use separate Supabase project and Stripe test keys:

```env
NEXT_PUBLIC_APP_URL=https://servio-staging.up.railway.app
NEXT_PUBLIC_SUPABASE_URL=https://xxx-staging.supabase.co
STRIPE_SECRET_KEY=sk_test_xxx
```

## CI/CD Pipeline

The project uses GitHub Actions for CI/CD:

### Workflow

1. **On Push to `main`**:
   - Run tests (`pnpm test`)
   - Run E2E tests (`pnpm test:e2e`)
   - Run security scan (Snyk)
   - Run database migrations
   - Deploy to Railway production

2. **On Push to `staging`**:
   - Run tests
   - Deploy to Railway staging

### Manual Deployment

If needed, you can trigger deployment manually:

```bash
# Via Railway CLI
railway up

# Or via Railway Dashboard
# Click "Redeploy" on latest deployment
```

## Database Migrations

### Running Migrations

Migrations are automatically run during CI/CD, but you can run manually:

```bash
# Production
NODE_ENV=production pnpm migrate:prod

# Staging
NODE_ENV=staging pnpm migrate:prod
```

### Creating New Migrations

1. Create SQL file in `migrations/` directory:
   ```bash
   pnpm migrate:create add_new_table
   ```

2. Write SQL:
   ```sql
   CREATE TABLE new_table (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     name TEXT NOT NULL
   );
   ```

3. Test locally:
   ```bash
   pnpm migrate
   ```

4. Commit and push (migrations run automatically)

## Rollback

### Via Railway Dashboard

1. Go to Railway project → Deployments
2. Find previous working deployment
3. Click "Redeploy"

### Via Railway CLI

```bash
railway rollback --service servio-production
```

### Via GitHub Actions

Use the rollback workflow:
1. Go to Actions → "Rollback Deployment"
2. Run workflow manually
3. Select environment and service

## Monitoring

### Health Checks

Railway uses these endpoints for health checks:
- **Liveness**: `/api/health` (must return 200)
- **Readiness**: `/api/ready` (must return 200 with status: "ready")

### Logs

View logs in Railway Dashboard:
1. Go to project → Service → Logs
2. Filter by deployment or time range
3. Export logs if needed

### Sentry Integration

Errors are automatically sent to Sentry:
- Production: `https://sentry.io/organizations/your-org/projects/servio/`
- View errors, performance, and releases

## Performance Optimization

### Build Optimizations

The Next.js build includes:
- Code splitting
- Tree shaking
- Bundle analysis (when `ANALYZE=true`)
- Image optimization
- Compression (gzip)

### Runtime Optimizations

- React Query caching
- Service worker for offline support
- Connection pooling (Supabase)
- Redis caching (optional)

## Troubleshooting

### Build Failures

1. Check Railway build logs
2. Verify environment variables
3. Check TypeScript errors: `pnpm typecheck`
4. Check ESLint: `pnpm lint`

### Runtime Errors

1. Check Railway logs
2. Check Sentry for errors
3. Verify database connectivity
4. Verify Stripe webhooks

### Database Issues

1. Check Supabase dashboard
2. Verify migrations ran successfully
3. Check RLS policies
4. Verify connection string

### Payment Issues

1. Verify Stripe keys are correct
2. Check webhook endpoint is reachable
3. Verify webhook events in Stripe dashboard
4. Check application logs for webhook errors

## Security Checklist

Before deploying to production:

- [ ] All environment variables set
- [ ] Stripe webhooks configured
- [ ] Database migrations run
- [ ] RLS policies enabled
- [ ] HTTPS enabled (Railway default)
- [ ] Sentry DSN configured
- [ ] Rate limiting enabled
- [ ] CORS configured correctly
- [ ] Security headers configured (in next.config.mjs)

## Scaling

### Horizontal Scaling

Railway supports horizontal scaling:
1. Go to Service → Settings → Scaling
2. Adjust instance count
3. Monitor performance and costs

### Database Scaling

Supabase handles database scaling:
- Free tier: Up to 500MB database
- Pro tier: Up to 8GB database
- Scale up in Supabase dashboard

### Cache Scaling

If using Redis:
- Railway Redis: Automatic scaling
- Monitor memory usage
- Scale up as needed

## Backup Strategy

### Database Backups

Supabase provides automatic backups:
- **Free tier**: Daily backups (7 days retention)
- **Pro tier**: Point-in-time recovery (7 days)
- **Enterprise**: Custom retention

### Manual Backups

```bash
# Via Supabase Dashboard
# Go to Database → Backups → Create backup

# Or via pg_dump
pg_dump $DATABASE_URL > backup.sql
```

### Restore from Backup

1. Go to Supabase Dashboard → Database → Backups
2. Select backup point
3. Click "Restore"

## Disaster Recovery

### Recovery Procedures

1. **Database Failure**:
   - Restore from Supabase backup
   - Verify data integrity
   - Redeploy application if needed

2. **Application Failure**:
   - Rollback to previous deployment
   - Check logs for root cause
   - Fix and redeploy

3. **Payment Processing Failure**:
   - Check Stripe status page
   - Verify webhook endpoint
   - Replay failed webhooks if needed

### RTO/RPO Targets

- **RTO (Recovery Time Objective)**: < 1 hour
- **RPO (Recovery Point Objective)**: < 24 hours (Supabase backups)

## Support

For deployment issues:
- **Railway Support**: https://railway.app/support
- **Documentation**: This file and README.md
- **Team**: Check internal documentation

---

**Last Updated:** December 2025  
**Version:** 0.1.6

