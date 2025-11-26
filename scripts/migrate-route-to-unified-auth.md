# Route Migration Guide: withUnifiedAuth

## Pattern to Follow

### Before (Deprecated):
```typescript
import { requireVenueAccessForAPI } from '@/lib/auth/api';

export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    let venueId = searchParams.get('venueId');
    
    if (!venueId) {
      const body = await req.json();
      venueId = body?.venue_id;
    }
    
    const venueAccessResult = await requireVenueAccessForAPI(venueId, req);
    if (!venueAccessResult.success) {
      return venueAccessResult.response;
    }
    
    // ... rest of handler
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
```

### After (Unified):
```typescript
import { withUnifiedAuth } from '@/lib/auth/unified-auth';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';

export const POST = withUnifiedAuth(
  async (req: NextRequest, context) => {
    try {
      // Rate limiting
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

      // venueId comes from context (already verified)
      const venueId = context.venueId;
      
      // ... rest of handler using venueId from context
    } catch (_error) {
      const errorMessage = _error instanceof Error ? _error.message : "An unexpected error occurred";
      const errorStack = _error instanceof Error ? _error.stack : undefined;
      
      // Check error type and return appropriate status
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
    // Extract venueId from query, params, or body
    extractVenueId: async (req) => {
      const { searchParams } = new URL(req.url);
      let venueId = searchParams.get("venueId") || searchParams.get("venue_id");
      
      if (!venueId) {
        try {
          const body = await req.json();
          venueId = body?.venue_id || body?.venueId;
        } catch {
          // Body parsing failed
        }
      }
      
      return venueId;
    },
  }
);
```

## Key Changes:
1. Replace `requireVenueAccessForAPI` with `withUnifiedAuth` wrapper
2. Use `context.venueId` instead of extracting from request
3. Add rate limiting
4. Improve error handling with proper status codes
5. Use `extractVenueId` option if venueId comes from non-standard location

