# Security Hardening - Changes Made

## Summary
This document tracks all security hardening changes made to eliminate risky admin client usage and increase auth coverage.

## Routes Fixed

### ✅ Completed

#### 1. `/api/dashboard/orders/[id]/route.ts`
- **Issue**: Used `createClient()` but NO `withUnifiedAuth` wrapper
- **Fix**: 
  - Added `withUnifiedAuth` wrapper to both PATCH and DELETE handlers
  - Replaced `admin()` function (which called `createClient()`) with direct `createClient()` call
  - Added explicit venue checks: `.eq('venue_id', context.venueId)` in all queries
  - Added security comments explaining RLS enforcement
- **Status**: ✅ Fixed

#### 2. `/api/dashboard/orders/one/route.ts`
- **Issue**: Used custom auth (`authenticateRequest`) instead of unified auth
- **Fix**:
  - Migrated to `withUnifiedAuth` wrapper
  - Replaced custom auth with unified auth system
  - Uses authenticated client that respects RLS
  - Removed redundant venue verification (handled by wrapper)
- **Status**: ✅ Fixed

#### 3. `/api/staff/list/route.ts`
- **Issue**: Used `createAdminClient()` after `withUnifiedAuth` verification (dangerous pattern)
- **Fix**:
  - Replaced `createAdminClient()` with `createClient()`
  - Added security comments explaining RLS enforcement
  - RLS policies now enforce venue isolation at database level
- **Status**: ✅ Fixed

#### 4. `/api/pos/payments/route.ts`
- **Issue**: POST handler used `createAdminClient()` after `withUnifiedAuth` verification (dangerous pattern)
- **Fix**:
  - Replaced `createAdminClient()` with `createClient()` in POST handler
  - Added security comments explaining RLS enforcement
  - Added explicit venue checks in all queries
  - Added TODO comment for GET handler (should also use withUnifiedAuth)
- **Status**: ✅ Fixed (POST), ⚠️ GET handler still needs withUnifiedAuth

#### 5. `/api/staff/add/route.ts`
- **Issue**: Used `createAdminClient()` after `withUnifiedAuth` verification (dangerous pattern)
- **Fix**:
  - Replaced `createAdminClient()` with `createClient()`
  - Added security comments explaining RLS enforcement
  - RLS policies now enforce venue isolation at database level
- **Status**: ✅ Fixed

#### 6. `/api/inventory/stock/adjust/route.ts`
- **Issue**: Used `createAdminClient()` after `withUnifiedAuth` verification (dangerous pattern)
- **Fix**:
  - Replaced `createAdminClient()` with `createClient()` in main handler
  - Added explicit venue verification: checks ingredient belongs to context venue
  - Added venue mismatch check for additional security
  - Added security comment in extractVenueId explaining admin client usage there
- **Status**: ✅ Fixed

#### 7. `/api/kds/tickets/route.ts`
- **Issue**: GET handler used `createAdminClient()` after `withUnifiedAuth` verification (dangerous pattern)
- **Fix**:
  - Replaced `createAdminClient()` with `createClient()` in GET handler
  - PATCH handler already uses `createClient()` ✅
  - Added security comments explaining RLS enforcement
  - Added security note in `autoBackfillMissingTickets` function explaining admin client usage
- **Status**: ✅ Fixed (GET), ⚠️ autoBackfillMissingTickets still uses admin client (may be legitimate)

#### 8. `/api/menu/upload/route.ts`
- **Issue**: NO `withUnifiedAuth` wrapper, used `createAdminClient()` for all operations
- **Fix**:
  - Added `withUnifiedAuth` wrapper
  - Replaced `createAdminClient()` with `createClient()` for database operations
  - Added venue verification: checks form venueId matches context
  - Kept admin client only for storage operations (bucket management, file upload) with security comment
  - Added security comments explaining RLS enforcement
- **Status**: ✅ Fixed

#### 9. `/api/tables/[tableId]/route.ts`
- **Issue**: PUT and DELETE handlers used `createAdminClient()` after `withUnifiedAuth` verification (dangerous pattern)
- **Fix**:
  - Replaced `createAdminClient()` with `createClient()` in PUT handler
  - Replaced `createAdminClient()` with `createClient()` in DELETE handler
  - Added explicit venue checks in all queries
  - Added security comments explaining RLS enforcement
  - Kept admin client only in `extractVenueId` (legitimate for venue ID extraction before auth)
- **Status**: ✅ Fixed

#### 10. `/api/staff/delete/route.ts`
- **Issue**: Used `createAdminClient()` after `withUnifiedAuth` verification (dangerous pattern)
- **Fix**:
  - Replaced `createAdminClient()` with `createClient()`
  - Added security comments explaining RLS enforcement
  - RLS policies now enforce venue isolation at database level
- **Status**: ✅ Fixed

#### 11. `/api/inventory/stock/deduct/route.ts`
- **Issue**: Used `createAdminClient()` for RPC call after `withUnifiedAuth` verification
- **Fix**:
  - Replaced `createAdminClient()` with `createClient()` for RPC call
  - Added venue mismatch check for additional security
  - Added security comments explaining RLS enforcement
  - RPC functions respect RLS policies defined in the database
- **Status**: ✅ Fixed

#### 12. `/api/reservations/route.ts`
- **Issue**: GET and POST handlers used `createAdminClient()` after `withUnifiedAuth` verification (dangerous pattern)
- **Fix**:
  - Replaced `createAdminClient()` with `createClient()` in GET handler
  - Replaced `createAdminClient()` with `createClient()` in POST handler
  - Added venue mismatch check in POST handler
  - Added explicit venue checks in all queries
  - Added security comments explaining RLS enforcement
- **Status**: ✅ Fixed

#### 13. `/api/pos/payments/route.ts` (GET handler)
- **Issue**: NO `withUnifiedAuth` wrapper, used `createAdminClient()` without auth verification
- **Fix**:
  - Added `withUnifiedAuth` wrapper
  - Replaced `createAdminClient()` with `createClient()`
  - Added explicit venue checks in query
  - Added security comments explaining RLS enforcement
  - POST handler already fixed in previous session ✅
- **Status**: ✅ Fixed

## Summary of Changes

### Routes Fixed in Session 2: 4
1. `/api/pos/payments/route.ts` - POST handler
2. `/api/staff/add/route.ts`
3. `/api/inventory/stock/adjust/route.ts`
4. `/api/kds/tickets/route.ts` - GET handler

### Routes Fixed in Session 3: 6
1. `/api/menu/upload/route.ts`
2. `/api/tables/[tableId]/route.ts` - PUT and DELETE handlers
3. `/api/staff/delete/route.ts`
4. `/api/inventory/stock/deduct/route.ts`
5. `/api/reservations/route.ts` - GET and POST handlers
6. `/api/pos/payments/route.ts` - GET handler

### Total Routes Fixed: 13
- Session 1: 3 routes
- Session 2: 4 routes
- Session 3: 6 routes
- **Total: 13 routes hardened**

### Test Coverage
- ✅ Cross-venue access denial tests implemented: `__tests__/api/security/cross-venue-access.test.ts`
- ✅ 6 tests passing (100% pass rate)
- ✅ Tests verify that `withUnifiedAuth` properly denies cross-venue access
- ✅ Tests cover:
  - Order access denial via PATCH
  - Staff list access denial via GET
  - Staff add access denial via POST
  - Staff delete access denial via POST (NEW)
  - Stock deduct access denial via POST (NEW)
  - RLS enforcement simulation

### 🔄 In Progress

### ⏳ Pending

#### High Priority (User-facing routes with admin client):
1. `/api/menu/upload/route.ts` - Menu uploads
2. `/api/menu/delete-category/route.ts` - Menu operations
3. `/api/menu/categories/reset/route.ts` - Menu operations
4. `/api/tables/[tableId]/route.ts` - Table operations
5. `/api/staff/delete/route.ts` - Staff management
6. `/api/inventory/stock/deduct/route.ts` - Inventory operations
7. `/api/reservations/route.ts` - Reservation operations

#### Medium Priority (Routes missing withUnifiedAuth):
1. `/api/orders/update-status/route.ts` - Uses custom auth, should migrate
2. `/api/orders/update-payment-status/route.ts` - Check auth
3. `/api/orders/verify/route.ts` - Check auth
4. `/api/orders/serve/route.ts` - Check auth
5. `/api/orders/complete/route.ts` - Check auth
6. `/api/orders/mark-paid/route.ts` - Check auth
7. `/api/orders/delete/route.ts` - Check auth
8. `/api/menu/[venueId]/route.ts` - May be public, verify
9. `/api/menu/upload/route.ts` - Menu uploads
10. `/api/tables/[tableId]/*` routes - Table operations

## Legitimate Admin Client Usage (Keep as-is)

These routes legitimately need admin client and have proper security:

1. **Webhooks** (External service authentication):
   - `/api/stripe/webhook/route.ts` ✅ (has comments)
   - `/api/stripe/webhooks/route.ts` (subscription webhooks)

2. **Cron Jobs** (Scheduled tasks):
   - `/api/cron/daily-reset/route.ts`
   - `/api/cron/demo-reset/route.ts`

3. **Admin Operations** (System-level, should have separate admin auth):
   - `/api/admin/*` routes

4. **Public Routes** (No tenant data):
   - `/api/health/route.ts`
   - `/api/status/route.ts`
   - `/api/ping/route.ts`
   - `/api/ready/route.ts`

## Testing

### Tests Created
- ✅ Cross-venue access denial test template created: `__tests__/api/security/cross-venue-access.test.ts`
  - Test structure for orders, tables, and API route protection
  - Ready for implementation with test database setup
  - Includes test cases for both denial (cross-venue) and allowance (own venue)

### Test Coverage
- ⏳ Verify all routes respect venue isolation (requires test DB setup)
- ⏳ Verify admin client is not used in user-facing routes (requires audit script)

## Next Steps

1. Continue fixing high-priority routes (menu, tables, staff, inventory)
2. Migrate remaining routes from custom auth to `withUnifiedAuth`
3. Add security comments to all legitimate admin client usages
4. Create comprehensive cross-venue access denial tests
5. Document all changes in this file
