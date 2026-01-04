# Support Team Preparation Guide

## Overview

This guide prepares the support team for Servio launch. It covers common issues, escalation procedures, tools, and documentation.

## Support Structure

### Support Channels

1. **Email Support**
   - Primary: support@servio.uk
   - Response time: 4 hours (business hours)
   - Enterprise: 1 hour (24/7)

2. **In-App Support**
   - Help center: `/help`
   - Support form: Feature requests, bug reports
   - FAQ: Common questions

3. **Documentation**
   - Help center
   - API documentation
   - User guides

### Support Tiers

#### Tier 1: Basic Support (Starter)

- Email support
- 4-hour response time (business hours)
- Documentation access
- Common issue resolution

#### Tier 2: Priority Support (Pro)

- Email support
- 2-hour response time (business hours)
- Priority ticket handling
- Advanced troubleshooting

#### Tier 3: Enterprise Support (Enterprise)

- Email + phone support
- 1-hour response time (24/7)
- Dedicated support engineer
- Custom integration support

## Common Issues & Solutions

### Authentication Issues

#### User Cannot Sign In

**Symptoms:**
- Login fails
- "Invalid credentials" error
- Session not persisting

**Troubleshooting:**
1. Verify user email is correct
2. Check password reset option
3. Verify Supabase Auth status
4. Check browser cookies/session storage
5. Clear browser cache/cookies

**Resolution:**
- Guide user through password reset
- Verify account exists in Supabase
- Check Sentry for authentication errors
- Escalate if account is locked

#### User Cannot Access Venue

**Symptoms:**
- "Access denied" error
- Venue not showing in dashboard
- Permission errors

**Troubleshooting:**
1. Verify user has venue access
2. Check user role (owner/staff)
3. Verify venue exists
4. Check RLS policies

**Resolution:**
- Verify user-venue relationship
- Check user_venue_roles table
- Escalate to admin if needed

---

### Order Issues

#### Order Not Appearing

**Symptoms:**
- Order created but not visible
- Order missing from dashboard
- Order status incorrect

**Troubleshooting:**
1. Check order was created (database)
2. Verify venue ID matches
3. Check order status
4. Review error logs (Sentry)

**Resolution:**
- Check orders table in Supabase
- Verify venue_id matches
- Check order status
- Escalate if data corruption

#### Payment Processing Failed

**Symptoms:**
- Payment not processing
- Stripe error
- Order stuck in "pending"

**Troubleshooting:**
1. Check Stripe dashboard
2. Verify Stripe webhook status
3. Check payment logs
4. Review error logs (Sentry)

**Resolution:**
- Check Stripe status page
- Verify webhook endpoint
- Replay failed webhooks
- Refund if needed

---

### Menu Issues

#### Menu Items Not Displaying

**Symptoms:**
- Menu items missing
- Menu not loading
- Images not displaying

**Troubleshooting:**
1. Check menu_items table
2. Verify venue_id matches
3. Check image URLs
4. Review error logs

**Resolution:**
- Verify menu items exist
- Check image storage (Supabase Storage)
- Verify venue access
- Clear cache if needed

---

### Table/QR Code Issues

#### QR Code Not Working

**Symptoms:**
- QR code scan fails
- Table not found
- Order not linked to table

**Troubleshooting:**
1. Verify QR code is valid
2. Check table exists
3. Verify table-venue relationship
4. Check QR code URL

**Resolution:**
- Regenerate QR code if needed
- Verify table setup
- Check table-venue relationship
- Guide user through QR code setup

---

### Performance Issues

#### Slow Page Loads

**Symptoms:**
- Pages load slowly
- Timeouts
- Unresponsive UI

**Troubleshooting:**
1. Check Railway logs
2. Check database performance
3. Verify network connectivity
4. Check Sentry performance metrics

**Resolution:**
- Check for ongoing incidents
- Verify database performance
- Check for high load
- Escalate if persistent

---

### Subscription/Payment Issues

#### Subscription Not Activating

**Symptoms:**
- Payment successful but subscription not active
- Tier not updated
- Features not available

**Troubleshooting:**
1. Check Stripe subscription status
2. Verify webhook received
3. Check organizations table
4. Review subscription sync logs

**Resolution:**
- Check Stripe dashboard
- Manually sync subscription (admin)
- Verify webhook processing
- Escalate to engineering

#### Payment Failed

**Symptoms:**
- Payment declined
- Invoice payment failed
- Subscription cancelled

**Troubleshooting:**
1. Check Stripe dashboard
2. Verify card details
3. Check payment method
4. Review payment logs

**Resolution:**
- Guide user to update payment method
- Verify card is valid
- Check Stripe error codes
- Escalate if recurring issue

---

## Escalation Procedures

### When to Escalate

**Escalate to Engineering:**
- Bugs affecting multiple users
- Data corruption
- Security issues
- Performance issues (system-wide)
- Payment processing failures
- Database issues

**Escalate to Product:**
- Feature requests
- UX issues
- Business logic questions
- Tier/feature access questions

**Escalate to Admin:**
- Account access issues
- Subscription issues
- Venue access issues
- Data export requests

### Escalation Process

1. **Document Issue**
   - Gather user information
   - Document error messages
   - Collect screenshots/logs
   - Note troubleshooting steps taken

2. **Create Ticket**
   - GitHub Issue (for bugs)
   - Email (for urgent issues)
   - Internal ticketing system

3. **Notify Team**
   - Post to team channel (Slack/Teams)
   - Tag appropriate team members
   - Include severity (P0-P3)

4. **Follow Up**
   - Track ticket status
   - Update user on progress
   - Document resolution

## Support Tools

### Access Required

1. **Supabase Dashboard**
   - Database access (read-only recommended)
   - User management
   - Log viewing

2. **Stripe Dashboard**
   - Payment/subscription viewing
   - Webhook event viewing
   - Customer management

3. **Railway Dashboard**
   - Log viewing
   - Deployment history
   - Environment variables (read-only)

4. **Sentry**
   - Error tracking
   - Performance monitoring
   - User impact analysis

5. **GitHub**
   - Issue tracking
   - Code access (read-only)
   - Documentation

### Documentation Access

- **Help Center**: `/help` (public)
- **API Documentation**: `/docs/API.md`
- **Internal Documentation**: GitHub repository
- **User Guides**: Help center

## Support Processes

### Ticket Handling

1. **Receive Ticket**
   - Email/Support form
   - Acknowledge receipt
   - Assign priority

2. **Investigate**
   - Review user information
   - Check logs/errors
   - Reproduce issue (if possible)

3. **Resolve**
   - Provide solution
   - Guide user through fix
   - Verify resolution

4. **Follow Up**
   - Confirm issue resolved
   - Request feedback
   - Close ticket

### Priority Levels

#### P0 - Critical (Immediate)

- Service completely down
- Payment processing down
- Data loss/corruption
- Security breach

**Response Time**: < 15 minutes  
**Resolution Target**: < 1 hour

#### P1 - High (Urgent)

- Major feature broken
- Multiple users affected
- Performance degradation
- Payment issues

**Response Time**: < 1 hour  
**Resolution Target**: < 4 hours

#### P2 - Medium (Important)

- Feature not working for single user
- Minor performance issues
- UI bugs

**Response Time**: < 4 hours  
**Resolution Target**: < 24 hours

#### P3 - Low (Standard)

- Feature requests
- Minor UI issues
- Documentation questions

**Response Time**: Next business day  
**Resolution Target**: Next release

## Common Questions & Answers

### General Questions

**Q: How do I sign up?**  
A: Go to the homepage and click "Get Started". You'll be guided through the sign-up process.

**Q: What plans are available?**  
A: We offer Starter, Pro, and Enterprise plans. See pricing page for details.

**Q: Is there a free trial?**  
A: Yes, we offer a 14-day free trial for all paid plans. No credit card required.

**Q: How do I set up QR codes?**  
A: Go to Dashboard → QR Codes, generate QR codes for your tables, and print them.

### Technical Questions

**Q: What browsers are supported?**  
A: Latest versions of Chrome, Firefox, Safari, and Edge. Mobile browsers supported.

**Q: Do I need special hardware?**  
A: No, Servio works on any device with a web browser. Tablets, phones, and computers all work.

**Q: How do I add staff members?**  
A: Go to Dashboard → Staff, click "Add Staff", enter name and role, and save.

**Q: How do I customize my menu?**  
A: Go to Dashboard → Menu Management, add/edit/delete menu items and categories.

### Payment Questions

**Q: How do I change my payment method?**  
A: Go to Settings → Billing, and update your payment method.

**Q: How do I cancel my subscription?**  
A: Go to Settings → Billing, and click "Cancel Subscription".

**Q: What payment methods are accepted?**  
A: Credit cards and digital wallets (Apple Pay, Google Pay) via Stripe.

**Q: Is payment secure?**  
A: Yes, all payments are processed securely via Stripe (PCI DSS compliant).

## Support Scripts

### Initial Response Template

```
Hi [Name],

Thank you for contacting Servio support. I've received your request regarding [issue description].

I'm investigating this issue and will get back to you within [timeframe] with an update.

If you have any additional information that might help (screenshots, error messages, steps to reproduce), please share it.

Best regards,
[Your Name]
Servio Support Team
```

### Resolution Template

```
Hi [Name],

I've resolved your issue regarding [issue description].

[Solution/Explanation]

If you have any further questions or concerns, please don't hesitate to reach out.

Best regards,
[Your Name]
Servio Support Team
```

### Escalation Template

```
Hi [Name],

I've received your request regarding [issue description]. This requires escalation to our engineering team for further investigation.

I've created a ticket (#[ticket-number]) and our team will investigate this as a priority.

I'll keep you updated on the progress and will notify you once we have a resolution.

Best regards,
[Your Name]
Servio Support Team
```

## Training Materials

### Knowledge Base

1. **Product Knowledge**
   - Feature overview
   - User guides
   - Common workflows

2. **Technical Knowledge**
   - System architecture
   - Troubleshooting guides
   - Error message reference

3. **Process Knowledge**
   - Support procedures
   - Escalation paths
   - Communication templates

### Training Schedule

**Week 1: Product Training**
- Feature walkthrough
- User workflows
- Common use cases

**Week 2: Technical Training**
- System architecture
- Troubleshooting
- Tools access

**Week 3: Process Training**
- Support procedures
- Escalation paths
- Communication

**Week 4: Shadowing**
- Observe experienced support
- Handle tickets with supervision
- Review and feedback

## Metrics & Reporting

### Support Metrics

- **Response Time**: Average time to first response
- **Resolution Time**: Average time to resolution
- **Ticket Volume**: Number of tickets per day/week
- **Customer Satisfaction**: User feedback scores
- **First Contact Resolution**: Percentage resolved on first contact

### Reporting

**Daily:**
- Ticket volume
- Critical issues
- Escalations

**Weekly:**
- Support metrics
- Common issues
- Trends

**Monthly:**
- Support performance review
- Process improvements
- Training needs

## Resources

### Internal Resources

- **Documentation**: GitHub repository
- **Team Chat**: Slack/Teams
- **Ticket System**: GitHub Issues
- **Knowledge Base**: Internal wiki

### External Resources

- **Supabase Support**: https://supabase.com/support
- **Stripe Support**: https://support.stripe.com
- **Railway Support**: https://railway.app/support

---

**Last Updated:** December 2025  
**Version:** 0.1.6

