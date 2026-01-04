# Backup & Disaster Recovery Plan

## Overview

This document outlines the backup strategy and disaster recovery procedures for Servio. It covers database backups, disaster recovery scenarios, and data retention policies.

## Backup Strategy

### Database Backups

Servio uses **Supabase** for database hosting, which provides automatic backups:

#### Automatic Backups (Supabase)

**Free Tier:**
- Daily backups
- 7-day retention
- Point-in-time recovery: Not available

**Pro Tier:**
- Daily backups
- 7-day retention
- Point-in-time recovery: 7 days
- Backup storage: 8GB

**Enterprise Tier:**
- Custom retention period
- Point-in-time recovery: Custom
- Extended retention options

#### Manual Backups

Create manual backups before major changes:

```bash
# Via Supabase Dashboard
1. Go to Database → Backups
2. Click "Create Backup"
3. Backup is stored in Supabase storage

# Via pg_dump (Command Line)
pg_dump $DATABASE_URL > backup-$(date +%Y%m%d-%H%M%S).sql

# Compress backup
pg_dump $DATABASE_URL | gzip > backup-$(date +%Y%m%d-%H%M%S).sql.gz
```

#### Backup Schedule

**Recommended:**
- **Daily**: Automatic (Supabase)
- **Before Deployments**: Manual backup (for safety)
- **Before Migrations**: Manual backup (required)
- **Weekly**: Export to external storage (optional)

### Backup Storage

#### Primary Storage (Supabase)

- **Location**: Supabase managed storage
- **Retention**: 7 days (Pro tier)
- **Access**: Via Supabase Dashboard

#### Secondary Storage (Recommended)

For critical data, maintain external backups:

1. **Cloud Storage** (AWS S3, Google Cloud Storage, Azure Blob)
   - Weekly exports
   - 30-day retention
   - Encrypted at rest

2. **Local Storage** (Offline)
   - Monthly exports
   - 90-day retention
   - Encrypted archives

### Data to Backup

#### Critical Data

1. **Database Tables**:
   - `venues` - Venue information
   - `orders` - All orders (7 years for tax compliance)
   - `menu_items` - Menu catalog
   - `organizations` - Organization/subscription data
   - `user_venue_roles` - Access control
   - `staff` - Staff members
   - `tables` - Table management

2. **Configuration**:
   - Environment variables (stored securely, not in code)
   - Stripe webhook configuration
   - Supabase RLS policies

3. **Application Code**:
   - Git repository (primary backup)
   - Release artifacts (Railway)

#### Non-Critical Data

- Analytics data (can be regenerated)
- Logs (30-day retention)
- Cache data (can be regenerated)

## Disaster Recovery

### Recovery Objectives

- **RTO (Recovery Time Objective)**: < 1 hour
- **RPO (Recovery Point Objective)**: < 24 hours (Supabase backups)
- **Maximum Data Loss**: 24 hours

### Disaster Scenarios

#### Scenario 1: Database Corruption

**Symptoms:**
- Database queries fail
- Data inconsistencies reported
- Application errors

**Recovery Procedure:**

1. **Assess Damage**
   - Review error logs
   - Check Supabase dashboard
   - Identify affected tables

2. **Restore from Backup**
   ```bash
   # Via Supabase Dashboard
   1. Go to Database → Backups
   2. Select backup point (before corruption)
   3. Click "Restore"
   4. Confirm restore
   ```

3. **Verify Restore**
   - Check critical tables
   - Verify data integrity
   - Test application functionality

4. **Post-Restore**
   - Review corruption cause
   - Update prevention measures
   - Document incident

**Estimated Time**: 30-60 minutes

---

#### Scenario 2: Complete Database Loss

**Symptoms:**
- Database completely unavailable
- Connection errors
- Application cannot start

**Recovery Procedure:**

1. **Assess Situation**
   - Check Supabase status page
   - Verify database is actually down
   - Check recent backups

2. **Restore from Backup**
   ```bash
   # Via Supabase Dashboard
   1. Go to Database → Backups
   2. Select most recent backup
   3. Click "Restore Database"
   4. Wait for restore completion
   ```

3. **Re-run Migrations** (if needed)
   ```bash
   pnpm migrate:prod
   ```

4. **Verify Functionality**
   - Health checks pass
   - Critical workflows work
   - Data integrity verified

5. **Post-Restore**
   - Investigate root cause
   - Review backup strategy
   - Update disaster recovery plan

**Estimated Time**: 1-2 hours

---

#### Scenario 3: Application Deployment Failure

**Symptoms:**
- Application crashes after deployment
- 500 errors for all requests
- Health checks fail

**Recovery Procedure:**

1. **Immediate Rollback**
   ```bash
   # Via Railway Dashboard
   1. Go to Deployments
   2. Find previous working deployment
   3. Click "Redeploy"

   # Via Railway CLI
   railway rollback --service servio-production
   ```

2. **Verify Rollback**
   - Health checks pass
   - Application functions correctly
   - No data loss (application-level)

3. **Investigate**
   - Review deployment logs
   - Check code changes
   - Identify root cause

4. **Fix and Redeploy**
   - Fix identified issues
   - Test locally/staging
   - Redeploy to production

**Estimated Time**: 15-30 minutes

---

#### Scenario 4: Stripe/Payment Processing Failure

**Symptoms:**
- Payment processing fails
- Webhook errors
- Subscription sync issues

**Recovery Procedure:**

1. **Check Stripe Status**
   - Stripe Status Page
   - Check for outages
   - Review Stripe logs

2. **Verify Webhooks**
   - Stripe Dashboard → Webhooks
   - Check webhook endpoint status
   - Review failed webhooks

3. **Replay Failed Webhooks** (if needed)
   ```bash
   # Via Stripe Dashboard
   1. Go to Webhooks → Events
   2. Select failed events
   3. Click "Replay"
   ```

4. **Resync Subscriptions** (if needed)
   ```bash
   # Via API endpoint (admin only)
   POST /api/admin/force-sync-subscription
   ```

5. **Verify Recovery**
   - Test payment flow
   - Verify subscription status
   - Check webhook processing

**Estimated Time**: 30-60 minutes

---

#### Scenario 5: Data Center/Region Outage

**Symptoms:**
- All services unavailable
- Supabase/Railway outage
- No access to infrastructure

**Recovery Procedure:**

1. **Wait for Provider Recovery**
   - Monitor Supabase status
   - Monitor Railway status
   - Wait for service restoration

2. **Verify Services**
   - Check health endpoints
   - Verify database connectivity
   - Test application functionality

3. **Data Integrity Check**
   - Compare data with last known good state
   - Check for data loss
   - Verify backups are current

4. **Post-Recovery**
   - Review incident timeline
   - Document lessons learned
   - Update disaster recovery plan

**Estimated Time**: Dependent on provider

---

### Recovery Procedures

#### Database Restore

**Via Supabase Dashboard:**

1. Log in to Supabase Dashboard
2. Go to Database → Backups
3. Select backup point
4. Click "Restore"
5. Confirm restore operation
6. Wait for restore completion (varies by database size)
7. Verify restore success

**Via pg_restore (Command Line):**

```bash
# Restore from SQL dump
psql $DATABASE_URL < backup.sql

# Restore from compressed dump
gunzip -c backup.sql.gz | psql $DATABASE_URL

# Restore specific tables only
pg_restore -t venues -t orders $DATABASE_URL backup.dump
```

#### Application Rollback

**Via Railway Dashboard:**

1. Log in to Railway Dashboard
2. Select service: `servio-production`
3. Go to "Deployments" tab
4. Find previous working deployment
5. Click "Redeploy"
6. Wait for deployment completion
7. Verify health checks pass

**Via Railway CLI:**

```bash
railway rollback --service servio-production
```

#### Environment Variable Recovery

If environment variables are lost:

1. Retrieve from Railway Dashboard → Variables
2. Retrieve from secure secret store (if used)
3. Verify all required variables are present
4. Update Railway environment variables
5. Redeploy application

## Data Retention Policy

As per Privacy Policy (UK GDPR compliant):

### Retention Periods

1. **Account Data**
   - **Retention**: Until account deletion
   - **Backup Retention**: 30 days after deletion
   - **Purpose**: Account management

2. **Order Data**
   - **Retention**: 7 years (UK tax compliance)
   - **Backup Retention**: 7 years
   - **Purpose**: Tax compliance, order history

3. **Analytics Data**
   - **Retention**: 2 years
   - **Backup Retention**: 2 years
   - **Purpose**: Business analytics

4. **Backup Data**
   - **Retention**: 30 days after deletion
   - **Purpose**: Recovery and compliance

5. **Logs**
   - **Retention**: 30 days
   - **Purpose**: Debugging and monitoring

### Data Deletion

#### User-Requested Deletion

1. **Account Deletion**
   - User requests account deletion
   - Delete account data (venues, orders, etc.)
   - Retain order data for 7 years (tax compliance)
   - Delete from active database
   - Backup retained for 30 days

2. **Order Deletion**
   - Orders cannot be deleted (tax compliance)
   - Can be anonymized if required
   - Data retained for 7 years

#### Automated Deletion

- **Logs**: Deleted after 30 days (automated)
- **Analytics**: Deleted after 2 years (automated)
- **Backups**: Deleted after retention period (automated)

## Backup Verification

### Regular Verification

**Weekly:**
- Verify backup creation (check Supabase backups)
- Verify backup accessibility
- Check backup storage usage

**Monthly:**
- Test restore procedure (staging environment)
- Verify backup integrity
- Review retention policies

**Quarterly:**
- Full disaster recovery drill
- Test all recovery procedures
- Update documentation

### Backup Integrity Checks

1. **Automated Checks** (Supabase)
   - Backup creation verification
   - Backup accessibility checks
   - Storage quota monitoring

2. **Manual Checks**
   - Periodic restore tests
   - Data integrity verification
   - Backup completeness checks

## Disaster Recovery Testing

### Testing Schedule

- **Monthly**: Test restore procedure (staging)
- **Quarterly**: Full disaster recovery drill
- **After Major Changes**: Test backup/restore

### Test Procedures

1. **Database Restore Test**
   ```bash
   # Create test database
   # Restore backup to test database
   # Verify data integrity
   # Test application with restored data
   ```

2. **Application Rollback Test**
   ```bash
   # Deploy test version
   # Create "bad" deployment
   # Test rollback procedure
   # Verify rollback success
   ```

3. **End-to-End Disaster Recovery**
   - Simulate disaster scenario
   - Execute recovery procedures
   - Measure recovery time
   - Document results

## Backup Monitoring

### Monitoring Tools

1. **Supabase Dashboard**
   - Backup status
   - Backup history
   - Storage usage

2. **Railway Dashboard**
   - Deployment history
   - Rollback capability
   - Environment variables

3. **Custom Monitoring** (Optional)
   - Backup creation alerts
   - Backup storage alerts
   - Restore operation alerts

### Alerting

Set up alerts for:
- Backup failures
- Backup storage > 80% full
- Restore operation failures
- Data retention policy violations

## Compliance

### UK GDPR Compliance

- **Data Retention**: Compliant with retention periods
- **Data Deletion**: User right to deletion
- **Backup Security**: Encrypted backups
- **Data Access**: User right to data access

### Tax Compliance (UK)

- **Order Retention**: 7 years (HMRC requirement)
- **Audit Trail**: Maintained in database
- **Data Integrity**: Verified through backups

## Best Practices

1. **Regular Backups**
   - Daily automatic backups
   - Manual backups before major changes
   - Verify backup creation

2. **Test Restores**
   - Monthly restore tests
   - Quarterly disaster recovery drills
   - Document test results

3. **Documentation**
   - Keep procedures up to date
   - Document all recovery procedures
   - Maintain runbooks

4. **Monitoring**
   - Monitor backup creation
   - Alert on backup failures
   - Track backup storage usage

5. **Security**
   - Encrypt backups
   - Secure backup storage
   - Limit backup access

## Support

For backup/disaster recovery questions:
- **Supabase Support**: https://supabase.com/support
- **Railway Support**: https://railway.app/support
- **Team**: Check internal documentation

---

**Last Updated:** December 2025  
**Version:** 0.1.6

