# API Authentication Migration Status

## 🎯 Goal
Migrate all feature API routes from cookie-based auth to Authorization header pattern.

## ✅ Completed Routes

### KDS (Kitchen Display System)
- ✅ `app/api/kds/stations/route.ts` - GET method
- ✅ `app/api/kds/tickets/bulk-update/route.ts` - PATCH method

### Pattern Used:
```typescript
import { authenticateRequest, verifyVenueAccess } from '@/lib/api-auth';

export async function GET(req: Request) {
  const auth = await authenticateRequest(req);
  if (!auth.success || !auth.supabase) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }
  
  const { user, supabase } = auth;
  // Use supabase for queries...
}
```

## 🚧 In Progress

### KDS (Remaining)
- ⏳ `app/api/kds/tickets/route.ts` - GET + PATCH methods (marked with TODO)
- ⏳ `app/api/kds/status/route.ts` 
- ⏳ `app/api/kds/backfill/route.ts`
- ⏳ `app/api/kds/backfill-all/route.ts`

## ⏳ Pending Routes

### Orders
- `app/api/orders/route.ts`
- `app/api/dashboard/orders/one/route.ts`

### Tables
- `app/api/tables/[tableId]/route.ts`
- `app/api/tables/[tableId]/close/route.ts`
- `app/api/tables/[tableId]/reissue-qr/route.ts`
- `app/api/tables/[tableId]/seat/route.ts`
- `app/api/tables/remove/route.ts`
- `app/api/tables/force-clear-all/route.ts`
- `app/api/tables/cleanup-duplicates/route.ts`
- `app/api/tables/clear/route.ts`

### Menu Management
- `app/api/menus/[id]/route.ts`
- `app/api/menus/upload/route.ts`
- `app/api/menu-items/route.ts`

### QR Codes
- `app/api/qr-codes/generate/route.ts`
- `app/api/qr-codes/download/route.ts`

### Other Features
- `app/api/venues/update-reset-time/route.ts`
- `app/api/feedback/list/route.ts`
- `app/api/ai-assistant/conversations/route.ts`

## ✅ Routes That SHOULD Use Cookies (Correct As-Is)

### Authentication
- `app/api/auth/callback/route.ts` - Sets cookies after OAuth
- `app/api/auth/signout/route.ts` - Clears cookies
- `app/api/auth/health/route.ts` - Health check (no auth needed)

### Special Cases
- `app/api/organization/ensure/route.ts` - Uses admin client to bypass RLS
- `app/api/errors/route.ts` - Logging endpoint (no auth)
- `app/api/performance/route.ts` - Logging endpoint (no auth)

## 📊 Progress

- ✅ Completed: 2 routes
- 🚧 In Progress: 4 routes  
- ⏳ Pending: ~30 routes
- ✅ Correct (cookies): 6 routes

**Total Feature Routes**: ~36
**Completion**: 5% (2/36)

## 🎯 Priority Order

1. **HIGH** - KDS (in progress) - Core feature, user reported issues
2. **HIGH** - QR Codes - User reported React error #438
3. **MEDIUM** - Tables - Dependency for QR codes
4. **MEDIUM** - Orders - Core feature
5. **LOW** - Menu, Venues, Feedback, AI - Nice to have

## 📝 Migration Template

For each route, follow this pattern:

```typescript
// 1. Update imports
import { authenticateRequest, verifyVenueAccess } from '@/lib/api-auth';
// Remove: import { createServerSupabase } from '@/lib/supabase';

// 2. Replace auth logic
const auth = await authenticateRequest(req);
if (!auth.success || !auth.supabase) {
  return NextResponse.json({ error: auth.error }, { status: 401 });
}

const { user, supabase } = auth;

// 3. Verify venue access (if needed)
const access = await verifyVenueAccess(supabase, user.id, venueId);
if (!access.hasAccess) {
  return NextResponse.json({ error: "Access denied" }, { status: 403 });
}

// 4. Use supabase for queries
const { data } = await supabase.from('table').select('*');
```

## 🧪 Testing Checklist

After updating each route:
- [ ] Lint passes
- [ ] TypeScript compiles
- [ ] Route responds with 401 if no auth header
- [ ] Route works with valid auth header
- [ ] Feature page works end-to-end

## 🚀 Deployment Strategy

1. Update routes in batches by feature
2. Deploy after each batch
3. Test feature in production
4. Move to next batch

Current batch: **KDS** (almost complete, will test after next deploy)

