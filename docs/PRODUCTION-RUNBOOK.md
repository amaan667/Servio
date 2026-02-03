# Production Runbook

This runbook provides step-by-step procedures for diagnosing and resolving common production issues.

## Table of Contents

1. [Application Not Responding](#application-not-responding)
2. [High Error Rates](#high-error-rates)
3. [Payment Failures](#payment-failures)
4. [Database Connection Issues](#database-connection-issues)
5. [Redis Connection Issues](#redis-connection-issues)
6. [Rate Limiting Issues](#rate-limiting-issues)
7. [Stripe Webhook Failures](#stripe-webhook-failures)
8. [Multi-tenant Data Leakage](#multi-tenant-data-leakage)
9. [Performance Degradation](#performance-degradation)
10. [Deployment Rollback](#deployment-rollback)

---

## Application Not Responding

### Symptoms

- Application returns 502/503 errors
- Health check endpoints failing
- Increased latency across all endpoints

### Diagnosis

1. Check application logs:
   ```bash
   # Railway logs
   railway logs
   
   # Or check Sentry for errors
   ```

2. Check server resources:
   ```bash
   # CPU and memory usage
   railway status
   ```

3. Check database connectivity:
   ```bash
   # Test Supabase connection
   curl -I https://xxx.supabase.co/rest/v1/
   ```

4. Check Redis connectivity:
   ```bash
   # Test Redis connection
   redis-cli -h redis.example.com -p 6379 ping
   ```

### Resolution

**If database is down**:
1. Check Supabase status page: https://status.supabase.com
2. Wait for Supabase to restore service
3. No action needed - application will auto-recover

**If Redis is down**:
1. Check Redis service status
2. Restart Redis if needed
3. Verify `REDIS_URL` environment variable

**If server is overloaded**:
1. Scale up server resources
2. Check for memory leaks
3. Review recent deployments for issues

**If application crashed**:
1. Check Sentry for crash reports
2. Review recent code changes
3. Rollback to previous deployment if needed

---

## High Error Rates

### Symptoms

- Increased 500 errors
- Spike in Sentry error reports
- User complaints about errors

### Diagnosis

1. Check Sentry error dashboard:
   - Look for error patterns
   - Identify most common errors
   - Check for recent deployments

2. Check application logs:
   ```bash
   railway logs --tail
   ```

3. Check database performance:
   - Slow queries
   - Connection pool exhaustion
   - Lock contention

### Resolution

**If database slow queries**:
1. Add indexes to slow queries
2. Optimize query patterns
3. Consider read replicas for heavy read loads

**If connection pool exhausted**:
1. Increase connection pool size
2. Add connection timeout
3. Implement connection pooling

**If recent deployment caused issues**:
1. Rollback to previous version
2. Investigate deployment changes
3. Fix issues and redeploy

---

## Payment Failures

### Symptoms

- Users unable to complete payments
- Stripe webhooks not being received
- Payment status not updating

### Diagnosis

1. Check Stripe dashboard:
   - View recent payment attempts
   - Check webhook delivery status
   - Review webhook logs

2. Check webhook endpoint:
   ```bash
   # Test webhook endpoint
   curl -X POST https://app.servio.com/api/stripe/webhook \
     -H "Content-Type: application/json" \
     -d '{"test": true}'
   ```

3. Check application logs:
   ```bash
   railway logs --filter webhook
   ```

4. Verify webhook secret:
   ```bash
   # Check environment variable
   echo $STRIPE_WEBHOOK_SECRET
   ```

### Resolution

**If webhook not receiving events**:
1. Verify webhook URL is accessible from Stripe
2. Check webhook secret matches Stripe
3. Verify SSL certificate is valid
4. Check firewall rules allow Stripe IPs

**If webhook processing failing**:
1. Check webhook handler logs
2. Verify idempotency key handling
3. Check database connection during webhook processing
4. Retry failed webhook events from Stripe dashboard

**If payment status not updating**:
1. Check webhook event processing
2. Verify database updates are succeeding
3. Check for race conditions in payment flow
4. Verify transaction isolation

---

## Database Connection Issues

### Symptoms

- Database connection errors
- Slow query performance
- Connection timeout errors

### Diagnosis

1. Check Supabase status:
   - Visit https://status.supabase.com
   - Check for incidents

2. Test database connection:
   ```bash
   # From application server
   psql $DATABASE_URL -c "SELECT 1;"
   ```

3. Check connection pool metrics:
   - Active connections
   - Idle connections
   - Connection wait time

4. Review slow query log:
   - Queries taking >1 second
   - Queries with high row counts

### Resolution

**If connection pool exhausted**:
1. Increase pool size in configuration
2. Reduce connection timeout
3. Implement connection reuse
4. Add connection backoff

**If slow queries detected**:
1. Add appropriate indexes
2. Optimize query patterns
3. Use `EXPLAIN ANALYZE` on slow queries
4. Consider materialized views for complex queries

**If database at capacity**:
1. Contact Supabase support
2. Consider upgrading plan
3. Implement query caching
4. Add read replicas for read-heavy workloads

---

## Redis Connection Issues

### Symptoms

- Rate limiting not working
- Cache misses increasing
- Redis connection errors in logs

### Diagnosis

1. Check Redis health:
   ```typescript
   import { checkRedisHealth } from '@/lib/rate-limit';
   const health = await checkRedisHealth();
   console.log(health);
   ```

2. Test Redis connection:
   ```bash
   redis-cli -h redis.example.com -p 6379 ping
   ```

3. Check Redis metrics:
   - Memory usage
   - Connection count
   - Command rate

4. Check environment variables:
   ```bash
   echo $REDIS_URL
   ```

### Resolution

**If Redis is down**:
1. Restart Redis service
2. Check Redis configuration
3. Verify network connectivity
4. Check Redis logs for errors

**If Redis at capacity**:
1. Increase Redis memory limit
2. Implement cache eviction policy
3. Reduce cache TTL values
4. Add Redis clustering

**If connection issues**:
1. Verify `REDIS_URL` format
2. Check authentication credentials
3. Check network firewall rules
4. Verify DNS resolution

---

## Rate Limiting Issues

### Symptoms

- Users getting rate limited unexpectedly
- Rate limit not working across instances
- Inconsistent rate limiting behavior

### Diagnosis

1. Check rate limit metrics:
   ```typescript
   import { getRateLimitMetrics } from '@/lib/rate-limit';
   const metrics = getRateLimitMetrics('/api/orders');
   console.log(metrics);
   ```

2. Check Redis is working:
   ```bash
   redis-cli -h redis.example.com -p 6379 ping
   ```

3. Check rate limit configuration:
   - Review `RATE_LIMITS` configuration
   - Check per-endpoint limits
   - Verify window sizes

4. Check for distributed bypass:
   - Multiple server instances
   - Each with in-memory fallback
   - Not sharing Redis state

### Resolution

**If Redis not configured in production**:
1. Set `REDIS_URL` environment variable
2. Restart application
3. Verify rate limiting is using Redis
4. Monitor rate limit metrics

**If rate limits too strict**:
1. Review rate limit configurations
2. Adjust limits based on traffic patterns
3. Implement tiered rate limiting
4. Add rate limit whitelisting for trusted IPs

**If rate limits too lenient**:
1. Review abuse patterns
2. Implement stricter limits
3. Add CAPTCHA for suspicious requests
4. Implement IP-based blocking

---

## Stripe Webhook Failures

### Symptoms

- Webhooks not being received
- Webhook processing errors
- Duplicate webhook events

### Diagnosis

1. Check Stripe webhook logs:
   - View in Stripe Dashboard
   - Check delivery status
   - Review response codes

2. Check webhook endpoint:
   ```bash
   # Test webhook endpoint
   curl -X POST https://app.servio.com/api/stripe/webhook \
     -H "Content-Type: application/json" \
     -H "Stripe-Signature: test" \
     -d '{"test": true}'
   ```

3. Check webhook signature verification:
   - Verify `STRIPE_WEBHOOK_SECRET` is set
   - Check signature verification code
   - Review recent changes to webhook handler

4. Check idempotency handling:
   - Verify idempotency keys are stored
   - Check for duplicate event handling
   - Review idempotency key generation

### Resolution

**If webhook signature verification failing**:
1. Verify `STRIPE_WEBHOOK_SECRET` matches Stripe
2. Check signature verification code
3. Ensure webhook endpoint is HTTPS
4. Verify timestamp tolerance (within 5 minutes)

**If webhook events being duplicated**:
1. Check idempotency key storage
2. Verify idempotency key lookup before processing
3. Add idempotency key to database before processing
4. Return cached response for duplicate keys

**If webhook processing failing**:
1. Check webhook handler error logs
2. Verify database connection during processing
3. Add retry logic for transient failures
4. Implement webhook event queue

---

## Multi-tenant Data Leakage

### Symptoms

- Users seeing data from other venues
- Cross-tenant access possible
- RLS policies being bypassed

### Diagnosis

1. Check for `createAdminClient` usage:
   ```bash
   # Search for service role key usage
   grep -r "createAdminClient" lib/ app/
   ```

2. Review RLS policies:
   - Check Supabase RLS policy definitions
   - Verify policies are enabled
   - Test policy enforcement

3. Test cross-tenant access:
   - Create test users for different venues
   - Attempt to access other venue data
   - Verify access is denied

4. Review AI tool queries:
   - Check for tenant_id filtering
   - Verify venue_id is used in queries
   - Review for missing WHERE clauses

### Resolution

**If `createAdminClient` used in non-admin code**:
1. Replace with RLS-respecting client
2. Add tenant_id filtering to queries
3. Create separate admin API routes
4. Add linting rule to prevent future usage

**If RLS policies not enforced**:
1. Verify RLS is enabled on all tables
2. Test RLS policies with different users
3. Review policy definitions for correctness
4. Add integration tests for RLS enforcement

**If AI tools bypassing RLS**:
1. Add tenant_id parameter to all AI tool functions
2. Verify venue_id is passed from context
3. Add security tests for cross-tenant access
4. Document RLS requirements for AI tools

---

## Performance Degradation

### Symptoms

- Increased response times
- Slow page loads
- Database query timeouts

### Diagnosis

1. Check application performance:
   - Monitor response times
   - Check error rates
   - Review throughput metrics

2. Check database performance:
   - Review slow query log
   - Check connection pool metrics
   - Monitor database CPU usage

3. Check cache hit rates:
   ```typescript
   import { getRateLimitMetrics } from '@/lib/rate-limit';
   const metrics = getRateLimitMetrics();
   console.log(metrics);
   ```

4. Check CDN performance:
   - Monitor asset load times
   - Check CDN cache hit rates
   - Review CDN configuration

### Resolution

**If database slow**:
1. Add indexes to slow queries
2. Optimize query patterns
3. Implement query result caching
4. Consider read replicas

**If cache misses high**:
1. Increase cache TTL values
2. Implement cache warming
3. Add cache invalidation strategy
4. Monitor cache hit rates

**If bundle size large**:
1. Run bundle analyzer: `pnpm run build:analyze`
2. Implement code splitting
3. Lazy load non-critical components
4. Optimize vendor bundle

**If CDN slow**:
1. Configure CDN caching headers
2. Preload critical assets
3. Use CDN edge caching
4. Optimize asset sizes

---

## Deployment Rollback

### Symptoms

- New deployment causing issues
- Need to revert to previous version
- Deployment failed mid-process

### Diagnosis

1. Check deployment status:
   ```bash
   # Railway
   railway status
   
   # Vercel
   vercel ls
   ```

2. Review recent deployments:
   - Check deployment logs
   - Review error rates
   - Identify breaking changes

3. Test previous version:
   - Deploy previous version to staging
   - Test critical functionality
   - Verify issues are resolved

### Resolution

**Immediate rollback**:
1. Revert to previous commit:
   ```bash
   git revert HEAD~1
   git push
   ```

2. Redeploy previous version:
   ```bash
   # Railway
   railway up
   
   # Vercel
   vercel --prod
   ```

3. Verify rollback:
   - Check application health
   - Test critical functionality
   - Monitor error rates

**Investigation**:
1. Review code changes in failed deployment
2. Check for breaking changes
3. Review database migrations
4. Review environment variable changes

**Prevention**:
1. Add feature flags for risky changes
2. Implement canary deployments
3. Add automated testing before deployment
4. Monitor deployment metrics

---

## Emergency Contacts

- **On-Call Engineer**: [Contact Information]
- **Database Support**: Supabase Support
- **Stripe Support**: Stripe Support Portal
- **Infrastructure**: Railway/Vercel Support

---

## Related Documentation

- [Deployment Requirements](./DEPLOYMENT-REQUIREMENTS.md)
- [Architecture Documentation](./ARCHITECTURE.md)
- [Security Strategy](./docs/adr/0018-security-strategy.md)
- [Monitoring Strategy](./docs/adr/0030-monitoring-alerting.md)
