# Troubleshooting Guide

Common issues and solutions for Servio platform.

## Development Issues

### TypeScript Errors

**Problem**: TypeScript compilation fails

**Solution**:
```bash
# Clear cache and rebuild
rm -rf .next node_modules
pnpm install
pnpm typecheck
```

### Module Not Found

**Problem**: Cannot find module errors

**Solution**:
```bash
# Check if module exists
pnpm list <module-name>

# Reinstall dependencies
pnpm install
```

### Port Already in Use

**Problem**: Port 3000 already in use

**Solution**:
```bash
# Find and kill process
lsof -ti:3000 | xargs kill -9

# Or use different port
PORT=3001 pnpm dev
```

## Runtime Issues

### Database Connection Errors

**Problem**: Cannot connect to Supabase

**Solutions**:
1. Check `.env.local` variables
2. Verify Supabase project is active
3. Check network connectivity
4. Verify RLS policies aren't blocking

### Redis Connection Errors

**Problem**: Redis cache not working

**Solutions**:
1. Check `REDIS_URL` is set
2. Verify Redis is running: `redis-cli ping`
3. Check connection string format
4. App will fallback to memory cache if Redis unavailable

### Authentication Failures

**Problem**: Users cannot sign in

**Solutions**:
1. Check Supabase Auth configuration
2. Verify redirect URLs in Supabase dashboard
3. Check browser console for errors
4. Verify session cookies are set

## API Issues

### 429 Rate Limit Errors

**Problem**: Too many requests

**Solutions**:
1. Check Redis is configured (rate limiting requires Redis)
2. Implement request throttling in client
3. Check rate limit headers in response
4. Wait for rate limit window to reset

### 500 Server Errors

**Problem**: Internal server errors

**Solutions**:
1. Check Railway/Sentry logs
2. Verify environment variables
3. Check database connection
4. Review error stack traces

### CORS Errors

**Problem**: Cross-origin request blocked

**Solutions**:
1. Check `NEXT_PUBLIC_SUPABASE_URL` matches origin
2. Verify CORS settings in Supabase
3. Check middleware configuration

## Performance Issues

### Slow Page Loads

**Solutions**:
1. Enable Redis caching
2. Check database query performance
3. Review bundle size
4. Enable Next.js Image Optimization
5. Check API response times

### High Memory Usage

**Solutions**:
1. Increase Railway memory limit
2. Review memory leaks in code
3. Check for unclosed connections
4. Enable Redis (reduces memory cache)

## Deployment Issues

### Build Fails

**Solutions**:
1. Check build logs in Railway
2. Verify Node.js version (20+)
3. Check for TypeScript errors locally
4. Verify all dependencies installed

### Deployment Succeeds but App Crashes

**Solutions**:
1. Check Railway logs
2. Verify environment variables
3. Check database migrations applied
4. Verify Redis connection string

## Specific Feature Issues

### Orders Not Creating

**Check**:
1. Database connection
2. Venue permissions
3. Menu items exist
4. Table sessions active

### Payments Not Processing

**Check**:
1. Stripe keys configured
2. Webhook endpoint configured
3. Check Stripe dashboard for errors
4. Verify payment intent creation

### Real-time Updates Not Working

**Check**:
1. Supabase Realtime enabled
2. RLS policies allow subscriptions
3. Network connectivity
4. Browser console for errors

## Getting Help

### Debug Mode

Enable debug logging:
```bash
DEBUG=* pnpm dev
```

### Check Logs

**Local**:
```bash
# Check console output
pnpm dev
```

**Production**:
```bash
# Railway logs
railway logs

# Sentry errors
# Check Sentry dashboard
```

### Common Commands

```bash
# Full reset
rm -rf .next node_modules pnpm-lock.yaml
pnpm install
pnpm dev

# Check health
curl http://localhost:3000/api/health

# Type check
pnpm typecheck

# Test
pnpm test
```

## Still Having Issues?

1. Check GitHub Issues
2. Review documentation
3. Check Sentry for error context
4. Contact support with:
   - Error message
   - Steps to reproduce
   - Environment (dev/prod)
   - Logs/Sentry links

