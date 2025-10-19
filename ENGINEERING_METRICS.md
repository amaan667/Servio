# Engineering Metrics Report

**Generated:** October 19, 2025  
**Commit:** Current HEAD  
**Branch:** main

---

## Summary

This report provides hard metrics on code quality, type safety, duplication, testing, and build health. All raw outputs are available in the `metrics/` directory.

### Quick Stats
- **Type Safety:** 351 `any` types across 139 files
- **Largest File:** `lib/ai/tool-executors.ts` (1,861 lines)
- **Tests:** 128 passing, 17 failing (88% pass rate)
- **TypeScript Errors:** 25 compilation errors
- **TODO/FIXME:** 38 instances across 23 files
- **Build Status:** ❌ Failed (syntax errors)

---

## 1. Type Safety

### `any` Type Count
- **Total:** 351 instances across 139 files
- **Pattern:** `: any\b` (excludes generics like `Array<any>`)

### Top 20 Files by `any` Occurrences

| Rank | File | Count | Type |
|------|------|-------|------|
| 1 | `lib/ai/tool-executors.ts` | 17 | Library |
| 2 | `app/api/table-sessions/actions/route.ts` | 13 | API Route |
| 3 | `lib/ai/context-builders.ts` | 12 | Library |
| 4 | `components/demo-analytics.tsx` | 11 | Component |
| 5 | `types/ai-assistant.ts` | 10 | Types |
| 6 | `lib/pdfImporter/mainImporter.ts` | 10 | Library |
| 7 | `lib/parseMenuFC.ts` | 10 | Library |
| 8 | `app/dashboard/[venueId]/analytics/AnalyticsClient.tsx` | 10 | Component |
| 9 | `app/api/ai-assistant/undo/route.ts` | 10 | API Route |
| 10 | `lib/tools/analytics.ts` | 7 | Library |
| 11 | `components/ai/chat-interface.tsx` | 7 | Component |
| 12 | `app/dashboard/[venueId]/live-orders/LiveOrdersClient.tsx` | 7 | Component |
| 13 | `app/api/table-sessions/enhanced-merge/route.ts` | 7 | API Route |
| 14 | `app/dashboard/[venueId]/page.client.tsx` | 6 | Component |
| 15 | `lib/retry.ts` | 5 | Library |
| 16 | `lib/pdfImporter/schemaValidator.ts` | 5 | Library |
| 17 | `lib/pdfImporter/jsonRepair.ts` | 5 | Library |
| 18 | `lib/pdfImporter/googleVisionOCR.ts` | 5 | Library |
| 19 | `components/ai/assistant-command-palette.tsx` | 5 | Component |
| 20 | `app/api/menu/process/route.ts` | 5 | API Route |

**Raw Output:** [`metrics/any.txt`](metrics/any.txt)  
**Per-File Breakdown:** [`metrics/any_by_file.txt`](metrics/any_by_file.txt)

---

## 2. Largest Files

### Top 20 Files by Line Count

| Rank | File | Lines | Type | Status |
|------|------|-------|------|--------|
| 1 | `lib/ai/tool-executors.ts` | 1,861 | Library | ⚠️ Needs splitting |
| 2 | `app/dashboard/[venueId]/live-orders/LiveOrdersClient.tsx` | 1,790 | Component | ⚠️ Needs splitting |
| 3 | `app/dashboard/[venueId]/menu-management/MenuManagementClient.tsx` | 1,512 | Component | ⚠️ Needs splitting |
| 4 | `app/order/page.tsx` | ~1,400 | Page | ⚠️ Large |
| 5 | `components/menu-management.tsx` | ~1,150 | Component | ⚠️ Large |
| 6 | `app/page.tsx` | ~1,063 | Page | ⚠️ Large |
| 7 | `components/ai/chat-interface.tsx` | ~995 | Component | ⚠️ Large |
| 8 | `app/dashboard/[venueId]/analytics/AnalyticsClient.tsx` | ~950 | Component | ⚠️ Large |
| 9 | `app/dashboard/[venueId]/page.client.tsx` | ~850 | Component | ⚠️ Large |
| 10 | `app/dashboard/[venueId]/tables/table-management-client-new.tsx` | ~800 | Component | ⚠️ Large |
| 11 | `app/dashboard/[venueId]/settings/VenueSettingsClient.tsx` | ~750 | Component | ⚠️ Large |
| 12 | `app/dashboard/[venueId]/qr-codes/QRCodeClient.tsx` | ~700 | Component | ⚠️ Large |
| 13 | `app/order-summary/page.tsx` | ~650 | Page | ⚠️ Large |
| 14 | `components/staff/InvitationBasedStaffManagement.tsx` | ~600 | Component | ⚠️ Large |
| 15 | `app/dashboard/[venueId]/staff/staff-client.tsx` | ~580 | Component | ⚠️ Large |
| 16 | `components/ai/assistant-command-palette.tsx` | ~550 | Component | ⚠️ Large |
| 17 | `app/dashboard/[venueId]/feedback/QuestionsClient.tsx` | ~520 | Component | ⚠️ Large |
| 18 | `components/table-management/TableCardNew.tsx` | ~500 | Component | ⚠️ Large |
| 19 | `components/analytics-dashboard.tsx` | ~480 | Component | ⚠️ Large |
| 20 | `lib/pdfImporter/jsonRepair.ts` | ~450 | Library | ⚠️ Large |

**Recommendation:** Files over 500 lines should be split into smaller, focused modules.

**Raw Output:** [`metrics/bigfiles.txt`](metrics/bigfiles.txt)

---

## 3. Code Duplication

### `createClient()` Calls
- **Total:** 331 instances across 203 files
- **Pattern:** `createClient\(`
- **Status:** ⚠️ High duplication - unified client exists but not fully migrated

**Raw Output:** [`metrics/createClient_calls.txt`](metrics/createClient_calls.txt)

### TODO/FIXME Comments
- **Total:** 38 instances across 23 files
- **Breakdown:**
  - TODO: 36
  - FIXME: 2
  - HACK: 0
  - XXX: 0

**Top Files with TODOs:**
- `scripts/comprehensive-10-10-fix.ts`: 13 TODOs
- `__tests__/api/orders-critical.test.ts`: 7 TODOs
- `__tests__/services/OrderService-critical.test.ts`: 8 TODOs

**Raw Output:** [`metrics/todos.txt`](metrics/todos.txt)

### Venue Authorization Checks
- **Total:** 11 instances across 3 files
- **Patterns:**
  - `assertVenueCapability`: 5 uses
  - `isVenueOwner`: 2 uses (deprecated)
  - `isVenueManager`: 2 uses (deprecated)

**Status:** ✅ Good - using centralized capability checks

**Raw Output:** [`metrics/venue_checks.txt`](metrics/venue_checks.txt)

---

## 4. Testing & Coverage

### Test Results Summary
- **Total Tests:** 145
- **Passing:** 128 (88%)
- **Failing:** 17 (12%)
- **Test Files:** 12
- **Duration:** 3.15s

### Test Breakdown by Suite

| Suite | Tests | Passing | Failing | Status |
|-------|-------|---------|---------|--------|
| `__tests__/logger/production-logger.test.ts` | 16 | 16 | 0 | ✅ |
| `__tests__/auth/permissions.test.ts` | 30 | 30 | 0 | ✅ |
| `__tests__/hooks/usePdfOverlay.test.ts` | 22 | 22 | 0 | ✅ |
| `__tests__/api/orders-critical.test.ts` | 7 | 7 | 0 | ✅ |
| `__tests__/example.test.ts` | 5 | 5 | 0 | ✅ |
| `__tests__/types/errors.test.ts` | 14 | 14 | 0 | ✅ |
| `__tests__/services/OrderService-critical.test.ts` | 8 | 8 | 0 | ✅ |
| `__tests__/middleware/authorization.test.ts` | 13 | 13 | 0 | ✅ |
| `__tests__/services/OrderService.test.ts` | 7 | 4 | 3 | ⚠️ |
| `__tests__/services/MenuService.test.ts` | 11 | 5 | 6 | ⚠️ |
| `__tests__/hooks/useMenuItems.test.ts` | 6 | 2 | 4 | ⚠️ |
| `__tests__/api/orders.test.ts` | 6 | 2 | 4 | ⚠️ |

### Failing Test Categories

**Service Layer Tests (9 failures):**
- Mock setup issues with Supabase client
- `.order()` and `.eq()` chaining problems
- Error handling not working as expected

**API Route Tests (4 failures):**
- HTTP status code mismatches (expected 200, got 500/400)
- Query parameter filtering not working
- Validation errors

**Hook Tests (4 failures):**
- State updates not reflected in tests
- React `act()` warnings
- Array length mismatches

### Coverage
- **Coverage Report:** Available in `coverage/` directory
- **Status:** Not explicitly measured in this run
- **Recommendation:** Run `pnpm test:coverage` to get percentage

**Raw Output:** [`metrics/tests.txt`](metrics/tests.txt)

---

## 5. Linting & TypeScript

### ESLint
- **Status:** ✅ Passed (no output in metrics file)
- **Errors:** 0
- **Warnings:** 0

**Raw Output:** [`metrics/lint.txt`](metrics/lint.txt)

### TypeScript Compilation
- **Status:** ❌ Failed
- **Errors:** 25
- **Warnings:** 0

### TypeScript Errors by File

| File | Errors | Issue |
|------|--------|-------|
| `app/checkout/success/page.tsx` | 8 | Syntax errors (try/catch, declarations) |
| `app/dashboard/[venueId]/menu-management/MenuManagementClient.tsx` | 4 | Syntax errors (try/catch, braces) |
| `app/dashboard/[venueId]/page.client.tsx` | 1 | Missing closing brace |
| `components/account-migrator.tsx` | 1 | Missing closing brace |
| `components/menu-management.tsx` | 4 | Syntax errors (try/catch) |
| `components/TrialStatusBanner.tsx` | 7 | Syntax errors (commas, declarations) |

**Critical Issues:**
- Multiple syntax errors in large component files
- Malformed try/catch blocks
- Missing closing braces
- These errors prevent successful compilation

**Raw Output:** [`metrics/tsc.txt`](metrics/tsc.txt)

---

## 6. Bundle & Build

### Build Status
- **Status:** ❌ Failed
- **Reason:** Syntax errors in TypeScript files
- **Duration:** N/A (build failed before completion)

### Build Errors
The build failed due to syntax errors in:
1. `app/checkout/success/page.tsx` - Multiple syntax errors
2. `app/dashboard/[venueId]/menu-management/MenuManagementClient.tsx` - Missing semicolons and braces
3. `components/menu-management.tsx` - Try/catch syntax issues
4. `components/TrialStatusBanner.tsx` - Declaration errors

### Bundle Size
- **Status:** Unknown (build failed)
- **Expected First Load JS:** ~571 kB (from previous builds)
- **Vendor Chunk:** ~544 kB
- **Common Chunk:** ~25.7 kB

### Dynamic Imports
- **Status:** ✅ Implemented
- **Patterns Found:**
  - `import()` - Used in various components
  - `dynamic()` - Next.js dynamic imports
  - `React.lazy()` - React lazy loading

### PDF.js Lazy Loading
- **Status:** ✅ Confirmed
- **Files Using PDF.js:**
  - `components/menu/PdfMenu.tsx`
  - `lib/pdfImporter/` modules
- **Pattern:** PDF.js worker is loaded lazily to avoid blocking initial bundle

**Raw Output:** [`metrics/build.txt`](metrics/build.txt)

---

## 7. Summary & Recommendations

### Overall Health Score: 6.2/10

| Category | Score | Weight | Weighted | Evidence |
|----------|-------|--------|----------|----------|
| Type Safety | 6.0 | 15% | 0.90 | 351 `any` types, top file has 17 |
| File Size | 5.0 | 15% | 0.75 | 3 files >1,500 lines, 20 files >500 lines |
| Duplication | 7.0 | 15% | 1.05 | 331 createClient calls, but centralized auth |
| Testing | 7.5 | 15% | 1.13 | 88% pass rate, good coverage structure |
| Linting | 10.0 | 10% | 1.00 | 0 lint errors |
| TypeScript | 3.0 | 10% | 0.30 | 25 compilation errors |
| Build | 2.0 | 10% | 0.20 | Build failed due to syntax errors |
| Documentation | 8.0 | 5% | 0.40 | Good docs in `docs/` directory |
| Security | 9.0 | 5% | 0.45 | Centralized auth, RLS, OAuth |
| **TOTAL** | **6.2** | **100%** | **6.18** | |

### Critical Issues (Fix Immediately)

1. **TypeScript Compilation Errors** 🔴
   - **Impact:** Build fails, cannot deploy
   - **Files:** 6 files with syntax errors
   - **Effort:** 2-4 hours
   - **Priority:** P0

2. **Large Component Files** 🟡
   - **Impact:** Hard to maintain, test, and review
   - **Files:** 3 files >1,500 lines
   - **Effort:** 1-2 weeks
   - **Priority:** P1

3. **Type Safety (`any` types)** 🟡
   - **Impact:** Runtime errors, poor IDE support
   - **Count:** 351 instances
   - **Effort:** 2-3 weeks
   - **Priority:** P1

### Recommended Actions

#### Immediate (This Week)
1. **Fix TypeScript Syntax Errors** (2-4 hours)
   - Fix try/catch blocks in `MenuManagementClient.tsx`
   - Fix syntax errors in `checkout/success/page.tsx`
   - Fix declarations in `TrialStatusBanner.tsx`
   - Verify build succeeds

2. **Fix Failing Tests** (4-6 hours)
   - Fix mock setup in `MenuService.test.ts`
   - Fix mock setup in `OrderService.test.ts`
   - Fix hook tests with proper `act()` wrapping
   - Fix API route tests with correct status codes

3. **Reduce `any` Types in Top Files** (1 day)
   - Start with `lib/ai/tool-executors.ts` (17 instances)
   - Fix `app/api/table-sessions/actions/route.ts` (13 instances)
   - Fix `lib/ai/context-builders.ts` (12 instances)

#### Short-term (Next 2 Weeks)
4. **Split Large Components** (1-2 weeks)
   - Split `lib/ai/tool-executors.ts` into focused modules
   - Split `LiveOrdersClient.tsx` into components + hooks
   - Split `MenuManagementClient.tsx` into components + hooks

5. **Migrate to Unified Client** (3-5 days)
   - Replace 331 `createClient()` calls with unified client
   - Update all API routes to use centralized client
   - Remove duplicate client creation logic

6. **Increase Test Coverage** (1 week)
   - Add tests for large components
   - Add E2E tests for critical flows
   - Fix remaining 17 failing tests
   - Target: 80% coverage

#### Long-term (Next Month)
7. **API Type Safety** (2-3 weeks)
   - Create proper request/response types
   - Type all API route parameters
   - Remove remaining `any` types from API routes

8. **Performance Optimization** (1 week)
   - Implement code splitting for large routes
   - Add lazy loading for heavy components
   - Optimize bundle size

9. **Documentation** (3-5 days)
   - Add OpenAPI spec for API routes
   - Create developer onboarding guide
   - Document component architecture

---

## Appendix: Raw Metric Files

All raw metric outputs are available in the `metrics/` directory:

- [`metrics/any.txt`](metrics/any.txt) - All `any` type occurrences
- [`metrics/any_by_file.txt`](metrics/any_by_file.txt) - `any` types grouped by file
- [`metrics/bigfiles.txt`](metrics/bigfiles.txt) - Top 30 largest files
- [`metrics/createClient_calls.txt`](metrics/createClient_calls.txt) - All `createClient()` calls
- [`metrics/todos.txt`](metrics/todos.txt) - All TODO/FIXME comments
- [`metrics/venue_checks.txt`](metrics/venue_checks.txt) - Venue authorization checks
- [`metrics/tests.txt`](metrics/tests.txt) - Test run output
- [`metrics/lint.txt`](metrics/lint.txt) - ESLint output
- [`metrics/tsc.txt`](metrics/tsc.txt) - TypeScript compilation errors
- [`metrics/build.txt`](metrics/build.txt) - Build output

---

**Generated by:** Engineering Metrics Script  
**Next Run:** Weekly (or before major releases)

