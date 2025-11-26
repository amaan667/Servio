# Complete Page Authentication Audit

## Current Status

### ✅ Pages with CORRECT Auth (6 pages)
These pages use server-side auth with `getAuthenticatedUser()` and `getPageAuthContext()`:

1. **`app/dashboard/[venueId]/ai-chat/page.tsx`** ✅
   - Server-side auth check
   - Feature access check (aiAssistant)
   - Passes auth context to client

2. **`app/dashboard/[venueId]/feedback/page.tsx`** ✅
   - Server-side auth check
   - Feature access check (customerFeedback)
   - Passes auth context to client

3. **`app/dashboard/[venueId]/inventory/page.tsx`** ✅
   - Server-side auth check
   - Feature access check (inventory)
   - Passes auth context to client

4. **`app/dashboard/[venueId]/analytics/page.tsx`** ✅
   - Server-side auth check
   - Venue access check
   - Fetches data server-side after auth

5. **`app/dashboard/[venueId]/kds/page.tsx`** ✅
   - Server-side auth check
   - Feature access check (kds)
   - Fetches initial data server-side after auth

### ⚠️ Pages with PARTIAL Auth (1 page)
These pages have some auth but need improvement:

6. **`app/dashboard/[venueId]/settings/page.tsx`** ⚠️
   - Checks session but doesn't use unified auth
   - Uses `createAdminClient()` without proper auth verification
   - Should use `requirePageAuth()` helper

### ❌ Pages MISSING Server-Side Auth (9 pages)
These pages need server-side auth checks:

7. **`app/dashboard/[venueId]/tables/page.tsx`** ❌
   - No server-side auth check
   - Just passes venueId to client

8. **`app/dashboard/[venueId]/staff/page.tsx`** ❌
   - No server-side auth check
   - Just passes venueId to client

9. **`app/dashboard/[venueId]/orders/page.tsx`** ❌
   - No server-side auth check
   - Just passes venueId to client

10. **`app/dashboard/[venueId]/pos/page.tsx`** ❌
    - No server-side auth check
    - Just passes venueId to client

11. **`app/dashboard/[venueId]/live-orders/page.tsx`** ❌
    - No server-side auth check
    - Just passes venueId to client

12. **`app/dashboard/[venueId]/menu-management/page.tsx`** ❌
    - No server-side auth check
    - Just passes venueId to client

13. **`app/dashboard/[venueId]/qr-codes/page.tsx`** ❌
    - No server-side auth check
    - Uses dynamic import (SSR disabled)

14. **`app/dashboard/[venueId]/receipts/page.tsx`** ❌
    - No server-side auth check
    - Just passes venueId to client

15. **`app/dashboard/[venueId]/performance/page.tsx`** ❌
    - No server-side auth check
    - Just passes venueId to client

16. **`app/dashboard/[venueId]/page.tsx`** ❌ (Main Dashboard)
    - Uses `createAdminClient()` without auth check
    - Comment says "Auth is handled client-side"
    - Fetches data before verifying access

## Required Fixes

### Pattern to Use

All pages should follow this pattern:

```typescript
import { requirePageAuth } from "@/lib/auth/page-auth-helper";

export default async function MyPage({ params }: { params: Promise<{ venueId: string }> }) {
  const { venueId } = await params;
  
  // Standard auth check
  const auth = await requirePageAuth(venueId);
  
  // Optional: Check feature access
  // const auth = await requirePageAuth(venueId, { requireFeature: "aiAssistant" });
  
  // Optional: Check role
  // const auth = await requirePageAuth(venueId, { requireRole: ["owner", "manager"] });
  
  // Now safe to fetch data and render
  return <MyClientPage venueId={venueId} tier={auth.tier} role={auth.role} />;
}
```

### Feature Requirements

| Page | Feature Check | Role Check | Notes |
|------|--------------|-----------|-------|
| tables | None | All roles | Basic feature, all tiers |
| staff | None | owner, manager | Staff management |
| orders | None | All roles | Basic feature |
| pos | None | All roles | Basic feature |
| live-orders | None | All roles | Basic feature |
| menu-management | None | All roles | Basic feature |
| qr-codes | None | All roles | Basic feature |
| receipts | None | All roles | Basic feature |
| performance | None | All roles | Basic feature |
| settings | None | owner, manager | Settings management |
| page (dashboard) | None | All roles | Main dashboard |
| ai-chat | aiAssistant | All roles | ✅ Already correct |
| feedback | customerFeedback | All roles | ✅ Already correct |
| inventory | inventory | All roles | ✅ Already correct |
| analytics | None | All roles | ✅ Already correct |
| kds | kds | All roles | ✅ Already correct |

## Migration Priority

### Priority 1: Critical Security (Fix Immediately)
1. `page.tsx` (Main Dashboard) - Fetches data without auth
2. `settings/page.tsx` - Uses admin client without proper auth
3. `tables/page.tsx` - Table management is sensitive

### Priority 2: High Priority (Fix Soon)
4. `staff/page.tsx` - Staff management
5. `orders/page.tsx` - Order data
6. `pos/page.tsx` - POS operations

### Priority 3: Standard Priority (Fix When Possible)
7. `live-orders/page.tsx`
8. `menu-management/page.tsx`
9. `qr-codes/page.tsx`
10. `receipts/page.tsx`
11. `performance/page.tsx`

## Implementation Steps

1. Create `lib/auth/page-auth-helper.ts` (reusable helper)
2. Fix Priority 1 pages
3. Fix Priority 2 pages
4. Fix Priority 3 pages
5. Update `settings/page.tsx` to use unified auth
6. Test all pages with different user roles and tiers

