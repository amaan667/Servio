# Authentication Pattern Guide for Feature Pages

## Overview

This guide shows the **correct authentication pattern** for feature pages like Table Management and AI Assistant, and what data they should fetch and where from.

## ✅ Correct Pattern (AI Assistant Example)

The AI Assistant page (`app/dashboard/[venueId]/ai-chat/page.tsx`) demonstrates the **correct pattern**:

### Server Component (`page.tsx`)

```typescript
import { getAuthenticatedUser } from "@/lib/supabase";
import { getPageAuthContext } from "@/lib/auth/unified-auth";
import { redirect } from "next/navigation";

export default async function AichatPage({ params }: { params: Promise<{ venueId: string }> }) {
  const { venueId } = await params;

  // STEP 1: Server-side auth check
  const { user, error } = await getAuthenticatedUser();
  if (error || !user) {
    redirect("/sign-in");
  }

  // STEP 2: Verify venue access
  const authContext = await getPageAuthContext(user.id, venueId);
  if (!authContext || !authContext.venueAccess) {
    redirect("/dashboard");
  }

  // STEP 3: Check feature access (tier-based)
  const hasAIAccess = authContext.hasFeatureAccess("aiAssistant");

  // STEP 4: Pass auth context to client component
  return (
    <AichatClientPage
      venueId={venueId}
      tier={authContext.tier}
      role={authContext.role}
      hasAccess={hasAIAccess}
    />
  );
}
```

### Client Component (`page.client.tsx`)

```typescript
"use client";

export default function AIChatClientPage({
  venueId,
  tier,
  role,
  hasAccess,
}: {
  venueId: string;
  tier: string;
  role: string;
  hasAccess: boolean;
}) {
  // Show tier restriction if no access
  if (!hasAccess) {
    return <TierRestrictionBanner ... />;
  }

  // Client component can now safely fetch data
  // All API calls will be authenticated via cookies
  return <div>...</div>;
}
```

## ❌ Incorrect Pattern (Current Table Management)

The Table Management page currently uses the **wrong pattern**:

### Current (Wrong) Server Component

```typescript
// app/dashboard/[venueId]/tables/page.tsx
export default async function TablesPage({ params }: { params: Promise<{ venueId: string }> }) {
  const { venueId } = await params;
  
  // ❌ NO SERVER-SIDE AUTH CHECK
  // ❌ Just passes venueId to client
  return <TablesClientPage venueId={venueId} />;
}
```

### Problems:
1. **No server-side auth verification** - Anyone can access the page if they know the venueId
2. **Client-side auth only** - Auth check happens after page loads
3. **Data may be fetched before auth check** - Security risk

## ✅ Correct Pattern for Table Management

### Fixed Server Component

```typescript
// app/dashboard/[venueId]/tables/page.tsx
import TablesClientPage from "./page.client";
import { getAuthenticatedUser } from "@/lib/supabase";
import { getPageAuthContext } from "@/lib/auth/unified-auth";
import { redirect } from "next/navigation";

export default async function TablesPage({ params }: { params: Promise<{ venueId: string }> }) {
  const { venueId } = await params;

  // STEP 1: Server-side auth check
  const { user, error } = await getAuthenticatedUser();
  if (error || !user) {
    redirect("/sign-in");
  }

  // STEP 2: Verify venue access
  const authContext = await getPageAuthContext(user.id, venueId);
  if (!authContext || !authContext.venueAccess) {
    redirect("/dashboard");
  }

  // STEP 3: Table Management is available to all tiers, but check role if needed
  // For table management, we might want to restrict certain actions by role
  const canManageTables = ["owner", "manager"].includes(authContext.role);

  // STEP 4: Pass auth context to client component
  return (
    <TablesClientPage
      venueId={venueId}
      tier={authContext.tier}
      role={authContext.role}
      canManageTables={canManageTables}
    />
  );
}
```

### Updated Client Component

```typescript
"use client";

export default function TablesClientPage({
  venueId,
  tier,
  role,
  canManageTables,
}: {
  venueId: string;
  tier: string;
  role: string;
  canManageTables: boolean;
}) {
  // Client component can now safely use hooks
  // All API calls are authenticated via cookies
  const state = useTableManagementState(venueId);

  return (
    <div>
      {canManageTables ? (
        <TableManagementClientNew venueId={venueId} />
      ) : (
        <div>You don't have permission to manage tables</div>
      )}
    </div>
  );
}
```

## Data Fetching Patterns

### Pattern 1: Direct Supabase Queries (Client-Side)

**When to use**: For real-time data that needs to update frequently

**Example**: `useTableGrid` hook

```typescript
// hooks/useTableReservations.ts
export function useTableGrid(venueId: string) {
  const query = useQuery({
    queryKey: ["tables", "grid", venueId],
    queryFn: async () => {
      // Direct Supabase query - protected by RLS
      const { data, error } = await supabase
        .from("tables")
        .select("*")
        .eq("venue_id", venueId)
        .eq("is_active", true);
      
      if (error) throw error;
      return data;
    },
  });
  
  return query;
}
```

**Security**: 
- ✅ Protected by Supabase RLS (Row Level Security)
- ✅ User must be authenticated (cookies sent automatically)
- ✅ RLS policies verify venue access

### Pattern 2: API Routes (Client-Side)

**When to use**: For mutations, complex operations, or when you need rate limiting

**Example**: Table actions

```typescript
// hooks/useTableActions.ts
export function useTableActions() {
  const createTable = async (params: { venueId: string; label: string }) => {
    // API route - protected by withUnifiedAuth
    const response = await apiClient.post("/api/tables", params);
    return response.json();
  };
}
```

**Security**:
- ✅ API route uses `withUnifiedAuth` wrapper
- ✅ Verifies authentication
- ✅ Verifies venue access
- ✅ Can check tier/role if needed

### Pattern 3: Server-Side Data Fetching (Optional)

**When to use**: For initial page load data that doesn't need to be real-time

**Example**: Initial dashboard counts

```typescript
// app/dashboard/[venueId]/page.tsx
export default async function VenuePage({ params }) {
  const { venueId } = await params;
  
  // After auth check...
  const authContext = await getPageAuthContext(user.id, venueId);
  
  // Now safe to fetch data
  const supabase = createAdminClient(); // Or createClient() if RLS is sufficient
  
  const { data: counts } = await supabase
    .rpc("dashboard_counts", { p_venue_id: venueId });
  
  return <DashboardClient initialCounts={counts} />;
}
```

**Security**:
- ✅ Only fetch after auth verification
- ✅ Use `createAdminClient()` only if you need to bypass RLS
- ✅ Prefer `createClient()` if RLS is sufficient

## API Routes Pattern

All API routes should use `withUnifiedAuth`:

```typescript
// app/api/tables/route.ts
import { withUnifiedAuth } from "@/lib/auth/unified-auth";

export const GET = withUnifiedAuth(
  async (req: NextRequest, context) => {
    // context.user - authenticated user
    // context.venueId - verified venue ID
    // context.role - user's role in venue
    // context.tier - user's subscription tier
    
    const supabase = await createClient();
    
    const { data: tables } = await supabase
      .from("tables")
      .select("*")
      .eq("venue_id", context.venueId);
    
    return NextResponse.json({ tables });
  },
  {
    // Optional: extract venueId from query params
    extractVenueId: async (req) => {
      const { searchParams } = new URL(req.url);
      return searchParams.get("venueId");
    },
  }
);
```

## Feature-Specific Requirements

### Table Management
- **Auth**: All authenticated users with venue access
- **Role Check**: Some actions (create/delete tables) may require owner/manager
- **Data Sources**:
  - `/api/tables` - GET/POST tables (uses `withUnifiedAuth`)
  - `/api/table-sessions/actions` - Table actions (uses `withUnifiedAuth`)
  - Direct Supabase queries for real-time table status (protected by RLS)

### AI Assistant
- **Auth**: All authenticated users with venue access
- **Tier Check**: Requires Enterprise tier (`aiAssistant` feature)
- **Data Sources**:
  - `/api/ai/simple-chat` - Chat endpoint (uses `withUnifiedAuth` with `requireFeature: "aiAssistant"`)

### Inventory
- **Auth**: All authenticated users with venue access
- **Tier Check**: May require Pro+ tier
- **Data Sources**:
  - `/api/inventory/ingredients` - Ingredients (uses `withUnifiedAuth`)
  - `/api/inventory/stock/*` - Stock operations (uses `withUnifiedAuth`)

## Summary

### ✅ DO:
1. **Always verify auth server-side** in `page.tsx` before rendering
2. **Use `getPageAuthContext()`** to verify venue access and get tier/role
3. **Check feature access** server-side for tier-restricted features
4. **Pass auth context** to client components as props
5. **Use `withUnifiedAuth`** for all API routes
6. **Use direct Supabase queries** for real-time data (protected by RLS)
7. **Use API routes** for mutations and complex operations

### ❌ DON'T:
1. **Don't skip server-side auth** - client-side only is insecure
2. **Don't use `createAdminClient()`** without auth check
3. **Don't fetch data** before verifying venue access
4. **Don't trust client-side auth** for security-critical operations
5. **Don't mix auth patterns** - use unified system consistently

## Migration Checklist

For each feature page:

- [ ] Add `getAuthenticatedUser()` check in server component
- [ ] Add `getPageAuthContext()` to verify venue access
- [ ] Check feature access if tier-restricted
- [ ] Pass auth context (tier, role, hasAccess) to client component
- [ ] Update client component to use auth props
- [ ] Verify all API routes use `withUnifiedAuth`
- [ ] Test with different user roles and tiers
- [ ] Test unauthorized access attempts

