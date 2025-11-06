# Data Fetching Pattern

## Principle: **Use Direct Supabase Queries by Default**

This project uses **direct client-side Supabase queries** for most data operations. API routes are reserved for specific use cases only.

---

## ✅ Use Direct Supabase (Client-Side)

**For:**
- Simple CRUD operations (Create, Read, Update, Delete)
- Fetching lists (menu items, feedback questions, staff, orders)
- Real-time subscriptions
- User-specific data queries
- Any operation that can be secured with Row Level Security (RLS)

**Pattern:**
```typescript
import { supabaseBrowser } from "@/lib/supabase";

const supabase = supabaseBrowser();
const { data, error } = await supabase
  .from("table_name")
  .select("*")
  .eq("venue_id", venueId);
```

**Examples:**
- ✅ Menu Management (`/app/dashboard/[venueId]/menu-management`)
- ✅ Feedback Questions (`/app/dashboard/[venueId]/feedback`)
- ✅ Staff Management (`/app/dashboard/[venueId]/staff`)

**Benefits:**
- No API route auth issues
- Faster (no extra hop)
- Simpler code
- Better TypeScript support
- Real-time capabilities
- RLS provides security

---

## 🔧 Use API Routes (Server-Side)

**Only for:**
1. **Payment Processing**
   - Stripe operations
   - Requires secret keys
   - Example: `/app/api/pay/stripe/route.ts`

2. **Webhooks**
   - External service callbacks
   - Example: `/app/api/stripe/webhook/route.ts`

3. **Complex Business Logic**
   - Multi-step operations with transactions
   - Operations requiring service role (bypassing RLS)
   - Example: `/app/api/orders/bulk-complete/route.ts`

4. **External API Integration**
   - Calling third-party services
   - Requires server-side API keys
   - Example: `/app/api/scrape-menu/route.ts`

5. **Server-Side Computation**
   - Heavy calculations
   - AI/ML operations
   - Example: `/app/api/menu/upload/route.ts`

**Pattern:**
```typescript
// app/api/example/route.ts
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";

export async function POST(req: Request) {
  const supabase = createAdminClient(); // Service role for admin operations
  // ... complex business logic ...
  return NextResponse.json({ success: true });
}
```

---

## 🚫 Anti-Patterns (DO NOT DO)

❌ **Don't create API routes for simple reads:**
```typescript
// BAD: Don't do this
export async function GET(req: Request) {
  const supabase = createClient();
  const { data } = await supabase.from("staff").select("*");
  return NextResponse.json(data);
}
```

✅ **Instead, query directly from client:**
```typescript
// GOOD: Do this
const supabase = supabaseBrowser();
const { data } = await supabase.from("staff").select("*");
```

---

## Security: Row Level Security (RLS)

All direct Supabase queries are protected by **RLS policies** in the database.

**Example RLS Policy:**
```sql
-- Only allow users to see data for their venues
CREATE POLICY "Users can view their venue data"
ON staff
FOR SELECT
USING (
  venue_id IN (
    SELECT venue_id FROM venues WHERE owner_user_id = auth.uid()
    UNION
    SELECT venue_id FROM user_venue_roles WHERE user_id = auth.uid()
  )
);
```

RLS ensures:
- Users can only access their own venue's data
- No need for auth checks in application code
- Database-level security
- Applies to all queries automatically

---

## Migration Checklist

When converting an API route to direct Supabase:

1. ✅ Check if operation needs server-side processing (see "Use API Routes" section)
2. ✅ If not, remove API route
3. ✅ Update component to use `supabaseBrowser()`
4. ✅ Add proper RLS policies if needed
5. ✅ Test that auth works correctly
6. ✅ Remove API route file

---

## Current Status

**✅ Converted to Direct Supabase (Consistent Pattern):**
- ✅ Menu Management (items, categories, design settings)
- ✅ Feedback Questions (create, read, update, delete, reorder)
- ✅ Staff Management (add, toggle active, list)
- ✅ Shift Management (add, delete, list with joins)

**✅ API Routes (Valid Use Cases):**
- ✅ Payment processing (`/api/pay/*`) - Requires Stripe secret keys
- ✅ Webhooks (`/api/stripe/webhook`) - External callbacks
- ✅ Bulk operations (`/api/orders/bulk-complete`) - Complex multi-order logic
- ✅ Menu upload/parsing (`/api/menu/upload`) - AI/ML processing
- ✅ External integrations (`/api/scrape-menu`) - Third-party APIs
- ✅ Analytics aggregations - Complex queries
- ✅ Order operations requiring business logic validation

**📊 Impact:**
- Eliminated 401 authentication errors on dashboard pages
- Improved performance (no API hop)
- Simplified codebase (less code to maintain)
- Better developer experience (TypeScript autocomplete)
- Consistent pattern across all pages

---

## Questions?

**Q: When in doubt, which should I use?**
**A:** Start with direct Supabase. Only use API routes if you have a specific reason from the "Use API Routes" list.

**Q: What about authentication?**
**A:** RLS handles it automatically. The authenticated user's ID is available as `auth.uid()` in RLS policies.

**Q: What about complex queries?**
**A:** Supabase supports joins, aggregations, and complex queries. Use PostgREST syntax or create database functions.

