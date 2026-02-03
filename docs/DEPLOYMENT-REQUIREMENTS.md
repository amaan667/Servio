# Deployment Requirements

This document outlines the infrastructure and configuration requirements for deploying Servio to production.

## Required Infrastructure

### 1. Database (Supabase)

Servio requires a Supabase project with the following:

- **Supabase Project**: Create a project at https://app.supabase.com
- **Environment Variables**:
  - `NEXT_PUBLIC_SUPABASE_URL`: Your Supabase project URL
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Anonymous/public key (safe to expose)
  - `SUPABASE_SERVICE_ROLE_KEY`: Service role key (NEVER expose to client)

### 2. Redis (Required for Production)

**CRITICAL**: Redis is **required** for production deployments. The application will fail to start in production without Redis configured.

**Why Redis is Required**:
- Distributed rate limiting across multiple server instances
- Prevents rate limit bypass when scaling horizontally
- Provides persistent rate limit state across deployments
- Required for production security and abuse prevention

**Redis Configuration**:
- **Environment Variable**: `REDIS_URL`
- **Format**: `redis://[user]:[password]@host:port`
- **Example**: `redis://default:password@redis.example.com:6379`

**Redis Providers**:
- Railway: Built-in Redis service
- AWS ElastiCache
- Google Cloud Memorystore
- Azure Cache for Redis
- DigitalOcean Managed Redis
- Self-hosted Redis

**Development Exception**:
- In development (`NODE_ENV=development`), Redis is optional
- If not configured, rate limiting falls back to in-memory storage
- This is **NOT** suitable for production deployments

### 3. Stripe (Required for Payments)

**Environment Variables**:
- `STRIPE_SECRET_KEY`: Secret key for server-side operations
- `STRIPE_WEBHOOK_SECRET`: Webhook signing secret for verifying events
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`: Public key for client-side
- `STRIPE_BASIC_PRICE_ID`: Price ID for Starter tier
- `STRIPE_STANDARD_PRICE_ID`: Price ID for Pro tier
- `STRIPE_PREMIUM_PRICE_ID`: Price ID for Enterprise tier

**Webhook Configuration**:
- Configure webhook endpoint: `https://your-domain.com/api/stripe/webhook`
- Set webhook secret in environment variables
- Enable events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`

### 4. Application URLs

**Environment Variables**:
- `NEXT_PUBLIC_APP_URL`: Public-facing URL of your application
- `NEXT_PUBLIC_SITE_URL`: Alternative site URL
- `APP_URL`: Server-side application URL

**Examples**:
- Production: `https://app.servio.com`
- Staging: `https://staging.servio.com`
- Development: `http://localhost:3000`

### 5. Monitoring (Recommended)

**Sentry** (Recommended for production):
- `SENTRY_DSN`: Sentry Data Source Name
- `SENTRY_AUTH_TOKEN`: Authentication token for source maps
- `SENTRY_ENVIRONMENT`: Environment name (production/staging)

**APM** (Optional):
- `APM_PROVIDER`: `datadog`, `newrelic`, or `none`
- `DD_SERVICE`: Service name for Datadog
- `DD_ENV`: Environment name
- `NEW_RELIC_LICENSE_KEY`: License key for New Relic

### 6. Email Service (Optional)

**Resend** (Recommended for transactional emails):
- `RESEND_API_KEY`: API key for sending emails

**Alternative**: Configure your own SMTP server

### 7. OpenAI (Optional)

**AI Assistant Features**:
- `OPENAI_API_KEY`: API key for AI-powered features
- Required for: AI chat, menu categorization, KDS station assignment

## Deployment Platforms

### Railway (Recommended)

Railway provides built-in services for all requirements:

1. **Database**: Supabase (external)
2. **Redis**: Built-in Redis service
3. **Environment Variables**: Set in Railway dashboard
4. **Domain**: Configure custom domain or use Railway's domain
5. **Build**: Automatic builds from Git repository

**Railway-Specific Variables**:
- `RAILWAY_PUBLIC_DOMAIN`: Auto-populated by Railway
- `RAILWAY_SERVICE_NAME`: Auto-populated by Railway

### Vercel

1. **Database**: Supabase (external)
2. **Redis**: Use Vercel KV or external Redis
3. **Environment Variables**: Set in Vercel dashboard
4. **Edge Functions**: Deploy as serverless functions
5. **Domain**: Configure custom domain

### Docker / Self-Hosted

1. **Database**: Supabase (external)
2. **Redis**: Run Redis container or use external Redis
3. **Environment Variables**: Set in `.env` file or Docker Compose
4. **Reverse Proxy**: Configure nginx or similar for SSL termination

## Environment-Specific Configuration

### Production

```bash
NODE_ENV=production
NEXT_PUBLIC_APP_URL=https://app.servio.com
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
REDIS_URL=redis://user:pass@redis.example.com:6379
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
SENTRY_DSN=https://xxx@sentry.io/xxx
```

### Staging

```bash
NODE_ENV=staging
NEXT_PUBLIC_APP_URL=https://staging.servio.com
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
REDIS_URL=redis://user:pass@redis-staging.example.com:6379
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
SENTRY_DSN=https://xxx@sentry.io/xxx
```

### Development

```bash
NODE_ENV=development
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
# Redis is optional in development
# REDIS_URL=redis://localhost:6379
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
# Sentry is optional in development
# SENTRY_DSN=https://xxx@sentry.io/xxx
```

## Health Checks

### Required Health Endpoints

The application exposes the following health check endpoints:

- `GET /api/health`: Application health check
- `GET /api/ready`: Readiness check
- `GET /api/ping`: Simple ping endpoint

### Redis Health Check

Use the `checkRedisHealth()` function from `lib/rate-limit.ts`:

```typescript
import { checkRedisHealth } from '@/lib/rate-limit';

const health = await checkRedisHealth();
console.log(health);
// { healthy: true, latency: 123, error?: string }
```

## Scaling Considerations

### Horizontal Scaling

When scaling to multiple instances:

1. **Redis is Required**: Each instance must connect to the same Redis
2. **Shared State**: Rate limiting works across all instances
3. **Database**: Supabase handles connection pooling automatically
4. **Session Storage**: Use Redis or external session store for consistency

### Vertical Scaling

When increasing instance size:

1. **Memory**: Monitor Redis memory usage
2. **CPU**: Monitor rate limiting overhead
3. **Database**: Monitor Supabase connection limits

## Security Checklist

Before deploying to production:

- [ ] All environment variables are set
- [ ] Redis is configured and accessible
- [ ] Stripe keys are production keys (not test keys)
- [ ] Sentry DSN is configured
- [ ] HTTPS is enabled with valid SSL certificate
- [ ] CORS is configured correctly
- [ ] Rate limiting is tested
- [ ] Webhook endpoint is accessible from Stripe
- [ ] Database migrations have been run
- [ ] RLS policies are verified

## Troubleshooting

### Redis Connection Issues

**Symptom**: Application fails to start with Redis error

**Solutions**:
1. Verify `REDIS_URL` is correct
2. Check Redis is running and accessible
3. Verify network connectivity to Redis
4. Check Redis authentication credentials

### Rate Limiting Issues

**Symptom**: Users getting rate limited unexpectedly

**Solutions**:
1. Check Redis is working: `await checkRedisHealth()`
2. Review rate limit configurations
3. Check for distributed rate limit bypass (multiple instances)
4. Review rate limit metrics

### Stripe Webhook Issues

**Symptom**: Webhooks not being received

**Solutions**:
1. Verify webhook URL is accessible from Stripe
2. Check webhook secret matches
3. Review Stripe webhook logs
4. Check server logs for webhook processing errors

## Additional Resources

- [Supabase Documentation](https://supabase.com/docs)
- [Stripe Documentation](https://stripe.com/docs)
- [Redis Documentation](https://redis.io/documentation)
- [Railway Documentation](https://docs.railway.app)
- [Vercel Documentation](https://vercel.com/docs)
