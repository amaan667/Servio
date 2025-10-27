# Quick Start: Using the New Improvements

## Standardized API Handlers

All new API routes should use the universal handler:

```typescript
import { createPostHandler } from "@/lib/api/universal-handler";
import { z } from "zod";

const schema = z.object({
  venueId: z.string().uuid(),
  name: z.string().min(1),
});

export const POST = createPostHandler(
  async ({ body, venueId, user }) => {
    // Your logic here
    return { success: true };
  },
  {
    schema,
    requireAuth: true,
    requireVenueAccess: true,
  }
);
```

## Database Migrations

### Create a Migration
```bash
pnpm migrate:create add_user_preferences
```

This creates: `supabase/migrations/YYYYMMDDHHMMSS_add_user_preferences.sql`

### Run Migrations
```bash
pnpm migrate
```

Migrations are tracked and only run once.

## Testing

### Write Tests for API Routes
```typescript
import { describe, it, expect } from "vitest";
import { createMockRequest } from "@/vitest.test-scaffold";
import { GET } from "./route";

describe("GET /api/example", () => {
  it("should return 401 if not authenticated", async () => {
    const req = createMockRequest("http://localhost/api/example");
    const res = await GET(req);
    expect(res.status).toBe(401);
  });
});
```

## API Documentation

Add JSDoc comments to your routes:

```typescript
/**
 * @swagger
 * /api/orders:
 *   get:
 *     summary: Get orders
 *     tags: [Orders]
 *     responses:
 *       200:
 *         description: Success
 */
```

View docs at `/api-docs`

## Performance Monitoring

View real-time metrics at `/dashboard/monitoring` (admin only)

## CI/CD

All changes are automatically:
- Linted
- Type-checked
- Tested
- Built

On every push to `main` or `develop`.

