# Servio MVP - Deployment Guide

## Pre-Deployment Checklist ✅

### Code Quality
- ✅ Build completes without errors
- ✅ No linter errors in critical files
- ✅ TypeScript strict mode enabled
- ✅ React hooks properly implemented
- ✅ All imports resolved correctly
- ✅ No console.logs in production code (using logger)
- ✅ Error boundaries in place
- ✅ Security headers configured

### Performance
- ✅ Code splitting configured
- ✅ Vendor bundle optimized (2.8MB)
- ✅ Image optimization enabled
- ✅ Compression enabled
- ✅ Cache headers configured
- ✅ Bundle size within acceptable limits

### Functionality
- ✅ Dashboard loads without errors
- ✅ Authentication flow working
- ✅ Supabase integration configured
- ✅ Stripe integration ready
- ✅ Real-time updates configured
- ✅ QR code generation working
- ✅ Order management functional

## Deployment Instructions

### Option 1: Railway Deployment (Recommended)

#### 1. Install Railway CLI
```bash
npm install -g @railway/cli
```

#### 2. Login to Railway
```bash
railway login
```

#### 3. Initialize Project
```bash
railway init
```

#### 4. Set Environment Variables
```bash
# Required Variables
railway variables set NEXT_PUBLIC_SUPABASE_URL=<your-supabase-url>
railway variables set NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
railway variables set SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
railway variables set STRIPE_SECRET_KEY=<your-stripe-secret>
railway variables set STRIPE_WEBHOOK_SECRET=<your-webhook-secret>
railway variables set NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=<your-stripe-public>

# Optional but Recommended
railway variables set SENTRY_DSN=<your-sentry-dsn>
railway variables set NEXT_PUBLIC_GA_ID=<your-ga-id>
railway variables set CRON_SECRET=<your-cron-secret>
```

#### 5. Deploy
```bash
railway up
```

#### 6. Configure Custom Domain (Optional)
```bash
railway domain
```

### Option 2: Vercel Deployment

#### 1. Install Vercel CLI
```bash
npm install -g vercel
```

#### 2. Deploy
```bash
vercel
```

#### 3. Set Environment Variables
Use the Vercel dashboard or CLI to set all required environment variables.

#### 4. Configure Build Settings
- **Build Command:** `pnpm run build`
- **Output Directory:** `.next`
- **Install Command:** `pnpm install --frozen-lockfile`
- **Node Version:** 20.x

### Option 3: Docker Deployment

#### 1. Build Docker Image
```bash
docker build -t servio-mvp .
```

#### 2. Run Container
```bash
docker run -p 8080:8080 \
  -e NEXT_PUBLIC_SUPABASE_URL=<your-url> \
  -e NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-key> \
  # ... other environment variables
  servio-mvp
```

## Environment Variables Reference

### Required Variables
| Variable | Description | Example |
|----------|-------------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | `https://xxx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key | `eyJ...` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-only) | `eyJ...` |
| `STRIPE_SECRET_KEY` | Stripe secret key | `sk_test_...` or `sk_live_...` |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret | `whsec_...` |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe publishable key | `pk_test_...` or `pk_live_...` |

### Optional Variables
| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Port to run the server | `8080` |
| `NODE_ENV` | Environment mode | `production` |
| `SENTRY_DSN` | Sentry error tracking DSN | (none) |
| `NEXT_PUBLIC_GA_ID` | Google Analytics ID | (none) |
| `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` | Plausible Analytics domain | (none) |
| `CRON_SECRET` | Secret for cron job authentication | (generate random) |

## Post-Deployment Checklist

### Immediate Verification
- [ ] Homepage loads without errors
- [ ] Sign-up/Sign-in flows work
- [ ] Dashboard loads for authenticated users
- [ ] Supabase connection is working
- [ ] Stripe payment integration works
- [ ] QR code generation works
- [ ] Orders can be created
- [ ] Real-time updates are working

### Stripe Configuration
1. [ ] Configure webhook URL in Stripe Dashboard
   - URL: `https://your-domain.com/api/stripe/webhooks`
   - Events: `checkout.session.completed`, `customer.subscription.created`, etc.
2. [ ] Test a payment flow end-to-end
3. [ ] Verify webhook deliveries in Stripe Dashboard

### Monitoring Setup
1. [ ] Verify Sentry is receiving errors (if configured)
2. [ ] Check Next.js analytics
3. [ ] Monitor server logs
4. [ ] Set up uptime monitoring (e.g., UptimeRobot)
5. [ ] Configure alerts for critical errors

### Performance Checks
- [ ] Run Lighthouse audit (target: 90+ performance score)
- [ ] Verify images are optimized
- [ ] Check bundle sizes in production
- [ ] Test loading times from different locations
- [ ] Verify caching is working correctly

### Security Checks
- [ ] Verify HTTPS is enforced
- [ ] Check security headers (CSP, HSTS, etc.)
- [ ] Test authentication flows
- [ ] Verify API routes are protected
- [ ] Check for exposed secrets
- [ ] Verify CORS configuration

## Troubleshooting

### Build Fails
```bash
# Clear all caches
rm -rf .next node_modules pnpm-lock.yaml
pnpm install
pnpm run build
```

### Dashboard Not Loading
1. Check browser console for errors
2. Verify environment variables are set
3. Check Supabase connection
4. Verify user authentication state
5. Check network tab for failed API calls

### Stripe Webhooks Not Working
1. Verify webhook URL is correct in Stripe Dashboard
2. Check webhook secret is set correctly
3. View webhook delivery attempts in Stripe
4. Check server logs for webhook handler errors
5. Test with Stripe CLI: `stripe listen --forward-to localhost:8080/api/stripe/webhooks`

### Real-time Updates Not Working
1. Verify Supabase Realtime is enabled
2. Check browser console for connection errors
3. Verify Supabase policies allow realtime access
4. Check network tab for WebSocket connections

## Rollback Procedure

If deployment fails or critical issues are found:

### Quick Rollback (Railway/Vercel)
```bash
# Railway
railway rollback

# Vercel
vercel rollback
```

### Manual Rollback
1. Deploy previous working version
2. Restore database backup if needed
3. Update environment variables if changed
4. Clear CDN cache if using one

## Support

### Documentation
- [Next.js Documentation](https://nextjs.org/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [Stripe Documentation](https://stripe.com/docs)

### Logs
- Application logs: Check Railway/Vercel dashboard
- Database logs: Supabase dashboard
- Payment logs: Stripe dashboard
- Error tracking: Sentry dashboard

## Maintenance

### Regular Tasks
- [ ] Monitor error rates weekly
- [ ] Review performance metrics
- [ ] Update dependencies monthly
- [ ] Backup database regularly
- [ ] Review and rotate API keys quarterly
- [ ] Update SSL certificates (auto-renewed usually)

### Scaling Considerations
- Database connection pooling configured
- CDN for static assets
- Multiple server instances for high traffic
- Database read replicas if needed
- Redis for caching (future enhancement)

---

**Current Version:** 0.1.2  
**Next.js Version:** 14.2.16 LTS  
**Node Version:** 20.x  
**Build Status:** ✅ Passing  
**Last Updated:** October 22, 2025

