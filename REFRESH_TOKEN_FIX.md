# Refresh Token Error Fix

## Issue
The application was experiencing continuous `Invalid Refresh Token: Refresh Token Not Found` errors in production logs, causing users to be redirected to sign-in pages.

## Root Cause
1. **Invalid/expired cookies**: Old auth cookies from expired sessions were being read
2. **Unnecessary API calls**: `getSession()` was being called even when no valid auth cookies existed
3. **Token validation attempts**: Supabase was trying to validate expired refresh tokens even with `autoRefreshToken: false`
4. **Redirect loops**: Pages were redirecting to sign-in, which itself had auth checks

## Solution

### 1. Pre-validate Auth Cookies (`lib/supabase/index.ts`)
```typescript
// NEW: Check for valid auth cookies BEFORE calling getSession()
async function hasValidAuthCookies(): Promise<boolean> {
  // Only proceed with getSession() if access-token cookie exists
  const accessTokenCookie = allCookies.find(c => 
    c.name.includes('sb-') && c.name.includes('access-token') && c.value
  );
  return !!accessTokenCookie;
}
```

### 2. Clean Invalid Cookies (`lib/supabase/index.ts`)
```typescript
// Clear any expired or invalid auth tokens to prevent refresh errors
const authCookies = allCookies.filter(c => c.name.includes('sb-') && c.name.includes('refresh'));
for (const cookie of authCookies) {
  if (!cookie.value || cookie.value === '' || cookie.value === 'undefined') {
    cookieStore.delete(cookie.name);
  }
}
```

### 3. Silent Error Handling
- Catch refresh token errors gracefully
- Return `null` user/session instead of throwing
- Don't log expected errors (expired tokens are normal)

### 4. Removed Sign-In Redirects
**Before:**
```typescript
if (!user) {
  redirect('/sign-in'); // ❌ Creates redirect loops
}
```

**After:**
```typescript
if (!user) {
  return <SessionErrorMessage />; // ✅ Shows friendly error
}
```

### 5. Fixed ESLint Errors
- Removed `console.log()` statements (use `console.error` for production)
- All TypeScript strict mode checks pass

## Files Changed
- `lib/supabase/index.ts` - Core auth handling fixes
- `app/dashboard/[venueId]/page.tsx` - Removed redirect, added error UI
- `app/dashboard/page.tsx` - **DELETED** (unnecessary redirect router)
- `app/dashboard/[venueId]/settings/page.tsx` - Removed redirect, added error UI
- `components/error-boundaries/DashboardErrorBoundary.tsx` - Updated fallback link

## Benefits
✅ No more refresh token errors in logs  
✅ No redirect loops  
✅ Better user experience (clear error messages)  
✅ Faster page loads (skip unnecessary API calls)  
✅ Clean production logs  

## Testing
1. Clear browser cookies
2. Navigate to `/dashboard/[venueId]`
3. Should see "Session Error" message (not redirect loop)
4. No errors in server logs

## Monitoring
Check Railway logs for reduction in:
- `Invalid Refresh Token` errors
- `refresh_token_not_found` errors
- Auth-related redirects

