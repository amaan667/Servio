# Route Migration Progress Report

## Summary
Successfully migrated **2 out of 49 routes** to use `withUnifiedAuth` for consistent authentication, authorization, tier checks, and error handling.

## Completed Routes ✅

### 1. `app/api/checkout/verify/route.ts`
- **Status**: ✅ COMPLETED
- **Pattern**: Complex route with Stripe session verification
- **Key Changes**:
  - Replaced `requireAuthForAPI` with `withUnifiedAuth` wrapper
  - Added custom `extractVenueId` to lookup venue from Stripe session
  - Added venue filtering to order queries for security
  - Improved error handling with proper status codes
  - Added comprehensive logging with venueId and userId

### 2. `app/api/dashboard/orders/route.ts`
- **Status**: ✅ COMPLETED
- **Pattern**: Standard GET route with query params
- **Key Changes**:
  - Replaced `requireVenueAccessForAPI` with `withUnifiedAuth` wrapper
  - Added rate limiting as first step in handler
  - Added proper error handling with status codes
  - Added venueId extraction from query params
  - Maintained all existing business logic and caching

## Verification
✅ Confirmed via `find` command that both completed routes no longer contain deprecated auth patterns.

## Remaining Routes (47 total)

### Priority 1: Security Critical (8 remaining)
3. `app/api/pos/table-sessions/route.ts` - POS table sessions management
4. `app/api/pos/bill-splits/route.ts` - Bill splitting functionality  
5. `app/api/pos/counter-sessions/route.ts` - Counter session handling
6. `app/api/inventory/export/csv/route.ts` - Inventory CSV export
7. `app/api/inventory/export/movements/route.ts` - Inventory movements export
8. `app/api/inventory/stock/movements/route.ts` - Stock movements tracking
9. `app/api/tables/[tableId]/reissue-qr/route.ts` - QR code reissue (dynamic route)
10. `app/api/receipts/pdf/[orderId]/route.ts` - Receipt PDF generation (dynamic route)

### Priority 2: Important Features (12 routes)
11-22. See full list in ROUTE_MIGRATION_GUIDE.md

### Priority 3: Admin/System Routes (27 routes)
23-49. See full list in ROUTE_MIGRATION_GUIDE.md

## Migration Pattern Established

All routes should follow this exact structure:

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

## Special Cases to Handle

### Dynamic Routes (e.g., `[tableId]`, `[orderId]`)
Routes like `app/api/tables/[tableId]/reissue-qr/route.ts` need custom `extractVenueId` logic:

```typescript
extractVenueId: async (req, routeParams) => {
  const params = await routeParams?.params;
  const tableId = params?.tableId;
  
  if (!tableId) return null;
  
  const admin = createAdminClient();
  const { data: table } = await admin
    .from("tables")
    .select("venue_id")
    .eq("id", tableId)
    .single();
    
  return table?.venue_id || null;
}
```

### Admin/System Routes
Routes without venue access need:

```typescript
{
  requireRole: ["admin"],
  extractVenueId: async () => null, // No venue required
}
```

### Feature-Gated Routes
Routes requiring specific features need:

```typescript
{
  requireFeature: "aiAssistant", // Requires Enterprise tier
}
```

## Next Steps

1. **Continue with Priority 1 routes** (security critical)
2. **Test each route** after migration to ensure functionality
3. **Run verification** periodically: `find app/api -name "route.ts" -exec grep -l "requireVenueAccessForAPI\|requireAuthForAPI" {} \;`
4. **Complete all 47 remaining routes** using the established pattern

## Success Criteria

✅ All routes use `withUnifiedAuth`  
✅ All routes have consistent error handling  
✅ All routes have rate limiting  
✅ All routes validate venue access  
✅ All routes filter queries by venueId  
✅ All routes return proper HTTP status codes  
✅ No routes use deprecated auth patterns  
✅ All routes have proper logging