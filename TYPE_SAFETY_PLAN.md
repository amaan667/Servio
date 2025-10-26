# TypeScript Strictness Migration Plan

## Current Status: 8.5/10 → Target: 10/10

### Phase 1: Foundation (Current - 8.5/10)
- ✅ Zero TypeScript build errors
- ✅ Zero ESLint errors
- ✅ Basic type safety in place
- ✅ Proper null checks where critical

### Phase 2: Incremental Strictness (Target: 9/10)

#### Step 1: Enable `noUnusedLocals` and `noUnusedParameters`
**Estimated Impact**: Low (mostly cleanup)
**Action Items**:
- Prefix unused variables with `_` (e.g., `_req`, `_error`)
- Remove truly unused imports
- Fix unused function parameters

#### Step 2: Enable `noImplicitReturns`
**Estimated Impact**: Medium
**Action Items**:
- Add explicit return statements in all code paths
- Fix async functions that don't return promises properly

#### Step 3: Enable `strictNullChecks`
**Estimated Impact**: High (will catch many bugs)
**Action Items**:
- Add null checks for all potentially null values
- Use nullish coalescing (`??`) and optional chaining (`?.`)
- Fix Supabase query result handling
- Add proper type guards

### Phase 3: Full Strictness (Target: 10/10)

#### Step 4: Enable `noImplicitAny`
**Estimated Impact**: High
**Action Items**:
- Add explicit types to all function parameters
- Fix array/object iterations without types
- Type all event handlers properly

#### Step 5: Enable `strictFunctionTypes`
**Estimated Impact**: Medium
**Action Items**:
- Fix callback type mismatches
- Ensure function signatures match exactly

#### Step 6: Enable `noUncheckedIndexedAccess`
**Estimated Impact**: Medium-High
**Action Items**:
- Add checks for array/object access
- Use optional chaining for indexed access
- Consider using Map/Set where appropriate

## Implementation Strategy

1. **One setting at a time**: Enable one strict check, fix all errors, commit
2. **Start with low-impact**: Begin with `noUnusedLocals` and `noImplicitReturns`
3. **Use incremental builds**: Fix errors file by file, route by route
4. **Test thoroughly**: Ensure no runtime regressions after each phase
5. **Document patterns**: Create examples for common fixes

## Timeline Estimate

- **Phase 2**: 2-3 weeks (low-risk, high-value)
- **Phase 3**: 4-6 weeks (requires careful migration)

## Tools & Commands

```bash
# Check TypeScript errors
npm run typecheck

# Fix automatically where possible
npm run lint:fix

# Check specific file
npx tsc --noEmit path/to/file.ts
```

## Success Metrics

- ✅ Zero TypeScript errors at each phase
- ✅ Build passes successfully
- ✅ No runtime regressions
- ✅ Improved code quality and maintainability

