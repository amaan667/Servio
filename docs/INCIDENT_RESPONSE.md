# Incident Response Plan

## Overview

This document defines the incident response process for Servio. It covers detection, triage, response, resolution, and post-incident procedures.

## Incident Severity Levels

### P0 - Critical (Outage)

**Definition**: Service completely down or unusable for all users.

**Examples**:
- Application crash (500 errors for all requests)
- Database unavailable
- Payment processing completely down
- Authentication service down
- Deployment failure blocking all traffic

**Response Time**: < 15 minutes  
**Resolution Target**: < 1 hour  
**Notification**: On-call engineer + Team lead + CTO

---

### P1 - High (Major Impact)

**Definition**: Significant functionality degraded, affecting majority of users.

**Examples**:
- Error rate > 10%
- API response time > 5s
- Payment processing failures (> 5% failure rate)
- Database performance degradation
- Critical feature broken (orders not processing)

**Response Time**: < 1 hour  
**Resolution Target**: < 4 hours  
**Notification**: On-call engineer + Team lead

---

### P2 - Medium (Moderate Impact)

**Definition**: Some functionality affected, subset of users impacted.

**Examples**:
- Error rate 2-10%
- API response time 1-5s
- Payment processing issues (< 5% failure rate)
- Feature bugs affecting specific workflows
- Performance degradation for specific endpoints

**Response Time**: < 4 hours  
**Resolution Target**: < 24 hours  
**Notification**: On-call engineer

---

### P3 - Low (Minor Impact)

**Definition**: Minimal impact, workaround available.

**Examples**:
- UI bugs
- Minor errors (< 2% error rate)
- Non-critical feature issues
- Performance issues affecting < 1% of requests

**Response Time**: Next business day  
**Resolution Target**: Next release  
**Notification**: Daily digest

---

## Incident Response Process

### 1. Detection

**Sources**:
- Sentry alerts (error tracking)
- Railway alerts (infrastructure)
- Health check failures
- User reports
- Manual detection

**Actions**:
- Alert triggered → Engineer notified
- Verify incident (not false positive)
- Assess initial severity

---

### 2. Triage

**Initial Assessment**:
1. **Confirm Incident**
   - Is service actually affected?
   - Check health endpoints
   - Review error logs
   - Test user-facing functionality

2. **Assess Impact**
   - How many users affected?
   - Which features affected?
   - Is there a workaround?

3. **Determine Severity**
   - P0: Complete outage
   - P1: Major degradation
   - P2: Moderate impact
   - P3: Minor impact

4. **Create Incident Ticket**
   - GitHub Issue (label: `incident`)
   - Or internal ticketing system
   - Include: severity, description, affected systems

---

### 3. Response

**Immediate Actions**:

1. **Acknowledge Incident**
   - Respond to alert/notification
   - Update incident ticket
   - Notify team (if P0/P1)

2. **Investigate**
   - Check Sentry for error details
   - Review Railway logs
   - Check database status
   - Review recent deployments

3. **Communicate Status**
   - Update incident ticket with findings
   - Post to team channel (Slack/Teams)
   - Update status page (if public-facing)

4. **Contain Impact** (if possible)
   - Rollback deployment (if recent deploy)
   - Disable feature flag (if feature issue)
   - Rate limit (if abuse/load issue)
   - Emergency maintenance mode (if needed)

---

### 4. Resolution

**Fix Implementation**:

1. **Identify Root Cause**
   - Analyze logs and errors
   - Review recent changes
   - Check external dependencies

2. **Implement Fix**
   - Code fix (if application issue)
   - Configuration change (if config issue)
   - Infrastructure change (if infra issue)
   - Rollback (if deployment issue)

3. **Verify Resolution**
   - Test fix locally/staging
   - Deploy to production
   - Monitor for recurrence
   - Verify health checks pass

4. **Communication**
   - Update incident ticket (resolved)
   - Notify team (incident resolved)
   - Update status page (if public-facing)

---

### 5. Post-Incident

**Within 24 Hours**:

1. **Update Incident Ticket**
   - Mark as resolved
   - Add resolution summary
   - Document root cause
   - Add timeline

2. **Monitor**
   - Watch for recurrence (24-48 hours)
   - Monitor error rates
   - Check performance metrics

**Within 48 Hours**:

1. **Post-Mortem**
   - Schedule post-mortem meeting (for P0/P1)
   - Document incident timeline
   - Identify root cause
   - Document lessons learned

2. **Action Items**
   - Create GitHub Issues for improvements
   - Update runbooks
   - Update monitoring/alerting
   - Schedule follow-up tasks

**Within 1 Week**:

1. **Review**
   - Review incident with team
   - Update processes if needed
   - Implement prevention measures
   - Close action items

---

## On-Call Rotation

### Schedule

- **Primary**: 1 engineer (24/7 coverage)
- **Secondary**: 1 engineer (backup)
- **Rotation**: Weekly (Monday 9am switch)

### Responsibilities

**Primary On-Call**:
- Respond to P0/P1 alerts within SLA
- Investigate and resolve incidents
- Escalate to team lead if needed
- Update incident tickets

**Secondary On-Call**:
- Backup if primary unavailable
- Support primary if needed
- Review incidents during business hours

### Handoff Process

1. **Daily Handoff** (9am)
   - Review overnight incidents
   - Share context on ongoing issues
   - Update runbooks if needed

2. **Weekly Rotation** (Monday 9am)
   - Transfer on-call responsibility
   - Review previous week's incidents
   - Update documentation

---

## Escalation Path

### Level 1: On-Call Engineer
- Handles P2/P3 incidents
- Investigates P0/P1 incidents
- Escalates if unable to resolve

### Level 2: Team Lead
- Assists with P0/P1 incidents
- Coordinates response
- Makes decisions on rollbacks/features

### Level 3: CTO/Engineering Manager
- P0 incidents only
- Strategic decisions
- External communication

### Escalation Triggers

- P0 incident (> 15 minutes without resolution)
- P1 incident (> 1 hour without resolution)
- Unable to identify root cause
- Need additional resources
- Business-critical decision needed

---

## Communication

### Internal Communication

**Channels**:
- **Slack/Teams**: `#servio-incidents` (or similar)
- **Email**: `on-call@servio.uk`
- **Incident Ticket**: GitHub Issue or Jira

**Updates**:
- P0: Updates every 15 minutes
- P1: Updates every 30 minutes
- P2: Updates every 2 hours
- P3: Daily digest

### External Communication

**Status Page** (if public-facing):
- Update with incident status
- Post updates every 30 minutes (P0/P1)
- Post resolution announcement

**Customer Communication**:
- P0/P1: Email affected customers (if applicable)
- Include: incident description, resolution timeline, impact
- Post-resolution: Summary email

---

## Common Incidents & Runbooks

### Application Crash (500 Errors)

1. **Check Health Endpoints**
   ```bash
   curl https://servio-production.up.railway.app/api/health
   curl https://servio-production.up.railway.app/api/ready
   ```

2. **Review Logs**
   - Railway Dashboard → Logs
   - Filter by error level
   - Check recent errors

3. **Check Recent Deployments**
   - Railway Dashboard → Deployments
   - Review last 3 deployments
   - Check deployment logs

4. **Rollback** (if recent deploy)
   ```bash
   railway rollback --service servio-production
   ```

5. **Check Database**
   - Supabase Dashboard → Database
   - Verify connection
   - Check query performance

---

### Database Issues

1. **Check Supabase Status**
   - Supabase Dashboard
   - Check connection status
   - Review query performance

2. **Review Database Logs**
   - Supabase Dashboard → Logs
   - Check for connection errors
   - Check for slow queries

3. **Verify Migrations**
   - Check migration status
   - Verify no failed migrations
   - Review recent migrations

4. **Scale Database** (if needed)
   - Supabase Dashboard → Settings → Database
   - Scale up if resource-constrained

---

### Payment Processing Failures

1. **Check Stripe Status**
   - Stripe Status Page
   - Check for outages

2. **Review Stripe Logs**
   - Stripe Dashboard → Logs
   - Check for API errors
   - Review webhook events

3. **Verify Webhooks**
   - Stripe Dashboard → Webhooks
   - Check webhook endpoint status
   - Review failed webhooks

4. **Check Application Logs**
   - Railway Logs
   - Filter by "stripe" or "payment"
   - Review error details

---

### High Error Rate

1. **Identify Error Pattern**
   - Sentry Dashboard
   - Review top errors
   - Check error frequency

2. **Review Recent Changes**
   - GitHub → Recent commits
   - Check recent deployments
   - Review feature flags

3. **Check External Dependencies**
   - Supabase status
   - Stripe status
   - Third-party API status

4. **Implement Fix**
   - Code fix (if application bug)
   - Rollback (if deployment issue)
   - Disable feature (if feature issue)

---

## Prevention

### Pre-Deployment Checks

- [ ] All tests passing
- [ ] Type checking passing
- [ ] Linting passing
- [ ] Manual testing completed
- [ ] Staging deployment verified

### Monitoring

- [ ] Health checks configured
- [ ] Error tracking enabled (Sentry)
- [ ] Alerting configured
- [ ] Dashboards set up

### Documentation

- [ ] Runbooks documented
- [ ] On-call process documented
- [ ] Escalation path documented
- [ ] Contact information updated

---

## Tools & Resources

### Monitoring
- **Sentry**: https://sentry.io (error tracking)
- **Railway**: https://railway.app (logs, deployments)
- **Supabase**: https://supabase.com/dashboard (database)
- **Stripe**: https://dashboard.stripe.com (payments)

### Communication
- **Slack/Teams**: Team communication
- **Email**: On-call notifications
- **Status Page**: Public status (if applicable)

### Documentation
- **GitHub**: Incident tickets, post-mortems
- **Internal Wiki**: Runbooks, processes

---

## Contact Information

### On-Call
- **Primary**: [On-call engineer contact]
- **Secondary**: [Backup engineer contact]
- **Email**: on-call@servio.uk

### Escalation
- **Team Lead**: [Team lead contact]
- **CTO**: [CTO contact]

### External
- **Railway Support**: https://railway.app/support
- **Supabase Support**: https://supabase.com/support
- **Stripe Support**: https://support.stripe.com

---

**Last Updated:** December 2025  
**Version:** 0.1.6

