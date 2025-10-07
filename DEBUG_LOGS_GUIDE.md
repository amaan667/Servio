# Demo Page Debugging - Comprehensive Logging Guide

## Overview
This document explains the comprehensive debugging system added to diagnose why the "View Demo" button fails on first click but works on retry.

## Problem Statement
- Clicking "View Demo" from the home page shows "Something went wrong" error
- Clicking "Try again" button makes it work
- Need to identify what's failing on first load

## Debugging Logs Added

### 1. **Home Page (`app/page.tsx`)**
- `[HOME DEBUG] HomePage render` - Tracks when homepage renders with auth state
- `[HOME DEBUG] Auth state changed` - Tracks auth state changes in useEffect
- `[DEMO DEBUG] handleDemo clicked` - Logs when View Demo button is clicked with user context

### 2. **Demo Page (`app/demo/page.tsx`)**
- `[DEMO DEBUG] DemoPage render` - Tracks demo page rendering (client-side)
- `[DEMO DEBUG] DemoPage mounted` - Tracks when demo page mounts in browser

### 3. **Demo Components**
- `[DEMO DEBUG] DemoAnalytics component rendering` - Tracks analytics component render
- `[DEMO DEBUG] DemoAISection component rendering` - Tracks AI section component render

### 4. **Auth Provider (`app/auth/AuthProvider.tsx`)**
- `[AUTH DEBUG] AuthProvider useEffect starting` - Initial auth setup
- `[AUTH DEBUG] Supabase browser client initialized successfully` - Client init status
- `[AUTH DEBUG] Using initial session from server` - When using server-provided session
- `[AUTH DEBUG] Fetching session from client` - When fetching fresh session
- `[AUTH DEBUG] Client session fetched` - Result of session fetch
- `[AUTH DEBUG] Auth state changed` - Tracks all auth state change events (SIGNED_IN, SIGNED_OUT, etc.)
- `[AUTH DEBUG] Auth state change listener registered` - Listener setup confirmation

### 5. **Error Boundary (`components/error-boundary.tsx`)**
- `[ERROR BOUNDARY] getDerivedStateFromError called` - When error is caught
- `[ERROR BOUNDARY] componentDidCatch - Caught error` - Detailed error with stack trace
- `[ERROR BOUNDARY] Retry button clicked` - When user clicks retry

### 6. **App-Level Error Handler (`app/error.tsx`)**
- `[ERROR BOUNDARY] Application error caught` - Error details with digest and stack
- `[ERROR BOUNDARY] Redirecting to home due to error type` - When auto-redirecting
- `[ERROR BOUNDARY] Reset button clicked` - When reset is triggered

### 7. **Middleware (`middleware.ts`)**
- `[MIDDLEWARE DEBUG] Processing request` - Every request with pathname and cookies
- `[MIDDLEWARE DEBUG] Skipping middleware for static/API route` - Skip confirmation
- `[MIDDLEWARE DEBUG] Route classification` - Protected/auth/public route status
- `[MIDDLEWARE DEBUG] Allowing public order route` - Public route access
- `[MIDDLEWARE DEBUG] Not a protected route, allowing access` - Non-protected access
- `[MIDDLEWARE DEBUG] Auth check result` - Auth cookie presence
- `[MIDDLEWARE DEBUG] No auth found, redirecting to sign-in` - Redirect trigger
- `[MIDDLEWARE DEBUG] Auth found, allowing access to protected route` - Protected access granted

### 8. **Root Layout (`app/layout.tsx`)**
- `[LAYOUT DEBUG] RootLayout rendering (server)` - Server-side layout render
- `[LAYOUT DEBUG] Server session fetched` - Server session status
- `[LAYOUT DEBUG] Error fetching server session` - Server session errors

## How to Use These Logs

### In Browser Console (Development)
1. Open Chrome DevTools (F12)
2. Go to Console tab
3. Click "View Demo" button
4. Look for the sequence of logs:
   ```
   [HOME DEBUG] handleDemo clicked
   [MIDDLEWARE DEBUG] Processing request { pathname: '/demo' }
   [DEMO DEBUG] DemoPage render
   [AUTH DEBUG] Auth state changed
   [DEMO DEBUG] DemoAnalytics component rendering
   ```

### In Railway (Production)
1. Go to Railway dashboard
2. Select your project
3. Click on "Deployments" 
4. Click on "View Logs"
5. Filter for `[DEMO DEBUG]`, `[AUTH DEBUG]`, or `[ERROR BOUNDARY]`
6. Watch logs in real-time as you test

### What to Look For

#### Scenario 1: Auth State Issue
```
[HOME DEBUG] handleDemo clicked { user: null, authLoading: false }
[AUTH DEBUG] Auth state changed { event: 'INITIAL_SESSION', hasSession: false }
[ERROR BOUNDARY] Caught error: { message: 'Session required' }
```
**Solution**: Auth initialization timing issue

#### Scenario 2: Component Mount Issue
```
[DEMO DEBUG] DemoPage render { mounted: false }
[DEMO DEBUG] DemoAnalytics component rendering
[ERROR BOUNDARY] Caught error: { message: 'Cannot read property of undefined' }
```
**Solution**: Component rendering before client-side hydration complete

#### Scenario 3: Dynamic Import Issue
```
[DEMO DEBUG] DemoAnalytics component rendering
Failed to load recharts components: Error
```
**Solution**: Dynamic import of recharts failing on first load

#### Scenario 4: Middleware Redirect Loop
```
[MIDDLEWARE DEBUG] Processing request { pathname: '/demo' }
[MIDDLEWARE DEBUG] Processing request { pathname: '/demo' }
[MIDDLEWARE DEBUG] Processing request { pathname: '/demo' }
```
**Solution**: Middleware incorrectly treating demo as protected

## Testing Workflow

1. **Clear browser cache and cookies**
2. **Open browser console** (F12 → Console)
3. **Navigate to home page** (/)
4. **Click "View Demo"** button
5. **Observe error** (if it occurs)
6. **Copy all console logs** (right-click → Save as...)
7. **Click "Try again"** button
8. **Note what works** on second attempt

## Expected Normal Flow

```
[HOME DEBUG] HomePage render { hasUser: false, authLoading: false }
[HOME DEBUG] Auth state changed { hasUser: false, authLoading: false }
[HOME DEBUG] handleDemo clicked { user: null, authLoading: false }
[MIDDLEWARE DEBUG] Processing request { pathname: '/demo', isProtectedRoute: false }
[MIDDLEWARE DEBUG] Not a protected route, allowing access
[LAYOUT DEBUG] RootLayout rendering (server)
[LAYOUT DEBUG] Server session fetched { hasSession: false }
[AUTH DEBUG] AuthProvider useEffect starting { hasInitialSession: false }
[AUTH DEBUG] Supabase browser client initialized successfully
[AUTH DEBUG] Fetching session from client
[AUTH DEBUG] Client session fetched { hasSession: false }
[DEMO DEBUG] DemoPage render { mounted: false, location: 'http://localhost:3000/demo' }
[DEMO DEBUG] DemoPage mounted { location: 'http://localhost:3000/demo' }
[DEMO DEBUG] DemoAnalytics component rendering
[DEMO DEBUG] DemoAISection component rendering
```

## After Diagnosis

**Once the issue is identified and fixed, remove these debug logs by:**

1. Search for all `console.log('[DEBUG]` or `console.log('[.*DEBUG]`
2. Search for all `console.error('[DEBUG]`
3. Remove or comment out all debugging console statements
4. Keep only production-relevant logging
5. Commit with message: "Remove debug logging after demo page fix"

## Notes

- All logs include timestamps for timing analysis
- Logs are prefixed with category for easy filtering
- Server logs (Railway) may have different format than browser console
- Some logs only appear in production due to different rendering behavior
- SSR vs CSR differences may reveal timing issues

## Contact

If you need help interpreting the logs or identifying the issue, share:
1. Full browser console output (from page load to error)
2. Railway logs around the same timestamp
3. Screenshot of the error message
4. Browser and OS information

