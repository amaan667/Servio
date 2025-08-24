# Railway Deployment Guide

## Overview
This project is configured to deploy on Railway using Nixpacks (Railway's default build system).

## Key Configuration Files

### `.nixpacks`
- Specifies Node.js 20 and pnpm as the package manager
- Defines build phases: setup → install → build → start
- Sets NODE_ENV to production

### `railway.json`
- Configures Railway-specific deployment settings
- Sets health check and restart policies
- Defines production environment variables

### `.railwayignore`
- Excludes unnecessary files from deployment
- Reduces build time and deployment size

## Deployment Steps

1. **Push to Railway**
   ```bash
   git add .
   git commit -m "Fix Railway deployment configuration"
   git push
   ```

2. **Railway will automatically:**
   - Detect the `.nixpacks` file
   - Install Node.js 20 and pnpm
   - Run `pnpm install --frozen-lockfile`
   - Run `pnpm build`
   - Start with `pnpm start`

3. **Environment Variables**
   - Set all required environment variables in Railway dashboard
   - Ensure `NODE_ENV=production` is set

## Troubleshooting

### If build fails:
1. Check Railway logs for specific error messages
2. Ensure all environment variables are set
3. Verify the lock file is up to date locally

### If dependencies fail to install:
1. The lock file has been regenerated with fixed versions
2. All "latest" versions have been replaced with specific versions
3. Try redeploying after a few minutes

## Build Process
1. **Setup Phase**: Install Node.js 20 and pnpm
2. **Install Phase**: `pnpm install --frozen-lockfile`
3. **Build Phase**: `pnpm build`
4. **Start Phase**: `pnpm start -p 8080`

The application will be available on the Railway-provided domain.
