# API Handler Migration Guide

## Overview

All API routes should use `createUnifiedHandler` from `@/lib/api/unified-handler` for consistency and best practices.

## Migration Steps

### From `withUnifiedAuth`

```typescript
// OLD
import { withUnifiedAuth } from "@/lib/auth/unified-auth";

export const GET = withUnifiedAuth(
  async (req: NextRequest, context) => {
    // handler code
  },
  { requireFeature: "INVENTORY" }
);

// NEW
import { createUnifiedHandler } from "@/lib/api/unified-handler";

export const GET = createUnifiedHandler(
  async (req: NextRequest, context) => {
    // handler code - same signature
  },
  { 
    requireVenueAccess: true,
    requireFeature: "INVENTORY" 
  }
);
```

### From `createApiHandler`

```typescript
// OLD
import { createApiHandler } from "@/lib/api/production-handler";

export const POST = createApiHandler(
  async (req, context) => {
    // handler code
  },
  { schema: MySchema, requireVenueAccess: true }
);

// NEW
import { createUnifiedHandler } from "@/lib/api/unified-handler";

export const POST = createUnifiedHandler(
  async (req, context) => {
    // handler code - same signature
  },
  { schema: MySchema, requireVenueAccess: true }
);
```

## Features

The unified handler includes:
- ✅ Rate limiting
- ✅ Authentication & authorization
- ✅ Request validation (Zod)
- ✅ Error handling
- ✅ Performance tracking
- ✅ APM monitoring
- ✅ Idempotency support
- ✅ Request/response standardization
- ✅ Custom venueId extraction
- ✅ Role and feature checks
- ✅ Owner-only routes

## Options

All options from previous handlers are supported:
- `schema`: Zod schema for validation
- `requireAuth`: Require authentication (default: true)
- `requireVenueAccess`: Require venue access
- `requireRole`: Require specific roles
- `requireOwner`: Require owner role
- `requireFeature`: Require feature access
- `rateLimit`: Custom rate limit config
- `enforceIdempotency`: Require idempotency key
- `venueIdSource`: Where to extract venueId from
- `extractVenueId`: Custom venueId extractor function
- `autoCase`: Auto-convert snake_case ↔ camelCase
- `trackPerformance`: Track performance metrics

## Benefits

1. **Consistency**: Single handler pattern across all routes
2. **Maintainability**: One place to update handler logic
3. **Features**: All production features in one place
4. **Type Safety**: Better TypeScript support
5. **Performance**: Optimized error handling and logging
