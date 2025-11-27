# API Standards - 10/10 Codebase Requirements

## Overview

This document defines the **mandatory** standards for all API routes. Every route MUST follow these patterns to achieve a 10/10 codebase rating.

## 1. Environment Variables

**NEVER** use `process.env` directly. **ALWAYS** use the centralized env module:

```typescript
// ❌ BAD
const apiKey = process.env.OPENAI_API_KEY;

// ✅ GOOD
import { env } from '@/lib/env';
const apiKey = env('OPENAI_API_KEY');
```

## 2. Authentication & Authorization

**ALL** protected routes MUST use `withUnifiedAuth`:

```typescript
// ❌ BAD
export const POST = async (req: NextRequest) => {
  // Manual auth checks...
};

// ✅ GOOD
import { withUnifiedAuth } from '@/lib/auth/unified-auth';

export const POST = withUnifiedAuth(
  async (req: NextRequest, context) => {
    // context.venueId and context.user are already verified
    const venueId = context.venueId;
    const userId = context.user.id;
  }
);
```

## 3. Input Validation

**ALL** inputs MUST be validated with Zod schemas:

```typescript
// ❌ BAD
const body = await req.json();
if (!body.name) {
  return NextResponse.json({ error: 'name required' }, { status: 400 });
}

// ✅ GOOD
import { validateBody } from '@/lib/api/validation-schemas';
import { createOrderSchema } from '@/lib/api/validation-schemas';

const body = await validateBody(createOrderSchema, await req.json());
```

## 4. Error Responses

**ALL** errors MUST use the standard response format:

```typescript
// ❌ BAD
return NextResponse.json({ error: 'Not found' }, { status: 404 });

// ✅ GOOD
import { apiErrors } from '@/lib/api/standard-response';

return apiErrors.notFound('Order not found');
```

## 5. Success Responses

**ALL** success responses MUST use the standard format:

```typescript
// ❌ BAD
return NextResponse.json({ data: result }, { status: 200 });

// ✅ GOOD
import { success } from '@/lib/api/standard-response';

return success(result);
```

## 6. Rate Limiting

**ALL** routes MUST implement rate limiting:

```typescript
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { apiErrors } from '@/lib/api/standard-response';

export const POST = withUnifiedAuth(
  async (req: NextRequest, context) => {
    // STEP 1: Rate limiting (ALWAYS FIRST)
    const rateLimitResult = await rateLimit(req, RATE_LIMITS.GENERAL);
    if (!rateLimitResult.success) {
      return apiErrors.rateLimit(
        Math.ceil((rateLimitResult.reset - Date.now()) / 1000)
      );
    }
    
    // ... rest of handler
  }
);
```

## 7. Route Structure Template

Every route MUST follow this structure:

```typescript
import { NextRequest } from 'next/server';
import { withUnifiedAuth } from '@/lib/auth/unified-auth';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { validateBody } from '@/lib/api/validation-schemas';
import { success, apiErrors } from '@/lib/api/standard-response';
import { logger } from '@/lib/logger';
import { createClient } from '@/lib/supabase';
import { createOrderSchema } from '@/lib/api/validation-schemas';

export const runtime = 'nodejs';

export const POST = withUnifiedAuth(
  async (req: NextRequest, context) => {
    try {
      // STEP 1: Rate limiting (ALWAYS FIRST)
      const rateLimitResult = await rateLimit(req, RATE_LIMITS.GENERAL);
      if (!rateLimitResult.success) {
        return apiErrors.rateLimit(
          Math.ceil((rateLimitResult.reset - Date.now()) / 1000)
        );
      }

      // STEP 2: Get venueId from context (already verified)
      const venueId = context.venueId;

      // STEP 3: Validate input
      const body = await validateBody(createOrderSchema, await req.json());

      // STEP 4: Business logic
      const supabase = await createClient();
      // ... your logic here

      // STEP 5: Return success
      return success(result);
    } catch (error) {
      logger.error('[ROUTE_NAME] Error:', { error });
      return apiErrors.internal('Operation failed', error);
    }
  }
);
```

## 8. Logging

**NEVER** use `console.log`. **ALWAYS** use the logger:

```typescript
// ❌ BAD
console.log('Order created:', orderId);
console.error('Error:', error);

// ✅ GOOD
import { logger } from '@/lib/logger';

logger.info('[ORDERS] Order created', { orderId });
logger.error('[ORDERS] Error creating order', { error });
```

## 9. Type Safety

**NEVER** use `any`. **ALWAYS** use proper types:

```typescript
// ❌ BAD
function processOrder(order: any) {
  return order.data;
}

// ✅ GOOD
interface Order {
  id: string;
  venue_id: string;
  // ...
}

function processOrder(order: Order) {
  return order;
}
```

## 10. Error Handling

**ALL** errors MUST be caught and handled:

```typescript
// ❌ BAD
export const POST = async (req: NextRequest) => {
  const result = await riskyOperation();
  return success(result);
};

// ✅ GOOD
export const POST = withUnifiedAuth(
  async (req: NextRequest, context) => {
    try {
      const result = await riskyOperation();
      return success(result);
    } catch (error) {
      logger.error('[ROUTE] Error:', { error });
      return apiErrors.internal('Operation failed', error);
    }
  }
);
```

## Migration Checklist

For each route, ensure:

- [ ] Uses `withUnifiedAuth` (if protected)
- [ ] Uses `env()` instead of `process.env`
- [ ] Validates inputs with Zod schemas
- [ ] Uses standard error responses
- [ ] Uses standard success responses
- [ ] Implements rate limiting
- [ ] Uses logger instead of console
- [ ] Has proper TypeScript types (no `any`)
- [ ] Handles all errors
- [ ] Follows the route structure template

## Enforcement

- Pre-commit hooks will check for `process.env` usage
- ESLint rules enforce `withUnifiedAuth` usage
- TypeScript strict mode prevents `any` types
- Code review checklist includes all 10 points

