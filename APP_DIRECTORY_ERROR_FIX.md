# App Directory Error Fix

## Problem
The Railway deployment was failing with the error:
```
Error: Writing app
Caused by: Is a directory (os error 21)
```

## Root Cause
The issue was caused by the pre-build script (`scripts/pre-build.sh`) that was removing and recreating the `app/` directory during the build process. This could cause conflicts when Next.js or other build tools tried to write to the `app` path while it was being recreated.

## Solution

### 1. Created Guard Script
Created `scripts/guard-app-path.sh` that:
- Checks if `app/` is a directory
- Removes any file named `app` (not directory)
- Creates `app/` directory if it doesn't exist
- Fails the build if `app/` cannot be ensured as a directory

### 2. Updated Pre-build Script
Modified `scripts/pre-build.sh` to:
- Run the guard script before any directory operations
- Only remove the `app` directory if it's invalid (not a directory or missing layout.tsx)
- Preserve existing valid `app/` directory structure

### 3. Updated Build Configuration
- Updated `nixpacks.toml` to use the debug build script
- Updated `scripts/railway-build-debug.sh` to run guard checks before and after build
- Added error handling for corepack enable failures

## Files Modified

1. **`scripts/guard-app-path.sh`** (new) - Prevents "Writing app" errors
2. **`scripts/pre-build.sh`** - Added guard script integration
3. **`scripts/railway-build-debug.sh`** - Added guard checks and error handling
4. **`nixpacks.toml`** - Updated to use debug build script

## Testing
The fix has been tested locally and the build completes successfully with:
- ✅ App directory integrity maintained
- ✅ No "Writing app" errors
- ✅ Successful Next.js build
- ✅ Guard script working correctly

## Deployment
The Railway deployment should now work correctly with these changes. The guard script will prevent any future "Writing app" errors by ensuring the `app/` directory remains a directory throughout the build process.
