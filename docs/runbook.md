# Production Incident Response Runbook

## Overview

This runbook covers common production incidents and response procedures for the Servio platform.

---

## Critical Incidents (P0)

### 1. Database Connection Exhaustion

**Symptoms:**
- `DatabaseConnectionExhaustion` alert triggered
- Users experiencing timeouts
- Elevated 5xx errors

**Immediate Response:**

1. Check current connection state:
   ```bash
   # Check Supabase dashboard or use:
   curl -H "Authorization: Bearer $SERVICE_KEY" \
     "$SUPABASE_URL/functions/v1/db-stats"
   ```

2. Identify source of connection leaks:
   ```bash
   # Check for long-running queries
   psql "$DATABASE_URL" -c "
     SELECT pid, state, query, query_start, pg_stat_activity.application_name
     FROM pg_stat_activity
     WHERE state = 'active'
     ORDER BY query_start;
   "
   ```

3. Mitigation actions:
   - If connections are leaking: Deploy connection pooling layer (`lib/db/connection-pool.ts`)
   - If at capacity: Scale Supabase plan or implement read replicas
   - If specific query: Kill long-running queries with `SELECT pg_terminate_backend(pid)`

**Recovery Steps:**
1. Monitor connection recovery in Grafana
2. Verify error rates return to normal
3. Document root cause

---

### 2. Payment Processing Failure

**Symptoms:**
- `PaymentProcessingFailure` alert triggered
- Users unable to complete orders
- Stripe webhook failures

**Immediate Response:**

1. Check Stripe dashboard for:
   - API outages
   - Rate limiting
   - Declined payments

2. Verify circuit breaker status:
   ```bash
   curl "$METRICS_ENDPOINT" | grep circuit_breaker
   ```

3. If circuit breaker is OPEN:
   - Check upstream service health
   - Consider forcing circuit breaker reset if upstream is healthy

**Circuit Breaker Reset:**
```typescript
import { circuitBreakerRegistry } from 'lib/resilience/circuit-breaker';

const stripeBreaker = circuitBreakerRegistry.get('stripe');
stripeBreaker?.forceState('HALF_OPEN');
```

**Recovery Steps:**
1. Monitor payment success rate in dashboard
2. Verify idempotency keys are working
3. Check for duplicate charge reports from customers

---

### 3. Webhook Security Alert

**Symptoms:**
- `WebhookVerificationFailure` alert triggered
- `WebhookReplayAttack` alert triggered
- Elevated webhook errors

**Immediate Response:**

1. Check webhook logs:
   ```bash
   grep "webhook_security" /var/log/app.log | tail -100
   ```

2. Identify attack pattern:
   - Timestamp expired: Possible replay attack
   - Signature invalid: Forged webhook
   - Tenant violation: Cross-tenant access attempt

3. Mitigation:
   - If replay attack: Implement stricter timestamp validation
   - If forged webhook: Rotate webhook secret
   - Block IP ranges if attack continues

**Rotate Stripe Webhook Secret:**
1. Go to Stripe Dashboard → Developers → Webhooks
2. Delete and recreate the webhook endpoint
3. Update `STRIPE_WEBHOOK_SECRET` in environment
4. Deploy immediately

---

### 4. Circuit Breaker Open (External Service)

**Symptoms:**
- `CircuitBreakerOpen` alert triggered
- Service X requests failing fast
- Elevated latency/errors for dependent features

**Immediate Response:**

1. Check external service health:
   - Stripe: status.stripe.com
   - Supabase: status.supabase.com
   - OpenAI: status.openai.com

2. If external service is down:
   - Document in status page
   - Enable fallback behavior if implemented
   - Monitor for recovery

3. If external service is healthy:
   - Circuit breaker may be stuck
   - Reset breaker manually:
   ```typescript
   const breaker = circuitBreakerRegistry.get('service-name');
   breaker?.forceState('HALF_OPEN');
   ```

---

## High Priority Incidents (P1)

### 5. High Error Rate

**Symptoms:**
- `HighErrorRate` alert triggered
- >5% of requests returning 5xx

**Immediate Response:**

1. Identify error patterns:
   ```bash
   tail -1000 /var/log/app.log | grep " 5[0-9][0-9] "
   ```

2. Check recent deployments:
   ```bash
   git log --oneline -10
   ```

3. If recent deployment:
   - Roll back to previous version
   - Investigate in staging

4. If no recent change:
   - Check infrastructure (database, cache, queue)
   - Check for traffic anomalies

**Rollback Procedure:**
```bash
git revert HEAD --no-commit
git commit -m "hotfix: rollback last deployment"
git push origin main
```

---

### 6. High Latency

**Symptoms:**
- `HighLatencyP95` or `HighLatencyP99` alert triggered
- Users reporting slow response times

**Immediate Response:**

1. Check latency breakdown:
   - Database queries
   - External API calls
   - Cache hit rate

2. Common causes:
   - Missing index on database
   - Cache miss storm
   - External API slow

3. If cache related:
   - Check `LowCacheHitRate` alert
   - Verify cache-coalescing is working
   - Consider flushing cache if corrupted

---

## Medium Priority Incidents (P2)

### 7. Cache Issues

**Symptoms:**
- `LowCacheHitRate` alert
- Elevated database load
- Slow responses

**Investigation:**

1. Check cache statistics:
   ```bash
   curl "$CACHE_METRICS_ENDPOINT" | grep cache_
   ```

2. Common issues:
   - Cache keys missing tenant isolation (audit with `lib/cache/cache-key-audit.ts`)
   - TTL too short
   - Cache stampede

**Cache Stampede Recovery:**
```typescript
import { CacheCoalescer } from 'lib/cache/coalescing-cache';

const cache = new CacheCoalescer({
  ttlMs: 30000,
  maxConcurrent: 10,
});

// Clear and repopulate
cache.clear();
```

---

### 8. Idempotency Issues

**Symptoms:**
- Reports of duplicate charges
- `HighIdempotencyKeyExpiry` alert

**Investigation:**

1. Check idempotency key store:
   ```typescript
   import { getIdempotencyResult } from 'lib/payments/idempotency';
   
   const result = getIdempotencyResult('idem:tenant:operation:scope');
   ```

2. Verify idempotency is being used in payment flows

**Recovery:**
- Use idempotency key for all payment operations
- Clean up expired keys periodically

---

## Escalation Policy

| Severity | Response Time | Escalation |
|----------|-------------|------------|
| P0 Critical | 15 min | CTO, All hands |
| P1 High | 1 hour | Engineering Lead |
| P2 Medium | 4 hours | On-call Engineer |
| P3 Low | 24 hours | Next business day |

---

## Communication Templates

### Status Page Update (P0)
```
🚨 Service Outage - Payment Processing

We are investigating issues with payment processing. Some users may be unable to complete orders.

Impact: ~X% of traffic affected
Status: Investigating
Next Update: 15 minutes

Workaround: Cash-only mode available at venues
```

### Customer Notification (P1)
```
⚠️ Payment Processing Delay

We're experiencing temporary delays with credit card processing. 

- Card payments may take longer than usual
- Cash payments work normally
- All pending transactions will be processed

We're working to resolve this quickly. Thank you for your patience.
```

---

## Post-Incident Review

After any P0 or P1 incident, complete:

1. **Timeline**: Detailed timeline of events
2. **Root Cause**: Technical root cause analysis
3. **Impact**: User/business impact assessment
4. **Fixes Applied**: Immediate fixes deployed
5. **Long-term Fixes**: Follow-up tickets created
6. **Lessons Learned**: What went well, what could improve

**Template**: See `docs/incident-report-template.md`

---

## Monitoring Quick Reference

| Dashboard | URL | Purpose |
|-----------|-----|---------|
| Production Metrics | grafana.servio.run/d/servio-production | Real-time health |
| Payment Metrics | grafana.servio.run/d/payments | Payment flow health |
| Infrastructure | grafana.servio.run/d/infrastructure | DB, Cache, Queue |
| Business Metrics | grafana.servio.run/d/business | Orders, Revenue |

**Alert Channels:**
- Critical: PagerDuty + Slack #alerts-critical
- Warning: Slack #alerts-warning
- Info: Slack #alerts-info
