# Railway Deployment Skipping - Fix Guide

## Problem
Railway deployments are being skipped even when using `railway up` CLI command.

## Root Causes
Railway deployments can be skipped due to:

1. **"Wait for CI" Feature Enabled**
   - Railway waits for GitHub Actions to complete before deploying
   - Even `railway up` might wait if this is enabled
   - **Fix**: Disable "Wait for CI" in Railway dashboard

2. **Service Paused**
   - Service might be paused in Railway dashboard
   - **Fix**: Unpause the service in Railway dashboard

3. **Branch Mismatch**
   - Service might be configured to only deploy from a specific branch
   - **Fix**: Check service settings and ensure main branch is configured

4. **Auto-Deploy Disabled**
   - Auto-deploy might be disabled for the service
   - **Fix**: Enable auto-deploy in service settings

## Solutions Implemented

### 1. Enhanced Deployment Script
The `scripts/deploy-railway.sh` script now:
- Updates `.railway-deploy` trigger file with timestamp
- Modifies `next.config.mjs` with deployment timestamp to force change detection
- Uses `railway up --detach` to bypass "Wait for CI"
- Also runs `railway redeploy --yes` as fallback

### 2. File Change Detection
- `next.config.mjs` is updated with a unique timestamp on each deployment
- This ensures Railway detects file changes and doesn't skip

## How to Fix in Railway Dashboard

1. **Go to Railway Dashboard**: https://railway.com
2. **Navigate to your service**: Servio
3. **Go to Settings** → **Deployments**
4. **Check and disable "Wait for CI"** if enabled
5. **Ensure "Auto Deploy" is enabled**
6. **Check the deployment branch is set to "main"**
7. **Ensure service is not paused**

## Manual Deployment Commands

```bash
# Option 1: Use the deployment script (recommended)
bash scripts/deploy-railway.sh

# Option 2: Force redeploy latest deployment
railway redeploy --yes

# Option 3: Upload and deploy
railway up --detach
```

## Verification

After fixing dashboard settings, run:
```bash
bash scripts/deploy-railway.sh
```

Then check Railway dashboard to confirm deployment is not skipped.

## If Still Skipping

If deployments still skip after fixing dashboard settings:
1. Check Railway status page: https://status.railway.com
2. Verify GitHub Actions are passing
3. Check Railway service logs for errors
4. Contact Railway support if issue persists

