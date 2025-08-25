# Railway Deployment Debug Guide

## Problem
Railway deployment is failing because something is creating a file named `app` instead of using the `app/` directory for Next.js App Router.

## Solution Steps

### 1. Enable Maximum Build Logging

Add these environment variables in Railway's Variables section:

```
NIXPACKS_LOG_LEVEL=debug
NPM_CONFIG_LOGLEVEL=verbose
PNPM_LOG_LEVEL=debug
```

### 2. Use the Enhanced Build Command

Set your Railway Build Command to:

```bash
bash -lc 'scripts/railway-build-debug.sh'
```

Or use the comprehensive one-shot command:

```bash
bash -lc '
set -e
corepack enable
rm -rf .next node_modules .pnpm-store
pnpm install --frozen-lockfile
chmod +x scripts/guard-app-path.sh || true
[ -f scripts/guard-app-path.sh ] && scripts/guard-app-path.sh || true
pnpm run build
[ -f scripts/guard-app-path.sh ] && scripts/guard-app-path.sh || true
'
```

### 3. What the Guard Script Does

The `scripts/guard-app-path.sh` script:
- Ensures `app/` is a directory before build
- Removes any file named `app` 
- Creates `app/` as a directory
- After build, checks that `app/` is still a directory
- Fails immediately if something replaced the directory with a file

### 4. Debugging Steps

1. **Deploy with enhanced logging** - Use the debug build command above
2. **Check Build Logs** - Look for the exact step before failure
3. **Run environment check** - The `railway-env-check.js` script will show if there are conflicting files
4. **Monitor app directory** - The guard script will catch when something writes to `app` as a file

### 5. Common Culprits

- **Postinstall scripts** - Check if any dependency has a postinstall that writes files
- **Build hooks** - Look for prebuild/postbuild scripts in package.json
- **Environment writers** - Ensure env files write to `.env.production`, never `app`
- **Next.js config** - Check for custom output settings
- **Dependencies** - Some packages might write files during installation

### 6. Quick Fixes

If you identify the culprit:

1. **Remove problematic scripts** from package.json
2. **Update environment writers** to use proper paths
3. **Pin suspicious dependencies** to known working versions
4. **Use the guard script** to prevent future issues

### 7. Files Created

- `scripts/guard-app-path.sh` - Detects when something writes a file named "app"
- `scripts/railway-build-debug.sh` - Enhanced build script with debugging
- Updated `scripts/railway-build.sh` - Original build script with guards

### 8. Testing Locally

You can test the guard script locally:

```bash
chmod +x scripts/guard-app-path.sh
scripts/guard-app-path.sh
```

### 9. Railway Variables Summary

Required for debugging:
```
NIXPACKS_LOG_LEVEL=debug
NPM_CONFIG_LOGLEVEL=verbose
PNPM_LOG_LEVEL=debug
```

### 10. Build Command Options

**Option 1: Use the debug script**
```bash
bash -lc 'scripts/railway-build-debug.sh'
```

**Option 2: Use the original script (updated)**
```bash
bash -lc 'scripts/railway-build.sh'
```

**Option 3: One-shot command**
```bash
bash -lc 'set -e; corepack enable; rm -rf .next node_modules .pnpm-store; pnpm install --frozen-lockfile; chmod +x scripts/guard-app-path.sh || true; [ -f scripts/guard-app-path.sh ] && scripts/guard-app-path.sh || true; pnpm run build; [ -f scripts/guard-app-path.sh ] && scripts/guard-app-path.sh || true'
```

## Next Steps

1. Add the environment variables to Railway
2. Set the build command to use the debug script
3. Deploy and check the build logs
4. The guard script will catch the exact moment something tries to write a file named "app"
5. Fix the identified culprit
6. Remove the guard script once the issue is resolved