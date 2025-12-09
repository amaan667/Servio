# Security Hardening Plan

## Overview
This document tracks the security hardening effort to eliminate risky admin client usage and increase auth coverage.

## Categories

### 1. Legitimate Admin Client Usage (Keep as-is, add comments)
These routes legitimately need admin client access:
- **Webhooks**: External services (Stripe) that authenticate via signature verification
  - `/api/stripe/webhook/route.ts` ✅ (already has comments)
  - `/api/stripe/webhooks/route.ts` (subscription webhooks)
- **Cron Jobs**: Scheduled tasks that run without user context
  - `/api/cron/daily-reset/route.ts`
  - `/api/cron/demo-reset/route.ts`
- **Admin Operations**: System-level maintenance (should be protected by separate admin auth)
  - `/api/admin/*` routes
- **Public Routes**: Routes that don't access tenant data
  - `/api/health/route.ts`
  - `/api/status/route.ts`
  - `/api/ping/route.ts`
  - `/api/ready/route.ts`

### 2. Routes Requiring Admin Client Removal
Routes that verify auth/venue access then use admin client (dangerous pattern):

#### High Priority (User-facing, tenant data access):
1. `/api/dashboard/orders/[id]/route.ts` - Uses `createClient()` but NO `withUnifiedAuth` ❌
2. `/api/menu/upload/route.ts` - Check if uses admin client after auth
3. `/api/orders/route.ts` - Already uses `withUnifiedAuth` ✅ but check for admin client usage
4. `/api/tables/route.ts` - Check pattern
5. `/api/staff/*` routes - Check pattern
6. `/api/inventory/*` routes - Check pattern
7. `/api/kds/*` routes - Check pattern
8. `/api/reservations/*` routes - Check pattern

### 3. Routes Missing withUnifiedAuth
Routes that access tenant data but don't use unified auth:

#### Critical (Access tenant data):
1. `/api/dashboard/orders/[id]/route.ts` - Order updates/deletes
2. `/api/dashboard/orders/one/route.ts` - Order reads
3. `/api/orders/update-status/route.ts` - Order status updates
4. `/api/orders/update-payment-status/route.ts` - Payment updates
5. `/api/orders/verify/route.ts` - Order verification
6. `/api/orders/serve/route.ts` - Order serving
7. `/api/orders/complete/route.ts` - Order completion
8. `/api/orders/mark-paid/route.ts` - Payment marking
9. `/api/orders/delete/route.ts` - Order deletion
10. `/api/orders/[orderId]/*` routes - Order operations
11. `/api/menu/[venueId]/route.ts` - Menu access (may be public, verify)
12. `/api/menu/upload/route.ts` - Menu uploads
13. `/api/menu/delete-category/route.ts` - Menu operations
14. `/api/menu/categories/*` routes - Menu operations
15. `/api/tables/[tableId]/*` routes - Table operations
16. `/api/staff/*` routes - Staff management
17. `/api/inventory/*` routes - Inventory management
18. `/api/kds/*` routes - Kitchen display system
19. `/api/reservations/*` routes - Reservation management
20. `/api/receipts/*` routes - Receipt generation
21. `/api/pos/*` routes - POS operations
22. `/api/feedback/*` routes - Feedback management
23. `/api/reviews/*` routes - Review management

#### Medium Priority (May be public or have different auth):
- `/api/checkout/route.ts` - May be public customer-facing
- `/api/checkout/verify/route.ts` - May be public
- `/api/pay/*` routes - Payment processing (may be public)
- `/api/cart/store/route.ts` - Cart operations (may be public)

## Implementation Strategy

### Phase 1: High-Impact Routes (Orders, Tables, Dashboard)
1. Fix `/api/dashboard/orders/[id]/route.ts` - Add `withUnifiedAuth`, ensure venue isolation
2. Fix `/api/dashboard/orders/one/route.ts` - Add `withUnifiedAuth`
3. Audit all `/api/orders/*` routes for admin client usage
4. Audit all `/api/tables/*` routes for admin client usage

### Phase 2: Menu & Staff Management
1. Fix `/api/menu/*` routes
2. Fix `/api/staff/*` routes

### Phase 3: Inventory & KDS
1. Fix `/api/inventory/*` routes
2. Fix `/api/kds/*` routes

### Phase 4: Remaining Routes
1. Fix `/api/reservations/*` routes
2. Fix `/api/feedback/*` routes
3. Fix `/api/reviews/*` routes
4. Fix `/api/receipts/*` routes
5. Fix `/api/pos/*` routes

### Phase 5: Testing
1. Create cross-venue access denial tests for orders
2. Create cross-venue access denial tests for tables
3. Verify all routes respect venue isolation

## Success Criteria
- ✅ All user-facing routes use `withUnifiedAuth` or equivalent
- ✅ All user-facing routes use authenticated client (not admin client)
- ✅ All admin client usages have explicit comments explaining why
- ✅ Cross-venue access tests pass
- ✅ No routes can access data from other venues
