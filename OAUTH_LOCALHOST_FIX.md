# OAuth Localhost Fix for Railway Deployment

## Problem
The OAuth callback route was building its "base URL" from the raw `req.url`, which inside Railway resolves to `https://localhost:8080`. This caused:
- Redirects and cookie writes to target localhost
- Supabase setting/looking for cookies on the wrong origin
- No refresh token cookie → `refresh_token_not_found` → appearing logged out

## Solution

### 1. Robust Base URL Helper (`lib/getBaseUrl.ts`)
Created a helper that uses proxy headers to determine the correct origin in production:

```typescript
export function getBaseUrl() {
  // Client side: easy
  if (typeof window !== "undefined") return window.location.origin

  // Server side behind a proxy (Railway, Vercel, etc.)
  const h = headers()
  const proto = h.get("x-forwarded-proto") ?? "https"
  const host  = h.get("x-forwarded-host") ?? h.get("host")!
  
  // Safety check - never use localhost in production
  if (host && (host.includes('localhost') || host.includes('127.0.0.1'))) {
    // Fall back to environment variable
    const envUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL
    if (envUrl) {
      return envUrl.replace(/\/+$/, '')
    }
  }
  
  return `${proto}://${host}`
}
```

### 2. Updated Auth Callback Route (`app/auth/callback/route.ts`)
- Replaced `url.origin` with `getBaseUrl()`
- Added safety checks to prevent localhost usage
- Simplified redirect URL construction

### 3. Updated Google OAuth Sign-in (`lib/supabase.ts`)
- Enhanced `signInWithGoogle()` function to use robust URL detection
- Added client-side localhost detection and fallback to production URL
- Improved error handling and logging

### 4. Environment Variables
Ensure these are set in Railway:
```
NEXT_PUBLIC_SITE_URL=https://servio-production.up.railway.app
APP_URL=https://servio-production.up.railway.app
NEXT_PUBLIC_APP_URL=https://servio-production.up.railway.app
```

### 5. Test Page (`app/test-auth-urls/page.tsx`)
Created a comprehensive test page to verify:
- OAuth redirect configuration
- Environment variables
- Client-side URL detection
- Expected redirect URLs
- No localhost in any URLs

## Key Changes Made

1. **Never trust `req.url` for origin in production** - Use proxy headers instead
2. **Robust fallback system** - Multiple layers of safety checks
3. **Comprehensive logging** - Debug information for troubleshooting
4. **Client-side safety** - Detect and handle localhost on client
5. **Environment variable validation** - Ensure proper configuration

## Testing

Visit `/test-auth-urls` to run comprehensive tests that verify:
- ✅ No localhost in redirect URLs
- ✅ Environment variables are properly configured
- ✅ OAuth flow uses correct production URLs
- ✅ Base URL helper works correctly

## Result

After these changes:
- OAuth callbacks will use the correct Railway domain
- Supabase will set cookies on the right origin
- Refresh tokens will be properly stored and retrieved
- Users will stay signed in across reloads and server-side rendering
- No more `refresh_token_not_found` errors
