# Troubleshooting Guide

This guide helps you diagnose and resolve common issues when developing or deploying Servio.

## Table of Contents

- [Development Issues](#development-issues)
- [Build Issues](#build-issues)
- [Database Issues](#database-issues)
- [Authentication Issues](#authentication-issues)
- [API Issues](#api-issues)
- [Performance Issues](#performance-issues)
- [Deployment Issues](#deployment-issues)
- [Testing Issues](#testing-issues)

## Development Issues

### Development server won't start

**Symptoms:**
- `pnpm dev` fails to start
- Port 3000 already in use
- Environment variables missing

**Solutions:**

1. Check if port 3000 is in use:
   ```bash
   lsof -i :3000
   # Kill the process if needed
   kill -9 <PID>
   ```

2. Verify environment variables:
   ```bash
   cat .env.local
   # Ensure all required variables are set
   ```

3. Clear Next.js cache:
   ```bash
   rm -rf .next
   pnpm dev
   ```

4. Check Node.js version:
   ```bash
   node --version
   # Should be 20.x or higher
   ```

### Hot reload not working

**Symptoms:**
- Changes not reflected in browser
- Need to manually refresh

**Solutions:**

1. Check if file is in `.next` ignore:
   - Ensure you're editing files in `app/`, `components/`, `lib/`, etc.
   - Not in `.next/` or `node_modules/`

2. Restart dev server:
   ```bash
   # Stop server (Ctrl+C)
   pnpm dev
   ```

3. Check for syntax errors:
   ```bash
   pnpm typecheck
   ```

### Module not found errors

**Symptoms:**
- `Cannot find module '@/...'`
- Import errors in TypeScript

**Solutions:**

1. Verify `tsconfig.json` paths:
   ```json
   {
     "compilerOptions": {
       "paths": {
         "@/*": ["./*"]
       }
     }
   }
   ```

2. Restart TypeScript server:
   - In VS Code: Cmd+Shift+P → "TypeScript: Restart TS Server"

3. Clear node_modules and reinstall:
   ```bash
   rm -rf node_modules
   pnpm install
   ```

## Build Issues

### Build fails with TypeScript errors

**Symptoms:**
- `pnpm build` fails
- TypeScript compilation errors

**Solutions:**

1. Run type check:
   ```bash
   pnpm typecheck
   ```

2. Fix TypeScript errors:
   - Review error messages
   - Add proper types
   - Fix import paths

3. Check for circular dependencies:
   - Review imports between files
   - Refactor to break cycles

### Build fails with ESLint errors

**Symptoms:**
- `pnpm build` fails
- ESLint errors in output

**Solutions:**

1. Run linter:
   ```bash
   pnpm lint
   ```

2. Auto-fix issues:
   ```bash
   pnpm lint:fix
   ```

3. Review ESLint rules:
   - Check `.eslintrc` configuration
   - Disable specific rules if needed (with justification)

### Build is too slow

**Symptoms:**
- Build takes more than 5 minutes
- High CPU usage during build

**Solutions:**

1. Analyze bundle size:
   ```bash
   pnpm build:analyze
   ```

2. Optimize imports:
   - Use dynamic imports for large libraries
   - Remove unused dependencies

3. Increase Node.js memory:
   ```bash
   NODE_OPTIONS="--max-old-space-size=4096" pnpm build
   ```

## Database Issues

### Connection refused

**Symptoms:**
- `Connection refused` errors
- Cannot connect to Supabase

**Solutions:**

1. Verify Supabase credentials:
   ```bash
   echo $NEXT_PUBLIC_SUPABASE_URL
   echo $NEXT_PUBLIC_SUPABASE_ANON_KEY
   ```

2. Check Supabase status:
   - Visit [status.supabase.com](https://status.supabase.com)

3. Test connection:
   ```bash
   pnpm tsx -e "import { createClient } from '@supabase/supabase-js'; const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!); console.log('Connected');"
   ```

### RLS policies blocking queries

**Symptoms:**
- Queries return empty results
- Permission denied errors

**Solutions:**

1. Check RLS policies in Supabase:
   - Go to Supabase Dashboard → Database → Policies
   - Verify policies allow access

2. Check user context:
   ```typescript
   // Ensure user is authenticated
   const { data: { user } } = await supabase.auth.getUser();
   ```

3. Test with service role key:
   - Use `SUPABASE_SERVICE_ROLE_KEY` for admin operations
   - Never expose this key to client

### Migration fails

**Symptoms:**
- `pnpm migrate` fails
- Migration script errors

**Solutions:**

1. Check migration file syntax:
   ```bash
   # Validate SQL syntax
   psql -f migrations/your-migration.sql
   ```

2. Run migrations individually:
   ```bash
   # Run specific migration
   pnpm tsx scripts/run-migrations.ts --file=migrations/your-migration.sql
   ```

3. Check database connection:
   ```bash
   pnpm tsx scripts/health-check.ts
   ```

## Authentication Issues

### Login fails

**Symptoms:**
- Cannot sign in
- Invalid credentials error

**Solutions:**

1. Verify user exists:
   ```sql
   SELECT * FROM auth.users WHERE email = 'your-email@example.com';
   ```

2. Check password requirements:
   - Minimum 8 characters
   - At least one uppercase letter
   - At least one lowercase letter
   - At least one number
   - At least one special character

3. Reset password:
   - Use forgot password flow
   - Check email for reset link

### Session expires frequently

**Symptoms:**
- Logged out unexpectedly
- Need to re-authenticate often

**Solutions:**

1. Check session timeout:
   - Review Supabase auth settings
   - Adjust session duration if needed

2. Implement refresh token rotation:
   - Check token refresh logic in middleware
   - Ensure tokens are refreshed before expiry

### CSRF token errors

**Symptoms:**
- `CSRF token required` errors
- Form submissions fail

**Solutions:**

1. Generate CSRF token:
   ```typescript
   const token = security.generateCSRFToken(userId);
   ```

2. Include token in requests:
   ```typescript
   headers: {
     'x-csrf-token': token
   }
   ```

3. Check token expiration:
   - CSRF tokens expire after 1 hour
   - Regenerate if needed

## API Issues

### Rate limit exceeded

**Symptoms:**
- `429 Too Many Requests` errors
- Requests blocked

**Solutions:**

1. Check rate limit headers:
   ```bash
   curl -I https://your-app.com/api/endpoint
   # Look for X-RateLimit-* headers
   ```

2. Wait for reset:
   - Check `Retry-After` header
   - Wait before retrying

3. Increase rate limit:
   - Modify `RATE_LIMITS` in `lib/rate-limit.ts`
   - Configure per-endpoint limits

### API returns 500 errors

**Symptoms:**
- Internal server errors
- Unhandled exceptions

**Solutions:**

1. Check Sentry for errors:
   - Visit Sentry dashboard
   - Review error stack traces

2. Check server logs:
   ```bash
   # Railway logs
   railway logs
   ```

3. Test endpoint locally:
   ```bash
   curl -X POST https://localhost:3000/api/endpoint \
     -H "Content-Type: application/json" \
     -d '{"key":"value"}'
   ```

### Webhook not received

**Symptoms:**
- Stripe webhooks not firing
- Payment status not updating

**Solutions:**

1. Verify webhook URL:
   - Check Stripe Dashboard → Webhooks
   - Ensure URL is correct and accessible

2. Test webhook:
   ```bash
   stripe trigger payment_intent.succeeded \
     --add payment_intent \
     --webhook-endpoint https://your-app.com/api/webhooks/stripe
   ```

3. Check webhook secret:
   ```bash
   echo $STRIPE_WEBHOOK_SECRET
   # Ensure it matches Stripe dashboard
   ```

## Performance Issues

### Slow page loads

**Symptoms:**
- Pages take > 3 seconds to load
- Poor Lighthouse scores

**Solutions:**

1. Run Lighthouse audit:
   ```bash
   # Chrome DevTools → Lighthouse
   # Or use: npx lighthouse https://your-app.com
   ```

2. Check bundle size:
   ```bash
   pnpm build:analyze
   # Review bundle analyzer report
   ```

3. Optimize images:
   - Use Next.js Image component
   - Enable WebP/AVIF formats
   - Lazy load images

### High memory usage

**Symptoms:**
- Node.js process uses > 1GB RAM
- Out of memory errors

**Solutions:**

1. Profile memory:
   ```bash
   node --inspect app.js
   # Use Chrome DevTools → Memory profiler
   ```

2. Check for memory leaks:
   - Review event listeners
   - Clear unused caches
   - Close database connections

3. Increase memory limit:
   ```bash
   NODE_OPTIONS="--max-old-space-size=4096" pnpm dev
   ```

### Slow database queries

**Symptoms:**
- API endpoints slow
- Database query time > 1s

**Solutions:**

1. Enable query logging:
   ```sql
   -- Add to Supabase SQL Editor
   SET log_min_duration_statement = 1000;
   ```

2. Analyze slow queries:
   ```sql
   EXPLAIN ANALYZE SELECT * FROM your_table WHERE condition;
   ```

3. Add indexes:
   ```sql
   CREATE INDEX idx_column ON your_table(column);
   ```

## Deployment Issues

### Deployment fails

**Symptoms:**
- Railway/Vercel build fails
- Deployment errors

**Solutions:**

1. Check build logs:
   - Railway Dashboard → Deployments → View Logs
   - Vercel Dashboard → Deployments → View Logs

2. Test build locally:
   ```bash
   pnpm build
   # Ensure build succeeds locally
   ```

3. Check environment variables:
   - Verify all required variables are set
   - Check for typos in variable names

### Environment variables not available

**Symptoms:**
- `undefined` environment variables
- Configuration errors

**Solutions:**

1. Verify variable names:
   - Check `.env.example` for correct names
   - Ensure no typos

2. Check variable scope:
   - `NEXT_PUBLIC_*` variables available on client and server
   - Other variables only available on server

3. Restart deployment:
   - Redeploy after adding variables
   - Variables may require restart

### Health checks failing

**Symptoms:**
- Deployment marked as unhealthy
- Service unavailable

**Solutions:**

1. Test health endpoint:
   ```bash
   curl https://your-app.com/api/health
   # Should return "ok"
   ```

2. Test ready endpoint:
   ```bash
   curl https://your-app.com/api/ready
   # Should return JSON with service status
   ```

3. Check service dependencies:
   - Database: Supabase status
   - Redis: Connection status
   - Stripe: API status

## Testing Issues

### Tests fail locally

**Symptoms:**
- `pnpm test` fails
- Test errors

**Solutions:**

1. Run tests with verbose output:
   ```bash
   pnpm test --reporter=verbose
   ```

2. Run specific test file:
   ```bash
   pnpm test __tests__/unit/security.test.ts
   ```

3. Update snapshots:
   ```bash
   pnpm test -u
   ```

### E2E tests fail

**Symptoms:**
- Playwright tests fail
- Browser automation errors

**Solutions:**

1. Run tests in headed mode:
   ```bash
   pnpm test:e2e --headed
   # See browser actions
   ```

2. Run specific test:
   ```bash
   pnpm test:e2e tests/login.spec.ts
   ```

3. Debug with Playwright Inspector:
   ```bash
   npx playwright codegen https://your-app.com
   # Generate test code
   ```

### Coverage below threshold

**Symptoms:**
- Coverage < 80%
- Build fails due to coverage

**Solutions:**

1. Generate coverage report:
   ```bash
   pnpm test:coverage
   # View HTML report: coverage/index.html
   ```

2. Add tests for uncovered code:
   - Review coverage report
   - Add tests for red areas

3. Adjust coverage thresholds:
   - Update `vitest.config.ts` if needed
   - Justify lower thresholds if necessary

## Getting Additional Help

If you can't resolve your issue:

1. Check [documentation](docs/)
2. Search [existing issues](https://github.com/amaan667/Servio/issues)
3. Ask in [discussions](https://github.com/amaan667/Servio/discussions)
4. Contact maintainers for critical issues

## Useful Commands

```bash
# Development
pnpm dev              # Start dev server
pnpm build            # Build for production
pnpm start            # Start production server

# Quality
pnpm typecheck        # Type checking
pnpm lint             # Lint code
pnpm lint:fix         # Auto-fix linting
pnpm format           # Format code
pnpm validate          # Run all validations

# Testing
pnpm test             # Run unit tests
pnpm test:coverage    # Run tests with coverage
pnpm test:e2e         # Run E2E tests
pnpm test:integration  # Run integration tests
pnpm test:all         # Run all tests

# Database
pnpm migrate          # Run migrations
pnpm cache:clear      # Clear cache
pnpm cache:stats      # View cache statistics

# Health
pnpm health:check     # Check service health
```

## Common Error Messages

| Error | Cause | Solution |
|--------|---------|----------|
| `EADDRINUSE` | Port already in use | Kill process or use different port |
| `MODULE_NOT_FOUND` | Missing dependency | Run `pnpm install` |
| `Cannot find module '@/...'` | TypeScript path issue | Check `tsconfig.json` paths |
| `Connection refused` | Database unavailable | Check Supabase status and credentials |
| `Rate limit exceeded` | Too many requests | Wait and retry |
| `CSRF token required` | Missing CSRF token | Generate and include token |
| `Unauthorized` | Invalid credentials | Check authentication |
| `Forbidden` | Insufficient permissions | Check user role and RLS policies |
