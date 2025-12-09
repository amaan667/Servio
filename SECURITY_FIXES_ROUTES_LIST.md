# Routes Requiring Security Fixes

## Routes Using withUnifiedAuth + createAdminClient() (Dangerous Pattern)

### Orders Domain
- ✅ `/api/dashboard/orders/[id]/route.ts` - FIXED
- ✅ `/api/dashboard/orders/one/route.ts` - FIXED
- ⏳ `/api/orders/route.ts` - Check if uses admin client
- ⏳ Other order routes - Check individually

### Payments & POS Domain
- 🔴 `/api/pos/payments/route.ts` - POST uses withUnifiedAuth + createAdminClient (line 41)
- ⏳ `/api/pos/orders/status/route.ts` - Check
- ⏳ `/api/pos/table-transfer/route.ts` - Check
- ⏳ `/api/pos/bill-splits/route.ts` - Check

### Staff Domain
- ✅ `/api/staff/list/route.ts` - FIXED
- 🔴 `/api/staff/add/route.ts` - Uses withUnifiedAuth + createAdminClient (line 45)
- ⏳ `/api/staff/delete/route.ts` - Check
- ⏳ `/api/staff/invitations/route.ts` - Check
- ⏳ Other staff routes - Check individually

### Inventory Domain
- 🔴 `/api/inventory/stock/adjust/route.ts` - Uses withUnifiedAuth + createAdminClient (line 36)
- ⏳ `/api/inventory/stock/deduct/route.ts` - Check
- ⏳ `/api/inventory/ingredients/route.ts` - Check
- ⏳ Other inventory routes - Check individually

### KDS Domain
- 🔴 `/api/kds/tickets/route.ts` - GET uses withUnifiedAuth + createAdminClient (line 154), PATCH uses createClient ✅
- ⏳ `/api/kds/stations/route.ts` - Check
- ⏳ `/api/kds/tickets/check-bumped/route.ts` - Check

### Tables Domain
- ⏳ `/api/tables/route.ts` - Already uses createClient ✅
- ⏳ `/api/tables/[tableId]/route.ts` - Check
- ⏳ Other table routes - Check individually

## Fix Priority Order
1. Payments (POS) - High risk, financial data ✅
2. Staff - User management, sensitive ✅
3. Inventory - Business critical ✅
4. KDS - Operational critical ✅
5. Tables - Operational ✅
6. Menu - Operational ✅
7. Reservations - Operational ✅

## Routes Fixed in Session 3
- ✅ `/api/menu/upload/route.ts`
- ✅ `/api/tables/[tableId]/route.ts`
- ✅ `/api/staff/delete/route.ts`
- ✅ `/api/inventory/stock/deduct/route.ts`
- ✅ `/api/reservations/route.ts`
- ✅ `/api/pos/payments/route.ts` (GET handler)

## Remaining High Priority Routes
- ⏳ `/api/menu/delete-category/route.ts`
- ⏳ `/api/menu/categories/reset/route.ts`
- ⏳ Other menu routes
- ⏳ Other order routes
- ⏳ Other table routes
