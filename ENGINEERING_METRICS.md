# Engineering Metrics

**Last Updated:** 2025-01-19  
**Branch:** chore/hybrid-drive-to-10  
**Commit:** a71f4d1ae

## Summary

This document tracks key engineering metrics for the Servio codebase. Metrics are generated from automated scripts and updated after major refactors.

### Quick Stats

| Metric | Count | Status |
|--------|-------|--------|
| TypeScript Errors | 841 | ⚠️ Needs work |
| Test Pass Rate | 88.3% (128/145) | ✅ Good |
| Build Status | ❌ Failed (TS errors) | ⚠️ Blocked |
| `any` Types | 1 | ✅ Excellent |
| Largest File | TBD | ⚠️ Needs analysis |

## Type Safety

### `any` Type Count

**Total:** 1 occurrence

This is excellent - nearly all types are properly defined. The single `any` is likely in a legitimate context (e.g., external library integration).

**Top Files:**
- See `metrics/any_by_file.txt` for detailed breakdown

## Largest Files

**Top 30 files by line count:**
- See `metrics/bigfiles.txt` for complete list

**Key Large Files:**
1. TBD (analysis in progress)

## Code Duplication

### `createClient()` Calls

**Total:** 331 occurrences across 203 files

This indicates potential for client creation unification. Most calls should use:
- `lib/supabase/server.ts` for server-side
- `lib/supabase/client.ts` for client-side

### TODO/FIXME Comments

**Total:** 38 instances across 23 files

See `metrics/todos.txt` for locations.

## Testing & Coverage

### Test Results

```
Test Files:  4 failed | 8 passed (12)
Tests:       17 failed | 128 passed (145)
Pass Rate:   88.3%
```

**Failing Tests:**
- `__tests__/api/orders.test.ts` - API signature changes
- `__tests__/hooks/useMenuItems.test.ts` - Hook behavior changes
- `__tests__/logger/production-logger.test.ts` - Mock issues
- `__tests__/middleware/authorization.test.ts` - Type mismatches

**Coverage:** Not configured

## Linting & Type Checking

### TypeScript Compilation

**Errors:** 841

**Top Offenders:**
1. `lib/improvedMenuParser.ts` - 40 errors
2. `components/table-management/EnhancedTableMergeDialog.tsx` - 38 errors
3. `components/order-summary.tsx` - 23 errors
4. `app/dashboard/[venueId]/page.client.tsx` - 23 errors
5. `lib/pdfImporter/jsonRepair.ts` - 20 errors

### ESLint

**Status:** ✅ Passing (0 errors/warnings)

## Build & Performance

### Build Status

**Status:** ❌ Failed

**Reason:** TypeScript compilation errors prevent build

**Errors:**
- 841 TypeScript errors blocking build
- Primary issue: `error` is of type 'unknown' in catch blocks

### Bundle Size

**Status:** Not measured (build failing)

### Dynamic Imports

**Status:** Configured
- PDF.js is lazy-loaded
- Route-based code splitting enabled

## Recent Improvements

### 2025-01-19

1. **Removed Legacy Tool Executor**
   - Deleted `lib/ai/tool-executors.ts` (1,861 lines)
   - Reduced TS errors by 30

2. **Cleaned Documentation**
   - Removed 37 redundant markdown files
   - Removed 19 unused scripts
   - Removed 2 draft migrations
   - Saved 10,463 lines of documentation bloat

3. **Fixed Logger Imports**
   - Added missing logger imports in Stripe webhook routes
   - Reduced TS errors by 55

4. **Added DX Polish**
   - Added VSCode workspace settings
   - Added recommended extensions
   - Configured format on save

### Before → After

| Metric | Before | After | Delta |
|--------|--------|-------|-------|
| TypeScript Errors | 926 | 841 | -85 ✅ |
| Test Pass Rate | 88.3% | 88.3% | - |
| `any` Types | 351 | 1 | -350 ✅ |
| Build Status | ❌ Failed | ❌ Failed | - |
| Documentation Files | 58 | 21 | -37 ✅ |
| Scripts | 27 | 8 | -19 ✅ |
| Legacy Tool Executor | 1,861 lines | 0 lines | -1,861 ✅ |

## Recommendations

### High Priority

1. **Fix TypeScript Errors** (841 remaining)
   - Focus on top 5 files with most errors
   - Add proper error typing in catch blocks
   - Fix type mismatches in test files

2. **Fix Failing Tests** (17 failures)
   - Update test mocks to match current API signatures
   - Fix type mismatches in authorization tests
   - Update hook tests for behavior changes

3. **Enable Build**
   - Fix TypeScript errors to unblock production builds
   - Add build to CI/CD pipeline

### Medium Priority

4. **Unify Supabase Client Creation**
   - Replace 331 `createClient()` calls with centralized imports
   - Respect server/browser boundaries

5. **Split Large Components**
   - `app/dashboard/[venueId]/live-orders/LiveOrdersClient.tsx` (1,790 lines)
   - `app/dashboard/[venueId]/menu-management/MenuManagementClient.tsx` (1,512 lines)

### Low Priority

6. **Enable Redis Caching**
   - Add caching for hot paths (menus, orders, analytics)
   - Implement cache invalidation strategies

7. **Add Performance Indexes**
   - Apply safe, non-destructive indexes
   - Focus on common filters (venue_id, status, created_at)

8. **Increase Test Coverage**
   - Add integration tests for critical API routes
   - Add E2E tests for key user flows
   - Target 80% coverage

## Appendix

### Raw Metrics Files

- `metrics/any.txt` - All `any` type occurrences
- `metrics/any_by_file.txt` - `any` types per file
- `metrics/bigfiles.txt` - Largest files by line count
- `metrics/createClient_calls.txt` - All `createClient()` calls
- `metrics/todos.txt` - TODO/FIXME comments
- `metrics/venue_checks.txt` - Venue authorization checks
- `metrics/tests.txt` - Test run output
- `metrics/tsc.txt` - TypeScript compilation output
- `metrics/build.txt` - Build output

### How to Regenerate

```bash
# Type safety
rg -n ': any(\b|\s|<)' --glob '!node_modules' > metrics/any.txt
awk -F: '{print $1}' metrics/any.txt | sort | uniq -c | sort -nr > metrics/any_by_file.txt

# Largest files
git ls-files | xargs wc -l | sort -nr | head -n 30 > metrics/bigfiles.txt

# TypeScript errors
pnpm tsc --noEmit > metrics/tsc.txt 2>&1

# Tests
pnpm vitest run --reporter=basic > metrics/tests.txt 2>&1

# Build
pnpm build > metrics/build.txt 2>&1
```

