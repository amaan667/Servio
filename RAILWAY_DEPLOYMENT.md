# Railway Deployment Guide

## Preventing Skipped Deployments

If deployments are being skipped on Railway, check the following:

### 1. Disable Metal Builds (CRITICAL)

**Metal builds can cause deployment issues.** The project is configured to use Railpack builder instead.

**Configuration:**
- The `railway.toml` file explicitly sets `builder = "RAILPACK"` to disable Metal builds
- This ensures Railway uses Railpack builder instead of Metal build infrastructure

**To also disable in Dashboard (optional but recommended):**
1. Go to [Railway Dashboard](https://railway.app)
2. Select your project
3. Navigate to **Settings** > **Build**
4. Find **"Metal Builds"** toggle
5. **Turn it OFF**
6. Save settings

**Note:** The `railway.toml` file should prevent Metal builds from being used, but disabling in the dashboard provides an extra safeguard.

### 2. Verify Build Configuration

The project uses `railway.toml` to configure the build:

- **Builder:** `RAILPACK` (configured in `railway.toml`)
- **Build Command:** `pnpm install --frozen-lockfile && pnpm run build`
- **Start Command:** `pnpm start`

The `nixpacks.toml` file is also present for compatibility, but `railway.toml` takes precedence.

### 3. Check Deployment Triggers

Railway will automatically deploy when:
- Code is pushed to `main` branch (production)
- Code is pushed to `develop` branch (staging)
- Manual deployment via Railway CLI: `railway up`

### 4. Troubleshooting Skipped Deployments

If deployments are still being skipped:

1. **Check Metal Builds Status**
   ```bash
   # Run the helper script
   ./scripts/disable-railway-metal-builds.sh
   ```

2. **Verify Railway Settings**
   - Settings > Build > Metal Builds: **OFF**
   - Settings > Build > Builder: **nixpacks**
   - Settings > Deploy > Auto Deploy: **ON**

3. **Force Deployment**
   ```bash
   # Use Railway CLI to force deployment
   railway up
   ```

4. **Check Build Logs**
   - Go to Railway Dashboard > Deployments
   - Check the latest deployment logs for errors

### 5. Common Issues

**Issue:** "Deployment skipped - Metal builds not ready"
- **Solution:** Disable Metal builds in Railway Dashboard (see step 1)

**Issue:** "No changes detected"
- **Solution:** Railway may not detect changes. Use `railway up` to force deployment

**Issue:** "Build failed"
- **Solution:** Check build logs in Railway Dashboard for specific errors

### 6. Manual Deployment Script

Use the deployment script to force a deployment:

```bash
./scripts/deploy-railway.sh
```

This script:
- Updates deployment trigger files
- Forces Railway to detect changes
- Deploys via Railway CLI (bypasses "Wait for CI" setting)

## Configuration Files

- `railway.toml` - Railway build and deploy configuration
- `nixpacks.toml` - Nixpacks build configuration
- `.railwayignore` - Files to ignore during deployment

## Environment Variables

Ensure these are set in Railway Dashboard > Variables:
- `NODE_ENV=production`
- `RAILWAY_PUBLIC_DOMAIN` - Your Railway public domain
- `CRON_SECRET` - Secret for cron job authentication
- All Supabase and Stripe keys
