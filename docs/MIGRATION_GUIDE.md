# Migration Guide: Upgrading to Standardized API Handlers

This guide helps you migrate existing API routes to use the new universal handler pattern.

## Benefits

- **Consistent error handling** across all endpoints
- **Automatic request validation** with Zod
- **Built-in authentication** checks
- **Automatic performance tracking**
- **Structured logging** for all requests
- **Type-safe** request/response handling

## Step-by-Step Migration

### Step 1: Identify the Route

Find an API route file (e.g., `app/api/orders/route.ts`)

### Step 2: Add Validation Schema

Create a Zod schema for request validation:

```typescript
import { z } from "zod";

const querySchema = z.object({
  venueId: z.string().uuid(),
  status: z.string().optional(),
});

const bodySchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
});
```

### Step 3: Replace Handler

**Before:**
```typescript
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const venueId = searchParams.get("venueId");
    
    if (!venueId) {
      return NextResponse.json({ error: "venueId required" }, { status: 400 });
    }
    
    // Manual auth check...
    // Business logic...
    
    return NextResponse.json({ ok: true, data: result });
  } catch (error) {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
```

**After:**
```typescript
import { createGetHandler } from "@/lib/api/universal-handler";

export const GET = createGetHandler(
  async ({ req, venueId, user }) => {
    // venueId is validated and available
    // user is authenticated
    // Business logic here...
    
    return result;
  },
  {
    requireAuth: true,
    requireVenueAccess: true,
    venueIdSource: "query",
    logRequest: true,
    logResponse: true,
  }
);
```

### Step 4: Update Tests

Update your tests to match the new handler signature:

```typescript
describe("GET /api/orders", () => {
  it("should return orders", async () => {
    const req = createMockRequest("http://localhost/api/orders?venueId=123");
    const res = await GET(req);
    const data = await res.json();
    
    expect(data.ok).toBe(true);
    expect(data.data).toBeDefined();
  });
});
```

## Common Patterns

### GET with Query Parameters
```typescript
export const GET = createGetHandler(
  async ({ req, venueId }) => {
    const url = new URL(req.url);
    const status = url.searchParams.get("status");
    // ...
  },
  {
    requireVenueAccess: true,
    venueIdSource: "query",
  }
);
```

### POST with Body Validation
```typescript
const bodySchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
});

export const POST = createPostHandler(
  async ({ body, venueId }) => {
    // body is validated
    // ...
  },
  {
    schema: bodySchema,
    requireVenueAccess: true,
  }
);
```

### Custom Error Handling
```typescript
export const POST = createPostHandler(
  async ({ body }) => {
    // ...
  },
  {
    onError: (error, req) => {
      if (error instanceof CustomError) {
        return fail(error.message, 400);
      }
      return null; // Use default handler
    },
  }
);
```

## Testing Checklist

- [ ] Request validation works
- [ ] Authentication is enforced
- [ ] Venue access is checked
- [ ] Error responses are consistent
- [ ] Success responses include `ok: true` and `data`
- [ ] Performance is tracked
- [ ] Logs are generated

## Rollback Plan

If you need to rollback, the old handler pattern still works. You can:

1. Keep the old implementation
2. Gradually migrate routes
3. Test each migration independently

## Need Help?

See `docs/API_IMPROVEMENTS.md` for more examples and patterns.

