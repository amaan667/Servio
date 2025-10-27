# API Improvements Guide

This document outlines the improvements made to standardize and enhance the API architecture.

## Universal Handler Pattern

All API routes should now use the `createUniversalHandler` function for consistency.

### Before (Inconsistent)
```typescript
export async function POST(req: Request) {
  try {
    const body = await req.json();
    // Manual validation, auth, error handling...
  } catch (error) {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
```

### After (Standardized)
```typescript
import { createPostHandler } from "@/lib/api/universal-handler";
import { z } from "zod";

const schema = z.object({
  venueId: z.string().uuid(),
  name: z.string().min(1),
});

export const POST = createPostHandler(
  async ({ body, user, venueId }) => {
    // body is already validated
    // user is authenticated if requireAuth is true
    // venueId is available if requireVenueAccess is true
    return { success: true };
  },
  {
    schema,
    requireAuth: true,
    requireVenueAccess: true,
    logRequest: true,
    logResponse: true,
  }
);
```

## Migration Process

### Creating Migrations

```bash
pnpm migrate:create add_new_table
```

This creates a timestamped SQL file in `supabase/migrations/`.

### Running Migrations

```bash
pnpm migrate
```

Migrations are tracked in the database and only run once.

## Testing

### Writing Tests

All API routes should have corresponding tests:

```typescript
import { describe, it, expect } from "vitest";
import { POST } from "./route";

describe("POST /api/example", () => {
  it("validates request body", async () => {
    const req = new Request("http://localhost/api/example", {
      method: "POST",
      body: JSON.stringify({ invalid: "data" }),
    });
    
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
```

## API Documentation

API documentation is auto-generated from JSDoc comments:

```typescript
/**
 * @swagger
 * /api/orders:
 *   get:
 *     summary: Get orders
 *     tags: [Orders]
 *     responses:
 *       200:
 *         description: List of orders
 */
```

View docs at `/api-docs` in development.

## Performance Monitoring

All API routes automatically track performance metrics. View dashboard at `/dashboard/monitoring` (admin only).

## Validation

Use Zod schemas for all request validation:

```typescript
import { z } from "zod";

const createOrderSchema = z.object({
  venueId: z.string().uuid(),
  items: z.array(z.object({
    menuItemId: z.string().uuid(),
    quantity: z.number().int().positive(),
  })),
});
```

