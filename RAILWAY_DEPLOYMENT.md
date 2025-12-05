# Railway Deployment Guide

## Preventing Skipped Deployments

If deployments are being skipped on Railway, check the following:

### 1. Disable Metal Builds (CRITICAL)

**Metal builds can cause deployment issues.** The project does NOT use Metal builds.

**Configuration:**
- The `railway.toml` file has been **removed** to allow Railway UI to control the builder/Metal toggle directly
- Railway will use the standard Nixpacks builder by default
- This prevents Railway from reading config files that might force Metal builds

**To disable Metal Builds in Dashboard (REQUIRED):**
1. Go to [Railway Dashboard](https://railway.app)
2. Select your project
3. Navigate to **Settings** > **Build**
4. Find **"Use Metal Build Environment"** toggle
5. **Turn it OFF**
6. Save settings
7. Clear build cache and redeploy

**Note:** Without `railway.toml`, Railway will respect the dashboard toggle settings. Make sure Metal builds are disabled in the dashboard.

### 2. Verify Build Configuration

The project uses `nixpacks.toml` to configure the build:

- **Builder:** Nixpacks (default, configured in `nixpacks.toml`)
- **Build Command:** `pnpm install --frozen-lockfile && pnpm run build`
- **Start Command:** `pnpm start`

**Note:** `railway.toml` has been removed to prevent Railway from forcing Metal builds. The build configuration is now controlled via Railway Dashboard settings.

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

- `nixpacks.toml` - Nixpacks build configuration (used by default)
- `.railwayignore` - Files to ignore during deployment

**Note:** `railway.toml` has been removed. Railway now uses dashboard settings to control build configuration, preventing forced Metal builds.

## Environment Variables

Ensure these are set in Railway Dashboard > Variables:
- `NODE_ENV=production`
- `RAILWAY_PUBLIC_DOMAIN` - Your Railway public domain
- `CRON_SECRET` - Secret for cron job authentication
- All Supabase and Stripe keys
