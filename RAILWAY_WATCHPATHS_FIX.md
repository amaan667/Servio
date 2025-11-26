# Railway WatchPaths Fix - Critical Issue

## Problem
Railway deployments are being **immediately skipped** even after adding `watchPaths` to `railway.toml`.

## Root Cause
**WatchPaths is configured in Railway Dashboard UI**, which **overrides** the `railway.toml` file.

When watchPaths is set in the dashboard:
- Railway ignores `watchPaths` in `railway.toml`
- Only files matching the dashboard watchPaths trigger deployments
- If your commits don't touch those paths → **SKIPPED**

## Solution: Fix in Railway Dashboard

You **MUST** fix this in the Railway dashboard UI:

### Step 1: Go to Railway Dashboard
1. Open: https://railway.com
2. Navigate to your project: **Servio**
3. Click on your service

### Step 2: Check Watch Paths Setting
1. Go to **Settings** → **Deployments** (or **Build & Deploy**)
2. Look for **"Watch Paths"** or **"Watch Paths Configuration"**
3. You'll likely see something like:
   - `["apps/web"]` (wrong - your app is in root)
   - `["frontend"]` (wrong)
   - `["src"]` (wrong)
   - Or some other subdirectory

### Step 3: Fix Watch Paths
**Option A (Recommended): Remove Watch Paths**
- Delete/clear the watch paths setting
- Let Railway watch the entire repository
- This is the default behavior

**Option B: Set to Root Directory**
- Change watch paths to: `.` or `["."]`
- This tells Railway to watch the entire root directory

### Step 4: Save and Redeploy
1. Save the settings
2. Railway should automatically trigger a new deployment
3. Or manually trigger: `railway up` or `railway redeploy`

## Why This Happens

Railway has **two places** where watchPaths can be configured:

1. **`railway.toml` file** (what we just fixed)
2. **Railway Dashboard UI** (what's actually being used)

**The dashboard UI setting ALWAYS wins** - it overrides the file.

## Verification

After fixing in dashboard:
1. Make any commit to `main`
2. Check Railway dashboard
3. Deployment should show: **Initializing** → **Building** → **Deploying**
4. Should NOT show: **SKIPPED**

## Alternative: Force Deploy via CLI

While you fix the dashboard, you can force deployments using:

```bash
railway up --detach
```

This bypasses watchPaths and forces a deployment, but you'll need to do this manually for each deployment.

## Current Status

- ✅ `railway.toml` updated (removed watchPaths to use defaults)
- ✅ `railway up` command run to force current deployment
- ⚠️ **Still need to fix watchPaths in Railway Dashboard UI**

## Next Steps

1. **Go to Railway Dashboard** → Settings → Deployments
2. **Remove or fix watchPaths** setting
3. **Save** and verify next deployment doesn't skip

