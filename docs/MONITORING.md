# Monitoring & Alerting Guide

## Overview

Servio uses multiple monitoring tools to track application health, performance, and errors:
- **Sentry** - Error tracking and performance monitoring
- **Railway Logs** - Application logs
- **Health Checks** - Application health endpoints
- **Web Vitals** - Frontend performance metrics

## Monitoring Stack

### 1. Error Tracking (Sentry)

**Purpose**: Track errors, exceptions, and performance issues

**Setup**:
- DSN configured in `NEXT_PUBLIC_SENTRY_DSN`
- Automatic error capture via `@sentry/nextjs`
- Client-side and server-side tracking

**Access**:
- Production: https://sentry.io/organizations/your-org/projects/servio/
- View errors, performance, releases, and user feedback

**Key Metrics**:
- Error rate
- Error frequency
- Affected users
- Performance (p95, p99 latency)

### 2. Application Logs (Railway)

**Purpose**: Real-time application logs and debugging

**Access**:
- Railway Dashboard → Service → Logs
- Filter by deployment, time range, or search

**Log Levels**:
- `error` - Critical errors
- `warn` - Warnings
- `info` - Informational messages
- `debug` - Debug information (development only)

**Log Format**:
```json
{
  "level": "error",
  "message": "Error message",
  "timestamp": "2025-12-19T12:00:00.000Z",
  "correlationId": "uuid",
  "context": {
    "userId": "uuid",
    "venueId": "venue-xxx",
    "endpoint": "/api/orders"
  }
}
```

### 3. Health Checks

**Endpoints**:
- `/api/health` - Basic health check (liveness probe)
- `/api/ready` - Readiness check (checks dependencies)

**Usage**:
- Railway uses these for health monitoring
- External monitoring tools can ping these endpoints
- Returns 200 OK when healthy, 500 when unhealthy

### 4. Web Vitals

**Purpose**: Track frontend performance metrics

**Metrics Tracked**:
- **LCP** (Largest Contentful Paint) - Loading performance
- **FID** (First Input Delay) - Interactivity
- **CLS** (Cumulative Layout Shift) - Visual stability
- **TTFB** (Time to First Byte) - Server response time

**Access**:
- Sentry → Performance → Web Vitals
- Browser DevTools → Performance

## Alerting Strategy

### Critical Alerts (P0 - Immediate Response)

Trigger conditions:
- Application is down (health check fails for 5+ minutes)
- Error rate > 10% for 5 minutes
- Database connection failures
- Payment processing failures
- Stripe webhook failures

**Notification Channels**:
- Email to on-call engineer
- Slack/Teams alert
- PagerDuty (if configured)

**Response Time**: < 15 minutes

### High Priority Alerts (P1 - Urgent)

Trigger conditions:
- Error rate > 5% for 10 minutes
- API response time p95 > 2s for 10 minutes
- Database query time > 1s for 10 minutes
- Memory usage > 90%
- CPU usage > 90% for 10 minutes

**Notification Channels**:
- Email to team
- Slack/Teams notification

**Response Time**: < 1 hour

### Medium Priority Alerts (P2 - Important)

Trigger conditions:
- Error rate > 2% for 30 minutes
- API response time p95 > 1s for 30 minutes
- Failed login attempts > 100 in 5 minutes
- Rate limit exceeded > 1000 times in 5 minutes

**Notification Channels**:
- Email to team
- Daily digest

**Response Time**: < 4 hours

### Low Priority Alerts (P3 - Informational)

Trigger conditions:
- Error rate > 1% for 1 hour
- Unusual traffic patterns
- Slow queries (warnings only)

**Notification Channels**:
- Daily/weekly digest
- Dashboard only

**Response Time**: Next business day

## Alerting Implementation

### Recommended Tools

1. **Sentry Alerts** (Primary)
   - Configure alert rules in Sentry
   - Set thresholds for error rate, response time
   - Configure notification channels

2. **Railway Alerts** (Infrastructure)
   - CPU/Memory usage alerts
   - Deployment failure alerts
   - Service down alerts

3. **Custom Monitoring** (Optional)
   - Uptime monitoring (UptimeRobot, Pingdom)
   - External health checks
   - Custom dashboards (Grafana, DataDog)

### Setting Up Sentry Alerts

1. Go to Sentry → Alerts → Create Alert Rule
2. Configure conditions:
   - Error count > threshold
   - Error rate > threshold
   - Response time > threshold
3. Set notification channels (email, Slack, PagerDuty)
4. Test alert rule

### Example Alert Rules

#### High Error Rate
```
Condition: Issue count > 50 in 5 minutes
Actions:
  - Send email to on-call@servio.uk
  - Post to #servio-alerts Slack channel
  - Create PagerDuty incident (if configured)
```

#### Slow Response Time
```
Condition: Transaction p95 latency > 2s for 10 minutes
Actions:
  - Send email to team@servio.uk
  - Post to #servio-performance Slack channel
```

#### Payment Processing Failure
```
Condition: Error tags include "payment" or "stripe"
Actions:
  - Send email to on-call@servio.uk
  - Send SMS to on-call engineer (if configured)
  - Create PagerDuty incident (P0)
```

## SLA/SLO Definitions

### Service Level Objectives (SLOs)

#### Availability
- **Target**: 99.9% uptime (43.2 minutes downtime/month)
- **Measurement**: Health check endpoint availability
- **Exclusions**: Scheduled maintenance, external dependencies

#### Performance
- **Target**: p95 API response time < 500ms
- **Target**: p99 API response time < 1s
- **Measurement**: API endpoint response times

#### Error Rate
- **Target**: < 0.1% error rate (1 error per 1000 requests)
- **Measurement**: 5xx errors / total requests
- **Exclusions**: 4xx client errors, rate limit errors

#### Payment Processing
- **Target**: 99.95% success rate
- **Measurement**: Successful payments / total payment attempts
- **Exclusions**: User-cancelled payments, invalid cards

### Service Level Agreements (SLAs)

For Enterprise customers:
- **Availability SLA**: 99.9% uptime
- **Response Time SLA**: p95 < 500ms, p99 < 1s
- **Support SLA**: 4-hour response time for critical issues
- **Payment SLA**: 99.95% success rate

## Incident Response

### Incident Severity Levels

#### P0 - Critical (Outage)
- **Definition**: Service completely down or unusable
- **Examples**: Application crash, database unavailable, payment processing down
- **Response Time**: < 15 minutes
- **Resolution Target**: < 1 hour

#### P1 - High (Major Impact)
- **Definition**: Significant functionality degraded
- **Examples**: High error rate, slow performance, payment issues
- **Response Time**: < 1 hour
- **Resolution Target**: < 4 hours

#### P2 - Medium (Moderate Impact)
- **Definition**: Some functionality affected
- **Examples**: Errors affecting subset of users, performance degradation
- **Response Time**: < 4 hours
- **Resolution Target**: < 24 hours

#### P3 - Low (Minor Impact)
- **Definition**: Minimal impact, workaround available
- **Examples**: UI bugs, minor errors
- **Response Time**: Next business day
- **Resolution Target**: Next release

### Incident Response Process

1. **Detection**
   - Monitor receives alert
   - Engineer notified via configured channel

2. **Triage**
   - Assess severity (P0-P3)
   - Confirm incident (not false positive)
   - Create incident ticket (GitHub Issue or Jira)

3. **Response**
   - Assign on-call engineer
   - Begin investigation
   - Update status page (if public-facing)

4. **Resolution**
   - Implement fix
   - Verify resolution
   - Monitor for recurrence

5. **Post-Incident**
   - Write post-mortem (within 48 hours)
   - Identify root cause
   - Document prevention measures
   - Update runbooks

### On-Call Rotation

**Recommended Setup**:
- **Primary**: 1 engineer (24/7 coverage)
- **Secondary**: 1 engineer (backup)
- **Rotation**: Weekly rotation (Monday 9am switch)

**Responsibilities**:
- Respond to P0/P1 alerts within SLA
- Investigate and resolve incidents
- Escalate if needed
- Document incidents

## Dashboards

### Recommended Dashboards

1. **Overview Dashboard** (Sentry/Railway)
   - Error rate (last 24h)
   - Request rate
   - Response time (p50, p95, p99)
   - Active users
   - Top errors

2. **Performance Dashboard**
   - API endpoint performance
   - Database query performance
   - Cache hit rates
   - Web vitals (frontend)

3. **Infrastructure Dashboard** (Railway)
   - CPU/Memory usage
   - Network traffic
   - Disk usage
   - Deployment status

4. **Business Metrics Dashboard** (Custom)
   - Orders per hour
   - Revenue
   - Payment success rate
   - Active venues

## Best Practices

1. **Set Reasonable Thresholds**
   - Start conservative, adjust based on baseline
   - Avoid alert fatigue (too many alerts)

2. **Use Correlation IDs**
   - Include correlation IDs in logs
   - Track requests across services
   - Easier debugging

3. **Document Runbooks**
   - Common incident procedures
   - Escalation paths
   - Contact information

4. **Regular Review**
   - Review alerts weekly
   - Tune thresholds monthly
   - Update runbooks after incidents

5. **Test Alerting**
   - Test alert rules regularly
   - Verify notification channels
   - Conduct fire drills

## Tools & Services

### Current Stack
- **Error Tracking**: Sentry
- **Logs**: Railway
- **Health Checks**: Custom endpoints
- **Uptime**: Railway monitoring

### Recommended Additions
- **Uptime Monitoring**: UptimeRobot, Pingdom (free tier available)
- **Advanced Logging**: LogTail, Better Stack (optional)
- **APM**: Sentry Performance (already included)
- **Custom Dashboards**: Grafana (if needed)

## Support

For monitoring questions:
- **Sentry Docs**: https://docs.sentry.io
- **Railway Docs**: https://docs.railway.app
- **Team**: Check internal documentation

---

**Last Updated:** December 2025  
**Version:** 0.1.6

