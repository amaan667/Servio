# Complete Route Migration Guide: Fix All Routes to Use withUnifiedAuth

## Goal
Migrate ALL remaining routes (52 routes) to use `withUnifiedAuth` for consistent authentication, authorization, tier checks, and error handling.

## Critical Requirements

### 1. **Consistent Authentication Pattern**
Every route MUST use `withUnifiedAuth` wrapper - NO exceptions.

### 2. **Consistent Error Handling**
All routes MUST return proper HTTP status codes:
- `400` - Bad Request (validation errors)
- `401` - Unauthorized (not authenticated)
- `403` - Forbidden (no access/feature not available)
- `404` - Not Found (resource doesn't exist)
- `429` - Too Many Requests (rate limit)
- `500` - Internal Server Error (server errors)

### 3. **Consistent Rate Limiting**
All routes MUST include rate limiting using `RATE_LIMITS.GENERAL` (or specific limits like `RATE_LIMITS.PAYMENT`).

### 4. **Venue Access Validation**
All routes MUST verify venue access using `context.venueId` from `withUnifiedAuth`. Never trust `venue_id` from request body/query without validation.

## Migration Pattern

### Standard Route Pattern (GET/POST/PUT/DELETE)

```typescript
import { NextRequest, NextResponse } from "next/server";
import { withUnifiedAuth } from '@/lib/auth/unified-auth';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { logger } from "@/lib/logger";
// ... other imports

export const GET = withUnifiedAuth(
  async (req: NextRequest, context) => {
    try {
      // 1. Rate limiting (ALWAYS FIRST)
      const rateLimitResult = await rateLimit(req, RATE_LIMITS.GENERAL);
      if (!rateLimitResult.success) {
        return NextResponse.json(
          {
            error: 'Too many requests',
            message: `Rate limit exceeded. Try again in ${Math.ceil((rateLimitResult.reset - Date.now()) / 1000)} seconds.`,
          },
          { status: 429 }
        );
      }

      // 2. Get venueId from context (already verified by withUnifiedAuth)
      const venueId = context.venueId;

      // 3. Parse request (body, query params, etc.)
      const { searchParams } = new URL(req.url);
      const body = await req.json(); // if POST/PUT

      // 4. Validate inputs
      if (!someRequiredField) {
        return NextResponse.json(
          { error: "Required field missing" },
          { status: 400 }
        );
      }

      // 5. Security: Verify any IDs belong to authenticated venue
      if (someId) {
        const { data: resource } = await supabase
          .from("some_table")
          .select("venue_id")
          .eq("id", someId)
          .eq("venue_id", venueId) // CRITICAL: Always filter by venueId
          .single();
        
        if (!resource) {
          return NextResponse.json(
            { error: "Resource not found or access denied" },
            { status: 404 }
          );
        }
      }

      // 6. Business logic
      // ... your route logic here ...

      // 7. Return success response
      return NextResponse.json({ success: true, data: result });
      
    } catch (_error) {
      // 8. Consistent error handling
      const errorMessage = _error instanceof Error ? _error.message : "An unexpected error occurred";
      const errorStack = _error instanceof Error ? _error.stack : undefined;
      
      logger.error("[ROUTE NAME] Unexpected error:", {
        error: errorMessage,
        stack: errorStack,
        venueId: context.venueId,
        userId: context.user.id,
      });
      
      // Check if it's an authentication/authorization error
      if (errorMessage.includes("Unauthorized") || errorMessage.includes("Forbidden")) {
        return NextResponse.json(
          {
            error: errorMessage.includes("Unauthorized") ? "Unauthorized" : "Forbidden",
            message: errorMessage,
          },
          { status: errorMessage.includes("Unauthorized") ? 401 : 403 }
        );
      }
      
      // Return generic error in production, detailed in development
      return NextResponse.json(
        {
          error: "Internal Server Error",
          message: process.env.NODE_ENV === "development" ? errorMessage : "Request processing failed",
          ...(process.env.NODE_ENV === "development" && errorStack ? { stack: errorStack } : {}),
        },
        { status: 500 }
      );
    }
  },
  {
    // 9. Extract venueId from request (query, body, or resource lookup)
    extractVenueId: async (req) => {
      try {
        const { searchParams } = new URL(req.url);
        let venueId = searchParams.get("venueId") || searchParams.get("venue_id");
        
        if (!venueId) {
          const body = await req.json();
          venueId = body?.venue_id || body?.venueId;
        }
        
        // If venueId comes from a resource (e.g., order, table), look it up
        if (!venueId && body?.orderId) {
          const { createAdminClient } = await import("@/lib/supabase");
          const admin = createAdminClient();
          const { data: order } = await admin
            .from("orders")
            .select("venue_id")
            .eq("id", body.orderId)
            .single();
          if (order?.venue_id) {
            return order.venue_id;
          }
        }
        
        return venueId;
      } catch {
        return null;
      }
    },
  }
);
```

## Special Cases

### 1. Dynamic Route Parameters (e.g., `[tableId]`, `[orderId]`)

```typescript
export async function GET(
  _req: NextRequest,
  routeContext: { params: Promise<{ tableId: string }> }
) {
  const handler = withUnifiedAuth(
    async (req: NextRequest, authContext) => {
      try {
        // Rate limiting
        const rateLimitResult = await rateLimit(req, RATE_LIMITS.GENERAL);
        if (!rateLimitResult.success) {
          return NextResponse.json(
            { error: 'Too many requests' },
            { status: 429 }
          );
        }

        const { tableId } = await routeContext.params;
        const venueId = authContext.venueId;

        // Verify table belongs to venue
        const { data: table } = await supabase
          .from("tables")
          .select("venue_id")
          .eq("id", tableId)
          .eq("venue_id", venueId)
          .single();

        if (!table) {
          return NextResponse.json(
            { error: "Table not found or access denied" },
            { status: 404 }
          );
        }

        // ... rest of handler
      } catch (_error) {
        // ... error handling
      }
    },
    {
      extractVenueId: async (req) => {
        // Extract from dynamic param by looking up resource
        const url = new URL(req.url);
        const pathParts = url.pathname.split('/');
        const tableIdIndex = pathParts.indexOf('by-table');
        if (tableIdIndex !== -1 && pathParts[tableIdIndex + 1]) {
          const tableId = pathParts[tableIdIndex + 1];
          const { createAdminClient } = await import("@/lib/supabase");
          const admin = createAdminClient();
          const { data: table } = await admin
            .from("tables")
            .select("venue_id")
            .eq("id", tableId)
            .single();
          if (table?.venue_id) {
            return table.venue_id;
          }
        }
        return null;
      },
    }
  );
  
  return handler(_req, routeContext);
}
```

### 2. Routes Requiring Specific Features/Tiers

```typescript
export const POST = withUnifiedAuth(
  async (req: NextRequest, context) => {
    // ... handler code
  },
  {
    requireFeature: "aiAssistant", // Requires Enterprise tier
    // OR
    requireRole: ["owner", "manager"], // Requires specific role
    extractVenueId: async (req) => {
      // ... extract venueId
    },
  }
);
```

### 3. Routes That Don't Need Venue (Admin/System Routes)

```typescript
export const POST = withUnifiedAuth(
  async (req: NextRequest, context) => {
    // ... handler code
    // Note: context.venueId may be null for admin routes
  },
  {
    requireRole: ["admin"], // Admin-only routes
    extractVenueId: async (req) => {
      // Return null for admin/system routes
      return null;
    },
  }
);
```

## Common Patterns to Replace

### Pattern 1: Old Auth Check
```typescript
// ❌ OLD - Remove this
const { requireAuthForAPI } = await import('@/lib/auth/api');
const authResult = await requireAuthForAPI(req);
if (authResult.error || !authResult.user) {
  return NextResponse.json(
    { error: 'Unauthorized' },
    { status: 401 }
  );
}

// ✅ NEW - Use withUnifiedAuth wrapper
export const GET = withUnifiedAuth(
  async (req: NextRequest, context) => {
    // context.user is already available
  }
);
```

### Pattern 2: Old Venue Access Check
```typescript
// ❌ OLD - Remove this
const venueAccessResult = await requireVenueAccessForAPI(venueId, req);
if (!venueAccessResult.success) {
  return venueAccessResult.response;
}

// ✅ NEW - withUnifiedAuth already verified venue access
// Just use context.venueId
const venueId = context.venueId;
```

### Pattern 3: Old Error Handling
```typescript
// ❌ OLD - Generic 500 for everything
catch (error) {
  return NextResponse.json(
    { error: "Internal server error" },
    { status: 500 }
  );
}

// ✅ NEW - Proper status codes
catch (_error) {
  const errorMessage = _error instanceof Error ? _error.message : "An unexpected error occurred";
  
  if (errorMessage.includes("Unauthorized")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (errorMessage.includes("Forbidden")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  
  return NextResponse.json(
    {
      error: "Internal Server Error",
      message: process.env.NODE_ENV === "development" ? errorMessage : "Request failed",
    },
    { status: 500 }
  );
}
```

## Security Checklist

For EVERY route, ensure:

- [ ] Uses `withUnifiedAuth` wrapper
- [ ] Rate limiting is implemented
- [ ] `venueId` comes from `context.venueId` (not request)
- [ ] All database queries filter by `venueId` (security)
- [ ] Resource IDs are validated to belong to authenticated venue
- [ ] Error handling returns appropriate status codes
- [ ] Logging includes `venueId` and `userId` for debugging
- [ ] No sensitive data in error messages (production)

## Routes to Fix (52 remaining)

### High Priority (Security Critical)
1. `app/api/checkout/verify/route.ts`
2. `app/api/dashboard/orders/route.ts`
3. `app/api/pos/table-sessions/route.ts`
4. `app/api/pos/bill-splits/route.ts`
5. `app/api/pos/counter-sessions/route.ts`
6. `app/api/inventory/export/csv/route.ts`
7. `app/api/inventory/export/movements/route.ts`
8. `app/api/inventory/stock/movements/route.ts`
9. `app/api/tables/[tableId]/reissue-qr/route.ts`
10. `app/api/receipts/pdf/[orderId]/route.ts`

### Medium Priority
11. `app/api/catalog/replace/route.ts`
12. `app/api/catalog/reprocess-with-url/route.ts`
13. `app/api/staff/create-invitation-function/route.ts`
14. `app/api/staff/invitations/[token]/route.ts`
15. `app/api/table-sessions/actions/route.ts`
16. `app/api/table-sessions/enhanced-merge/route.ts`
17. `app/api/table/group-session/route.ts`
18. `app/api/table-maintenance/route.ts`
19. `app/api/setup-kds/route.ts`
20. `app/api/feedback-responses/route.ts`
21. `app/api/feedback/list/route.ts`
22. `app/api/feedback/questions/route.ts`

### Lower Priority (Admin/System Routes)
23. `app/api/admin/cleanup-incomplete-accounts/route.ts`
24. `app/api/admin/force-sync-subscription/route.ts`
25. `app/api/admin/reset-tables/route.ts`
26. `app/api/admin/update-tier-to-enterprise/route.ts`
27. `app/api/cron/daily-reset/route.ts`
28. `app/api/cron/demo-reset/route.ts`
29. `app/api/daily-reset/manual/route.ts`
30. `app/api/daily-reset/route.ts`
31. `app/api/organization/ensure/route.ts`
32. `app/api/signup/complete-onboarding/route.ts`
33. `app/api/signup/with-subscription/route.ts`
34. `app/api/subscription/sync-from-stripe/route.ts`
35. `app/api/stripe/create-portal-session/route.ts`
36. `app/api/tier-check/route.ts`
37. `app/api/venue/[venueId]/tier/route.ts`
38. `app/api/venues/update-reset-time/route.ts`
39. `app/api/user/profile/route.ts`
40. `app/api/features/check/route.ts`
41. `app/api/cart/store/route.ts`
42. `app/api/cleanup-invitations/route.ts`
43. `app/api/dashboard/fix-counts/route.ts`
44. `app/api/delete-account/route.ts`
45. `app/api/errors/route.ts`
46. `app/api/fix-invitation-constraint/route.ts`
47. `app/api/fix-owner-column/route.ts`
48. `app/api/onboarding/progress/route.ts`
49. `app/api/pilot-feedback/route.ts`

## Testing Checklist

After migrating each route:

- [ ] Route returns 401 when not authenticated
- [ ] Route returns 403 when user doesn't have venue access
- [ ] Route returns 403 when feature/tier not available (if applicable)
- [ ] Route returns 429 when rate limit exceeded
- [ ] Route returns 400 for invalid inputs
- [ ] Route returns 404 for non-existent resources
- [ ] Route returns 500 for server errors (with proper logging)
- [ ] Route filters all queries by `venueId` (security)
- [ ] Route validates resource ownership (security)
- [ ] Error messages don't leak sensitive data (production)

## Verification Command

After all routes are migrated, verify:

```bash
# Find routes still using deprecated auth
find app/api -name "route.ts" -exec grep -l "requireVenueAccessForAPI\|requireAuthForAPI" {} \;

# Should return 0 results
```

## Success Criteria

✅ All routes use `withUnifiedAuth`
✅ All routes have consistent error handling
✅ All routes have rate limiting
✅ All routes validate venue access
✅ All routes filter queries by venueId
✅ All routes return proper HTTP status codes
✅ No routes use deprecated auth patterns
✅ All routes have proper logging

