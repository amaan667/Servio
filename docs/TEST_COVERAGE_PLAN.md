# Test Coverage Improvement Plan

## Status: Type Safety ✅ Complete | Test Coverage 🚧 In Progress

### Completed ✅

1. **Type Safety (100%)**
   - ✅ Fixed all `any` types in codebase
   - ✅ Added proper TypeScript types for all functions
   - ✅ Fixed type errors in:
     - `middleware.ts` - CookieOptions type
     - `useShiftManagement.ts` - ShiftWithStaff interface
     - `useStaffManagement.ts` - ShiftWithStaff interface
     - `useDashboardRealtime.ts` - RealtimeChannel type
     - `PredictiveInsights.tsx` - Proper data interfaces
     - `AnalyticsFilters.tsx` - Type-safe select handler
     - `table-management-tools.ts` - SupabaseClient type
   - ✅ All TypeScript checks passing

2. **Test Infrastructure**
   - ✅ Created `__tests__/helpers/api-test-helpers.ts` with:
     - `createMockRequest()` - Mock NextRequest creation
     - `createAuthenticatedRequest()` - Authenticated requests
     - `createTestContext()` - Test user/venue setup
     - `cleanupTestContext()` - Test cleanup
     - `parseJsonResponse()` - Response parsing
     - `assertApiResponse()` - Response assertions

3. **Test Files Created**
   - ✅ `__tests__/api/auth.test.ts` - Auth endpoints
   - ✅ `__tests__/api/staff.test.ts` - Staff management
   - ✅ Test templates and patterns established

### In Progress 🚧

**Current Coverage**: ~12% (24/208 routes tested)

**Remaining Work**: 184 API routes need tests

### Test Coverage Strategy

#### Phase 1: Critical Routes (Priority 1) - 20 routes
- [x] Auth routes (sign-in, sign-out, refresh)
- [x] Staff management
- [ ] Orders (create, update, delete)
- [ ] Payments (Stripe integration)
- [ ] Menu management
- [ ] Tables management
- [ ] Reservations
- [ ] Inventory
- [ ] KDS (Kitchen Display System)

#### Phase 2: Important Routes (Priority 2) - 50 routes
- [ ] Analytics endpoints
- [ ] Dashboard endpoints
- [ ] User management
- [ ] Venue management
- [ ] Feedback system
- [ ] Receipt generation

#### Phase 3: Supporting Routes (Priority 3) - 114 routes
- [ ] Admin endpoints
- [ ] Cleanup jobs
- [ ] Cron jobs
- [ ] Utility endpoints
- [ ] Health checks

### How to Achieve 100% Coverage

#### Option 1: Automated Test Generation (Recommended)
```bash
# Generate test templates for all routes
pnpm tsx scripts/generate-api-tests.ts

# Then fill in the TODO sections in each generated test file
```

#### Option 2: Manual Test Creation
Follow the pattern established in `__tests__/api/staff.test.ts`:
1. Import route handlers
2. Create test context
3. Test authentication requirements
4. Test validation
5. Test success cases
6. Test error cases
7. Cleanup test data

#### Option 3: Test Coverage Tool
```bash
# Run coverage analysis
pnpm test:coverage

# Identify untested routes
pnpm tsx scripts/analyze-test-coverage.ts
```

### Test File Naming Convention

Route: `/api/staff/list/route.ts`
Test: `__tests__/api/staff-list.test.ts`

Route: `/api/orders/[orderId]/route.ts`
Test: `__tests__/api/orders-orderId.test.ts`

### Testing Checklist for Each Route

- [ ] Authentication required?
- [ ] Input validation (Zod schemas)
- [ ] Success case (200)
- [ ] Error cases (400, 401, 403, 404, 500)
- [ ] Edge cases (empty data, null values)
- [ ] Database operations (mocked or test DB)
- [ ] Cleanup (test data removal)

### Quick Start: Adding Tests for a New Route

1. **Create test file**: `__tests__/api/[route-name].test.ts`

2. **Use template**:
```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createMockRequest, createAuthenticatedRequest, createTestContext, cleanupTestContext } from "../helpers/api-test-helpers";
import { GET, POST } from "@/app/api/[route]/route";

describe("[Route Name] API", () => {
  let testContext: Awaited<ReturnType<typeof createTestContext>>;

  beforeEach(async () => {
    testContext = await createTestContext();
  });

  afterEach(async () => {
    await cleanupTestContext(testContext);
  });

  describe("GET /api/[route]", () => {
    it("should require authentication", async () => {
      const request = createMockRequest("GET", "http://localhost:3000/api/[route]");
      const response = await GET(request);
      expect(response.status).toBe(401);
    });

    it("should return data for authenticated user", async () => {
      const request = createAuthenticatedRequest("GET", "http://localhost:3000/api/[route]", testContext.userId);
      const response = await GET(request);
      expect(response.status).toBe(200);
    });
  });
});
```

3. **Run tests**: `pnpm test __tests__/api/[route-name].test.ts`

### Metrics

- **Type Safety**: 100% ✅
- **Test Coverage**: 12% → Target: 100%
- **API Routes**: 208 total
- **Tested Routes**: 24
- **Remaining**: 184

### Next Steps

1. Run test generation script to create templates
2. Prioritize critical routes (orders, payments, menu)
3. Fill in test implementations
4. Run coverage report
5. Iterate until 100% coverage

### Notes

- All `any` types have been eliminated ✅
- Test infrastructure is ready ✅
- Pattern established for consistent testing ✅
- Focus on critical business logic routes first
- Use mocks for external services (Stripe, Supabase)
- Test both success and error paths
