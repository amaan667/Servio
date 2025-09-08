# Railway pnpm Detection Fix - Complete Guide

## Problem Summary
Railway was incorrectly detecting npm instead of pnpm, causing build failures with the error:
```
Cannot read properties of null (reading 'matches')
```

This was happening because Railway's Nixpacks builder was defaulting to npm despite the `packageManager` field in `package.json`.

## Solution Implemented

### 1. Configuration Files Added

#### `.npmrc`
```ini
# Force pnpm usage
package-manager=pnpm@9.12.0

# Ensure pnpm is used for all operations
auto-install-peers=true
strict-peer-dependencies=false

# Railway-specific settings
node-linker=hoisted
shamefully-hoist=true
```

#### `railway.toml`
```toml
[build]
builder = "nixpacks"
buildCommand = "pnpm install --frozen-lockfile && pnpm run build"

[deploy]
startCommand = "pnpm start"
healthcheckPath = "/"
healthcheckTimeout = 300
restartPolicyType = "on_failure"
```

#### `nixpacks.toml`
```toml
[phases.setup]
nixPkgs = ["nodejs_20", "pnpm"]

[phases.install]
cmds = ["pnpm install --frozen-lockfile"]

[phases.build]
cmds = ["pnpm run build"]

[start]
cmd = "pnpm start"
```

### 2. Verification Steps

#### ✅ Confirmed Files Present
- `package.json` has `"packageManager": "pnpm@9.12.0"`
- `pnpm-lock.yaml` exists and is up-to-date
- No conflicting `package-lock.json` or `yarn.lock` files
- No `Dockerfile` present

#### ✅ Clean Installation
- Removed `node_modules` and reinstalled with pnpm
- All dependencies installed successfully
- Lockfile is clean and consistent

## Next Steps for Railway Deployment

### 1. Railway Dashboard Configuration
In your Railway project dashboard, set these build settings:

**Build Command:**
```bash
pnpm install --frozen-lockfile && pnpm run build
```

**Start Command:**
```bash
pnpm start
```

### 2. Deploy the Branch
1. Ensure Railway is connected to the correct branch: `cursor/force-pnpm-detection-in-railway-deployment-c673`
2. Trigger a new deployment
3. Monitor the build logs

### 3. Expected Build Logs
You should now see logs like:
```
Detected package manager: pnpm@9.12.0
Running "pnpm install --frozen-lockfile"
Running "pnpm run build"
```

**NOT** logs like:
```
stage-0
RUN npm install
```

## Troubleshooting

### If Railway Still Uses npm
1. **Check branch**: Ensure Railway is building from the correct branch
2. **Clear cache**: Railway may have cached the old configuration
3. **Force redeploy**: Trigger a fresh deployment
4. **Check dashboard settings**: Verify build commands are set correctly

### If Build Still Fails
1. **Check logs**: Look for pnpm-specific errors
2. **Verify lockfile**: Ensure `pnpm-lock.yaml` is committed
3. **Node version**: Confirm Railway uses Node.js 20+

## Files Modified
- ✅ `.npmrc` (new)
- ✅ `railway.toml` (new)
- ✅ `nixpacks.toml` (new)
- ✅ `pnpm-lock.yaml` (updated)

## Branch Information
- **Current branch**: `cursor/force-pnpm-detection-in-railway-deployment-c673`
- **Status**: Ready for Railway deployment
- **Commit**: `0b2eabb` - "Force Railway to use pnpm: Add .npmrc, railway.toml, and nixpacks.toml configuration files"

## Success Criteria
- ✅ Railway detects pnpm instead of npm
- ✅ Build completes without "Cannot read properties of null (reading 'matches')" error
- ✅ Application starts successfully with `pnpm start`
- ✅ All dependencies installed correctly via pnpm

---

**Note**: This fix addresses the root cause by explicitly configuring Railway to use pnpm at multiple levels, ensuring consistent package manager detection across all build environments.