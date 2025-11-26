# Authentication Consistency Review Report

**Date**: November 2025  
**Status**: ⚠️ **INCONSISTENT** - Needs Attention

## Executive Summary

While most API routes use `withUnifiedAuth` (approximately 120 routes), there are **significant inconsistencies** in authentication patterns across the codebase:

1. **API Routes**: ~48% of routes use `withUnifiedAuth`, but many routes that should be protected are not
2. **Pages**: Most pages use `createAdminClient()` and handle auth client-side, which is inconsistent and potentially insecure
3. **Mixed Patterns**: Some routes use old patterns (`getSession`, `getUserSafe`, `createClient`) instead of the unified system

## API Routes Analysis

### ✅ Routes Using `withUnifiedAuth` (Good)
- **Count**: ~120 routes
- **Pattern**: Consistent use of `withUnifiedAuth` wrapper
- **Examples**:
  - `/api/pos/table-sessions/route.ts` ✅
  - `/api/dashboard/orders/route.ts` ✅
  - `/api/table-sessions/actions/route.ts` ✅
  - `/api/tables/route.ts` ✅ (POST uses it, GET uses it)
  - `/api/checkout/route.ts` ✅
  - `/api/user/profile/route.ts` ✅

### ⚠️ Routes NOT Using `withUnifiedAuth` (Needs Review)

#### 1. **Public Routes** (Intentional - OK)
These routes are intentionally public and don't require auth:
- `/api/health/route.ts` - Health check endpoint
- `/api/ready/route.ts` - Readiness check
- `/api/ping/route.ts` - Ping endpoint
- `/api/menu/[venueId]/route.ts` - Public menu access (uses `createAdminClient`)
- `/api/feedback/questions/public/route.ts` - Public feedback questions

#### 2. **Auth Routes** (Intentional - OK)
These routes handle authentication themselves:
- `/api/auth/refresh/route.ts` - Uses `getSession()` directly
- `/api/auth/sign-in-password/route.ts` - Auth endpoint
- `/api/auth/forgot-password/route.ts` - Password reset
- `/api/auth/set-session/route.ts` - Session management
- `/api/auth/sync-session/route.ts` - Session sync

#### 3. **Webhooks** (Intentional - OK)
External webhooks that authenticate via signatures:
- `/api/stripe/webhook/route.ts` - Stripe webhook (uses signature verification)
- `/api/stripe/webhooks/route.ts` - Stripe subscriptions webhook

#### 4. **Customer-Facing Routes** (⚠️ NEEDS REVIEW)
These routes may need different auth patterns:
- `/api/orders/serve/route.ts` - **Uses `createAdminClient()` without auth check**
  - Comment says "no authentication required for customer-facing flow"
  - **RISK**: Anyone can mark orders as served
  - **RECOMMENDATION**: Add token-based auth or verify order ownership

#### 5. **Routes Missing Auth** (❌ CRITICAL)
These routes should be protected but aren't:
- `/api/signup/with-subscription/route.ts` - Uses `createAdminClient()` without auth
  - **RISK**: Should verify user is authenticated before creating subscription
- `/api/signup/complete-onboarding/route.ts` - May need auth verification

#### 6. **Admin/System Routes** (⚠️ NEEDS REVIEW)
- `/api/admin/*` routes - Should verify admin role
- `/api/cron/*` routes - Should verify cron secret or internal-only access
- `/api/daily-reset/*` routes - Should verify system access

## Pages Analysis

### ⚠️ Inconsistent Pattern

**Current Pattern** (Most pages):
```typescript
// app/dashboard/[venueId]/page.tsx
export default async function VenuePage({ params }) {
  const supabase = createAdminClient(); // ❌ No auth check
  // Fetch data without verifying user access
  return <DashboardClient initialData={data} />;
}
```

**Issues**:
1. **No server-side auth verification** - Pages use `createAdminClient()` which bypasses RLS
2. **Client-side auth only** - Auth is checked in client components, but data is already fetched
3. **Security risk** - Unauthorized users could access data if they know the venueId
4. **Inconsistent** - Some pages may check auth, others don't

**Recommendation**:
- Add server-side auth verification using `getAuthenticatedUser()` or `verifyVenueAccess()`
- Or use middleware to protect dashboard routes
- Ensure venue access is verified before fetching data

### Pages Using Admin Client (Needs Review)
- `app/dashboard/[venueId]/page.tsx` - Uses `createAdminClient()` without auth
- `app/dashboard/[venueId]/inventory/page.tsx` - Uses `createAdminClient()` without auth
- `app/dashboard/[venueId]/pos/page.tsx` - Uses `createAdminClient()` without auth
- `app/dashboard/[venueId]/ai-chat/page.tsx` - Uses `createAdminClient()` without auth
- `app/dashboard/[venueId]/feedback/page.tsx` - Uses `createAdminClient()` without auth
- `app/dashboard/[venueId]/orders/page.tsx` - Uses `createAdminClient()` without auth
- `app/dashboard/[venueId]/live-orders/page.tsx` - Uses `createAdminClient()` without auth
- `app/dashboard/[venueId]/staff/page.tsx` - Uses `createAdminClient()` without auth

## Specific Issues Found

### 1. `/api/orders/serve/route.ts` - Missing Auth
```typescript
export async function POST(req: Request) {
  // Uses createAdminClient() - no auth check
  // Comment says "no authentication required for customer-facing flow"
  // RISK: Anyone can mark any order as served
}
```
**Recommendation**: Add token-based verification or verify order belongs to venue

### 2. Dashboard Pages - No Server-Side Auth
All dashboard pages fetch data without verifying user access on the server.

**Recommendation**: Add auth check:
```typescript
export default async function VenuePage({ params }) {
  const { venueId } = await params;
  
  // Verify auth and venue access
  const { user, error } = await getAuthenticatedUser();
  if (error || !user) {
    redirect('/sign-in');
  }
  
  const access = await verifyVenueAccess(venueId, user.id);
  if (!access) {
    redirect('/dashboard');
  }
  
  // Now safe to fetch data
  const supabase = createAdminClient();
  // ...
}
```

### 3. Mixed Auth Patterns
Some routes use old patterns:
- `getSession()` - Used in `/api/auth/refresh/route.ts` (OK for auth routes)
- `getUserSafe()` - May be used in some routes (should migrate to `withUnifiedAuth`)
- `createClient()` - Used in some routes (should use `withUnifiedAuth` context)

## Recommendations

### Priority 1: Critical Security Issues
1. **Fix `/api/orders/serve/route.ts`**
   - Add token-based auth or verify order ownership
   - Don't allow unauthenticated access to order status updates

2. **Add Server-Side Auth to Dashboard Pages**
   - Verify user authentication before fetching data
   - Verify venue access before rendering page
   - Use `getAuthenticatedUser()` and `verifyVenueAccess()`

### Priority 2: Consistency Improvements
3. **Migrate Remaining Routes to `withUnifiedAuth`**
   - Review all routes not using `withUnifiedAuth`
   - Migrate protected routes to use the unified system
   - Document which routes should remain public

4. **Standardize Page Auth Pattern**
   - Create a reusable page auth helper
   - Use consistent pattern across all dashboard pages
   - Consider using middleware for route protection

### Priority 3: Documentation
5. **Document Auth Patterns**
   - Document when to use `withUnifiedAuth`
   - Document when routes should be public
   - Document page auth patterns
   - Add comments explaining auth decisions

## Statistics

- **Total API Routes**: ~214 files
- **Routes using `withUnifiedAuth`**: ~120 files (56%)
- **Routes intentionally public**: ~10 routes
- **Routes needing review**: ~84 routes
- **Dashboard pages**: ~8 pages (all need server-side auth)

## Conclusion

**The codebase is NOT fully consistent with authentication patterns.**

While the `withUnifiedAuth` system is well-designed and widely used, there are significant gaps:
1. Many routes that should be protected are not
2. Pages don't verify auth on the server side
3. Some routes use old auth patterns

**Action Required**: 
- Fix critical security issues first
- Then standardize remaining routes
- Finally, add server-side auth to all pages

