# APM Packages Explanation

## What are APM Packages?

APM (Application Performance Monitoring) packages are **optional** third-party tools for monitoring application performance in production. They are NOT required for the application to function.

### Available APM Providers:

1. **Datadog** (`dd-trace` package)
   - Advanced performance monitoring
   - Distributed tracing
   - Error tracking
   - Requires Datadog account and API keys

2. **New Relic** (`newrelic` package)
   - Application performance monitoring
   - Real-time error tracking
   - Performance insights
   - Requires New Relic account and license key

## Why Are They Not Installed?

APM packages are **optional** because:
- They require paid accounts (Datadog/New Relic subscriptions)
- They add dependencies and bundle size
- Not all projects need advanced monitoring
- The application works perfectly without them

## How It Works

The code is designed to work **with or without** APM packages:

1. **Default behavior**: If `APM_PROVIDER` is not set (or set to "none"), the code uses no-op functions that do nothing
2. **If APM is configured**: The code attempts to use the APM package, but gracefully falls back if it's not installed
3. **No errors**: The application will never crash due to missing APM packages

## Installation (Optional)

Only install if you want APM monitoring:

```bash
# For Datadog
pnpm add dd-trace

# For New Relic
pnpm add newrelic
```

Then set environment variable:
```bash
APM_PROVIDER=datadog  # or "newrelic"
```

## Current Status

- ✅ Application works without APM packages
- ✅ No errors if packages are missing
- ✅ APM is completely optional
- ✅ Code gracefully degrades if APM fails
