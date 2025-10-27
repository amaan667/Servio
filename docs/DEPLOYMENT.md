# Deployment Guide

Complete guide for deploying Servio to production.

## Pre-Deployment Checklist

- [ ] All tests passing (`pnpm test`)
- [ ] Type checking passes (`pnpm typecheck`)
- [ ] Linting passes (`pnpm lint`)
- [ ] Environment variables configured
- [ ] Database migrations applied
- [ ] Redis cache configured (optional but recommended)
- [ ] Stripe webhooks configured
- [ ] Sentry DSN configured

## Railway Deployment

### Initial Setup

1. **Connect Repository**
   - Go to Railway dashboard
   - Click "New Project"
   - Connect GitHub repository
   - Select branch (usually `main`)

2. **Configure Environment Variables**
   ```
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   STRIPE_SECRET_KEY=sk_live_...
   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
   REDIS_URL=redis://... (optional)
   NEXT_PUBLIC_SENTRY_DSN=your_sentry_dsn
   NODE_ENV=production
   ```

3. **Configure Build Settings**
   - Build Command: `pnpm build`
   - Start Command: `pnpm start`
   - Root Directory: `.`

### Automatic Deployments

Railway automatically deploys on:
- Push to `main` branch
- Manual deploy trigger

### Manual Deployment

```bash
railway up
```

## Post-Deployment

### 1. Verify Deployment

```bash
# Check health endpoint
curl https://your-app.railway.app/api/health

# Check API docs
curl https://your-app.railway.app/api/docs
```

### 2. Monitor Logs

```bash
railway logs
```

### 3. Test Critical Paths

- [ ] User sign-up flow
- [ ] Order creation
- [ ] Payment processing
- [ ] Webhook endpoints

## Rollback Procedure

If deployment fails:

```bash
# In Railway dashboard:
# 1. Go to Deployments
# 2. Select previous successful deployment
# 3. Click "Redeploy"
```

## Database Migrations

Always run migrations before deployment:

```bash
# Using Supabase CLI
supabase db push

# Or via SQL Editor in Supabase dashboard
```

## Monitoring

### Sentry

- Errors automatically tracked
- Performance monitoring enabled
- Check Sentry dashboard for issues

### Railway Metrics

- CPU usage
- Memory usage
- Request count
- Response times

## Troubleshooting

### Build Fails

1. Check build logs in Railway
2. Verify Node.js version (20+)
3. Check environment variables
4. Run `pnpm build` locally

### App Crashes

1. Check Railway logs
2. Verify database connection
3. Check Redis connection (if used)
4. Review Sentry errors

### Slow Performance

1. Check Redis cache configuration
2. Review database query performance
3. Check API response times in Sentry
4. Review Railway resource limits

## Production Best Practices

1. **Always test locally first**
   ```bash
   pnpm build
   pnpm start
   ```

2. **Use feature flags** for risky changes
3. **Monitor error rates** daily
4. **Set up alerts** for critical failures
5. **Regular backups** of database
6. **Keep dependencies updated** (Dependabot)

## Environment-Specific Configuration

### Staging

- Use separate Supabase project
- Use Stripe test keys
- Enable debug logging

### Production

- Use production Supabase
- Use Stripe live keys
- Minimal logging
- Enable rate limiting
- Enable Redis caching

## Security Checklist

- [ ] HTTPS enabled
- [ ] Environment variables secured
- [ ] Rate limiting enabled
- [ ] CORS configured correctly
- [ ] Security headers set
- [ ] API keys rotated regularly

