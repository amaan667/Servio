# Authentication Architecture

## 🎯 Core Principle

**Feature pages and API routes use Authorization headers. Cookies are ONLY for middleware and SSR pages.**

## ✅ Correct Pattern

### Client-Side (Feature Pages)

```typescript
import { apiClient } from '@/lib/api-client';

// Automatically includes Authorization: Bearer <token> header
const response = await apiClient.get('/api/kds/stations', { 
  params: { venueId } 
});
```

### Server-Side (API Routes)

```typescript
import { authenticateRequest, verifyVenueAccess } from '@/lib/api-auth';

export async function GET(req: Request) {
  // 1. Authenticate using Authorization header
  const auth = await authenticateRequest(req);
  if (!auth.success || !auth.user || !auth.supabase) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }
  
  const { user, supabase } = auth;
  
  // 2. Verify venue access (if needed)
  const access = await verifyVenueAccess(supabase, user.id, venueId);
  if (!access.hasAccess) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }
  
  // 3. Use supabase client for queries
  const { data } = await supabase.from('table').select('*');
  
  return NextResponse.json({ data });
}
```

## ❌ Incorrect Pattern (DO NOT USE)

```typescript
// ❌ BAD: API route trying to read cookies
import { createServerSupabase } from '@/lib/supabase';
const supabase = await createServerSupabase(); // Reads cookies - unreliable!
const { data: { session } } = await supabase.auth.getSession(); // May be null!
```

## 📍 Where Cookies ARE Used

1. **Middleware** (`middleware.ts`)
   - Route protection
   - Redirects based on auth state

2. **Server-Side Rendered Pages** (Server Components)
   - Initial page load auth state
   - Pre-rendering with user data

## 🏗️ Architecture

```
┌─────────────────┐
│  Feature Page   │
│  (Client)       │
└────────┬────────┘
         │
         │ 1. Get token from Supabase
         │    const { data: { session } } = await supabase.auth.getSession()
         │
         │ 2. Add to Authorization header
         │    Authorization: Bearer <token>
         │
         ▼
┌─────────────────┐
│   API Route     │
│   (Server)      │
└────────┬────────┘
         │
         │ 3. Read token from header
         │    const auth = await authenticateRequest(req)
         │
         │ 4. Verify with Supabase
         │    await supabase.auth.getUser()
         │
         ▼
┌─────────────────┐
│   Supabase      │
│   (Verify)      │
└─────────────────┘
```

## 🔄 Migration Status

### ✅ Completed
- `lib/api-client.ts` - Client helper
- `lib/api-auth.ts` - Server helper
- `app/api/kds/stations/route.ts` - KDS stations
- `app/dashboard/[venueId]/kds/KDSClient.tsx` - KDS client

### 🚧 In Progress
- `app/api/kds/tickets/route.ts` - KDS tickets (partial)
- `app/api/kds/tickets/bulk-update/route.ts`

### ⏳ Pending
- QR codes API routes
- Table management API routes
- Menu management API routes
- Orders API routes
- All other feature APIs

## 🎯 Benefits

1. **Reliability**: Headers work everywhere (localhost, Railway, Vercel)
2. **Security**: Token-based auth is standard and secure
3. **Simplicity**: No cookie configuration needed
4. **Consistency**: Same pattern across all features
5. **Debugging**: Easy to see auth token in Network tab

## 📝 TODO

1. Update remaining KDS routes to use Authorization headers
2. Update QR codes generation API
3. Update table management APIs
4. Update menu management APIs
5. Create automated test to verify all APIs use correct auth pattern

