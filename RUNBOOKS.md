# Servio Operational Runbooks

This document contains operational procedures for common tasks, troubleshooting, and maintenance operations for the Servio platform.

## Table of Contents

1. [Deployment](#deployment)
2. [Database Operations](#database-operations)
3. [Payment Processing](#payment-processing)
4. [Error Handling & Debugging](#error-handling--debugging)
5. [Monitoring & Health Checks](#monitoring--health-checks)
6. [Rollback Procedures](#rollback-procedures)
7. [Common Issues](#common-issues)

---

## Deployment

### Prerequisites

- All required environment variables are set in Railway dashboard
- Database migrations are up to date
- Tests pass locally: `pnpm validate`

### Deployment Steps

1. **Verify Environment Variables**
   ```bash
   # Check required variables are set
   pnpm run health:check
   ```

2. **Run Database Migrations** (if needed)
   ```bash
   pnpm run migrate:prod
   ```

3. **Deploy to Railway**
   - Push to `main` branch (auto-deploys)
   - Or manually trigger deployment in Railway dashboard

4. **Verify Deployment**
   - Check Railway logs for startup errors
   - Visit `/api/auth/health` endpoint
   - Test critical flows (order creation, payment)

### Post-Deployment Checklist

- [ ] Health check endpoint returns 200
- [ ] Can create a test order
- [ ] Payment flow works (test mode)
- [ ] Dashboard loads correctly
- [ ] No errors in Sentry (if configured)

---

## Database Operations

### Running Migrations

**Development:**
```bash
pnpm run migrate:auto
```

**Production:**
```bash
pnpm run migrate:prod
```

### Creating a New Migration

```bash
pnpm run migrate:create
# Follow prompts to name the migration
```

### Checking Migration Status

Connect to Supabase dashboard and check the `schema_migrations` table, or run:
```bash
# Check migration files vs database
ls supabase/migrations/
```

### Database Backup

Supabase automatically backs up the database. For manual backup:

1. Go to Supabase Dashboard → Database → Backups
2. Create a point-in-time backup if needed
3. Export schema: Use Supabase CLI or pg_dump

### Restoring from Backup

1. Go to Supabase Dashboard → Database → Backups
2. Select restore point
3. Confirm restore (this will overwrite current data)

---

## Payment Processing

### Stripe Webhook Configuration

1. **Get Webhook Secret**
   - Go to Stripe Dashboard → Developers → Webhooks
   - Copy the webhook signing secret
   - Set as `STRIPE_WEBHOOK_SECRET` in Railway

2. **Configure Webhook Endpoint**
   - URL: `https://your-domain.com/api/stripe/webhook`
   - Events to listen for:
     - `payment_intent.succeeded`
     - `payment_intent.payment_failed`
     - `checkout.session.completed`
     - `customer.subscription.updated`

3. **Test Webhook**
   ```bash
   # Use Stripe CLI for local testing
   stripe listen --forward-to localhost:3000/api/stripe/webhook
   ```

### Troubleshooting Payment Issues

**Payment Intent Not Created:**
1. Check Stripe API keys are correct
2. Verify `STRIPE_SECRET_KEY` is set in production
3. Check Railway logs for errors
4. Verify webhook secret matches Stripe dashboard

**Webhook Not Receiving Events:**
1. Check webhook endpoint is accessible
2. Verify webhook secret in Stripe dashboard matches `STRIPE_WEBHOOK_SECRET`
3. Check Railway logs for webhook processing errors
4. Review `stripe_webhook_events` table for received events

**Order Not Created After Payment:**
1. Check `/api/orders/createFromPaidIntent` logs
2. Verify payment intent status is `succeeded`
3. Check for idempotency conflicts
4. Review order creation flow in logs

### Replaying Failed Webhooks

1. Go to Stripe Dashboard → Developers → Webhooks
2. Find the failed event
3. Click "Send test webhook" or "Replay"
4. Monitor Railway logs for processing

---

## Error Handling & Debugging

### Checking Application Logs

**Railway:**
1. Go to Railway Dashboard → Your Service → Logs
2. Filter by level (error, warn, info)
3. Search for specific error messages

**Local Development:**
```bash
# View logs in real-time
pnpm dev
# Logs appear in console
```

### Common Error Patterns

**Database Connection Errors:**
- Symptom: "Database connection error" or Supabase errors
- Check: `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`
- Solution: Verify Supabase project is active and keys are correct

**Authentication Errors:**
- Symptom: 401 Unauthorized errors
- Check: Supabase auth configuration
- Solution: Verify `NEXT_PUBLIC_SUPABASE_ANON_KEY` is set correctly

**Payment Processing Errors:**
- Symptom: Payment fails or order not created
- Check: Stripe keys and webhook configuration
- Solution: See [Payment Processing](#payment-processing) section

### Debugging Production Issues

1. **Check Sentry** (if configured)
   - Go to Sentry dashboard
   - Review error frequency and stack traces
   - Check user context and breadcrumbs

2. **Use Debug Endpoints**
   - `/api/debug/counts?venueId=xxx` - Check database counts
   - `/api/auth/health` - Check system health
   - `/api/test-log` - Test logging (development only)

3. **Review Application Logs**
   - Railway logs show structured logging
   - Search for correlation IDs from error messages
   - Check for rate limiting issues

---

## Monitoring & Health Checks

### Health Check Endpoint

**Endpoint:** `GET /api/auth/health`

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-01-15T10:30:00Z",
  "environment": "production",
  "auth": {
    "sessionStatus": "active",
    "hasUser": true
  },
  "supabase": {
    "url": "configured",
    "key": "configured",
    "serviceKey": "configured"
  }
}
```

### Setting Up Monitoring

**Sentry (Recommended):**
1. Create Sentry project
2. Get DSN from Sentry dashboard
3. Set `SENTRY_DSN` in Railway
4. Set `SENTRY_AUTH_TOKEN` for releases

**Uptime Monitoring:**
- Use services like UptimeRobot or Pingdom
- Monitor `/api/auth/health` endpoint
- Set alert threshold (e.g., 2 failures in 5 minutes)

### Key Metrics to Monitor

- **Error Rate:** Should be < 1% of requests
- **Response Time:** P95 should be < 500ms
- **Payment Success Rate:** Should be > 99%
- **Database Connection:** Should be stable
- **Memory Usage:** Monitor for leaks

---

## Rollback Procedures

### Quick Rollback (Railway)

1. Go to Railway Dashboard → Your Service → Deployments
2. Find the previous successful deployment
3. Click "Redeploy"
4. Verify health check passes

### Database Rollback

**If migration caused issues:**
1. Identify the problematic migration
2. Create a rollback migration
3. Run: `pnpm run migrate:prod`
4. Verify data integrity

**If data corruption occurred:**
1. Go to Supabase Dashboard → Database → Backups
2. Restore from point-in-time backup
3. Verify critical data is restored

### Code Rollback

```bash
# On local machine
git checkout <previous-commit-hash>
git push origin main --force  # Only if necessary
```

**⚠️ Warning:** Force pushing to main should be avoided. Prefer creating a revert commit.

---

## Common Issues

### Issue: Application Won't Start

**Symptoms:**
- Railway deployment fails
- Health check returns 500
- Logs show environment variable errors

**Solution:**
1. Check all required environment variables are set
2. Verify variable names match exactly (case-sensitive)
3. Check for typos in values
4. Review startup logs for specific missing variable

### Issue: Orders Not Appearing in Dashboard

**Symptoms:**
- Order created successfully
- Payment processed
- Order not visible in dashboard

**Solution:**
1. Check order status filter in dashboard
2. Verify venue_id matches
3. Check for RLS (Row Level Security) issues
4. Review `orders` table directly in Supabase

### Issue: Payment Webhooks Not Processing

**Symptoms:**
- Payment succeeds in Stripe
- Order status not updated
- Webhook events not in database

**Solution:**
1. Verify webhook endpoint is accessible
2. Check webhook secret matches
3. Review Railway logs for webhook processing
4. Check `stripe_webhook_events` table for received events
5. Manually replay webhook from Stripe dashboard

### Issue: Rate Limiting Too Aggressive

**Symptoms:**
- Legitimate users getting 429 errors
- Rate limits resetting too slowly

**Solution:**
1. Check Redis connection (if using Redis)
2. Review rate limit configuration in `lib/rate-limit.ts`
3. Adjust limits for specific endpoints if needed
4. Check for IP-based rate limiting issues

### Issue: Slow Performance

**Symptoms:**
- Pages load slowly
- API responses are slow
- Database queries timing out

**Solution:**
1. Check database connection pool size
2. Review slow query logs in Supabase
3. Check for N+1 query problems
4. Review bundle size (should be < 1.5MB)
5. Check Railway resource allocation

---

## Emergency Contacts & Resources

### Critical Services

- **Railway Dashboard:** https://railway.app
- **Supabase Dashboard:** https://app.supabase.com
- **Stripe Dashboard:** https://dashboard.stripe.com
- **Sentry Dashboard:** (if configured)

### Support Resources

- **Documentation:** See README.md
- **API Documentation:** `/api-docs` when app is running
- **Error Tracking:** Sentry (if configured)

### Escalation

For critical production issues:
1. Check health endpoint
2. Review recent deployments
3. Check Sentry for error patterns
4. Review Railway logs
5. If unresolved, consider rollback

---

## Maintenance Windows

### Recommended Maintenance Schedule

- **Weekly:** Review error logs and Sentry reports
- **Monthly:** Review database performance and optimize queries
- **Quarterly:** Security audit and dependency updates

### Low-Traffic Maintenance

Best times for maintenance:
- Early morning (2-4 AM local time)
- Weekends
- Low-traffic periods

---

**Last Updated:** 2025-01-15
**Version:** 1.0
