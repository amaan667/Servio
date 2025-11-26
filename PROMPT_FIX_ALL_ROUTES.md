# PROMPT: Fix All Remaining Routes to Use withUnifiedAuth

## Task
Systematically migrate ALL 52 remaining API routes to use `withUnifiedAuth` for consistent authentication, authorization, tier checks, and error handling.

## Requirements

### 1. **Mandatory Pattern for ALL Routes**

Every route MUST follow this exact structure:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { withUnifiedAuth } from '@/lib/auth/unified-auth';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { logger } from "@/lib/logger";
// ... other imports

export const GET = withUnifiedAuth(  // or POST, PUT, DELETE
  async (req: NextRequest, context) => {
    try {
      // STEP 1: Rate limiting (ALWAYS FIRST)
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

      // STEP 2: Get venueId from context (already verified)
      const venueId = context.venueId;

      // STEP 3: Parse request
      const { searchParams } = new URL(req.url);
      const body = await req.json(); // if POST/PUT

      // STEP 4: Validate inputs
      if (!requiredField) {
        return NextResponse.json(
          { error: "Required field missing" },
          { status: 400 }
        );
      }

      // STEP 5: Security - Verify resource belongs to venue
      if (resourceId) {
        const { data: resource } = await supabase
          .from("table_name")
          .select("venue_id")
          .eq("id", resourceId)
          .eq("venue_id", venueId) // CRITICAL: Always filter by venueId
          .single();
        
        if (!resource) {
          return NextResponse.json(
            { error: "Resource not found or access denied" },
            { status: 404 }
          );
        }
      }

      // STEP 6: Business logic
      // ... your code here ...

      // STEP 7: Return response
      return NextResponse.json({ success: true, data: result });
      
    } catch (_error) {
      // STEP 8: Consistent error handling
      const errorMessage = _error instanceof Error ? _error.message : "An unexpected error occurred";
      const errorStack = _error instanceof Error ? _error.stack : undefined;
      
      logger.error("[ROUTE_NAME] Unexpected error:", {
        error: errorMessage,
        stack: errorStack,
        venueId: context.venueId,
        userId: context.user.id,
      });
      
      if (errorMessage.includes("Unauthorized") || errorMessage.includes("Forbidden")) {
        return NextResponse.json(
          {
            error: errorMessage.includes("Unauthorized") ? "Unauthorized" : "Forbidden",
            message: errorMessage,
          },
          { status: errorMessage.includes("Unauthorized") ? 401 : 403 }
        );
      }
      
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
    // STEP 9: Extract venueId from request
    extractVenueId: async (req) => {
      try {
        const { searchParams } = new URL(req.url);
        let venueId = searchParams.get("venueId") || searchParams.get("venue_id");
        
        if (!venueId) {
          const body = await req.json();
          venueId = body?.venue_id || body?.venueId;
        }
        
        // If venueId comes from a resource, look it up
        // Example: if orderId provided, look up order.venue_id
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
    // Optional: Add feature/role requirements
    // requireFeature: "aiAssistant",
    // requireRole: ["owner", "manager"],
  }
);
```

### 2. **What to Remove**

❌ Remove ALL instances of:
- `requireVenueAccessForAPI`
- `requireAuthForAPI`
- Manual auth checks
- Manual venue access checks
- Generic error handling that returns 500 for everything

### 3. **What to Add**

✅ Add:
- `withUnifiedAuth` wrapper
- Rate limiting (first thing in handler)
- Proper error handling with status codes
- Venue validation for all resource lookups
- Logging with `venueId` and `userId`

### 4. **Security Rules**

1. **NEVER** trust `venue_id` from request body/query - always use `context.venueId`
2. **ALWAYS** filter database queries by `venueId` (security)
3. **ALWAYS** validate resource ownership before operations
4. **ALWAYS** return 404 (not 403) when resource doesn't exist or belongs to different venue

### 5. **Error Handling Rules**

- `400` - Bad Request (validation errors, missing fields)
- `401` - Unauthorized (not authenticated)
- `403` - Forbidden (no access, feature not available, wrong tier)
- `404` - Not Found (resource doesn't exist or wrong venue)
- `429` - Too Many Requests (rate limit)
- `500` - Internal Server Error (server errors only)

## Routes to Fix (52 total)

### Priority 1: Security Critical (Fix First)
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

### Priority 2: Important Features
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

### Priority 3: Admin/System Routes
23-52. All remaining routes in the list (see ROUTE_MIGRATION_GUIDE.md for full list)

## Process

1. **Read the route file** - Understand what it does
2. **Identify auth pattern** - Find `requireVenueAccessForAPI` or `requireAuthForAPI`
3. **Replace with withUnifiedAuth** - Follow the pattern above
4. **Add rate limiting** - First thing in handler
5. **Fix venue access** - Use `context.venueId`, validate resources
6. **Fix error handling** - Proper status codes
7. **Test** - Verify it works
8. **Commit** - Commit each route or batch of similar routes

## Verification

After fixing each route, verify:
- ✅ No linter errors
- ✅ Uses `withUnifiedAuth`
- ✅ Has rate limiting
- ✅ Uses `context.venueId`
- ✅ Filters queries by `venueId`
- ✅ Returns proper status codes
- ✅ Has proper error handling

## Final Check

Run this command - should return 0 results:
```bash
find app/api -name "route.ts" -exec grep -l "requireVenueAccessForAPI\|requireAuthForAPI" {} \;
```

## Success Criteria

✅ All 52 routes migrated
✅ All routes use `withUnifiedAuth`
✅ All routes have consistent error handling
✅ All routes have rate limiting
✅ All routes validate venue access
✅ All routes filter queries by venueId
✅ Zero routes use deprecated auth patterns
✅ All routes work flawlessly

