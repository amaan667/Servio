# Large Files Split Plan

Generated: 2025-10-19T16:50:43.210Z

## Summary

Total large files (>1000 lines): 6

## Files to Split


### lib/ai/tool-executors.ts (1862 lines)

**Recommendation:** Split by tool category: table-tools/, order-tools/, menu-tools/, etc.

**Strategy:**
1. Identify logical boundaries (features, concerns, responsibilities)
2. Extract into separate files/modules
3. Update imports across codebase
4. Test thoroughly

**Priority:** 🔴 HIGH


### app/dashboard/[venueId]/live-orders/LiveOrdersClient.tsx (1792 lines)

**Recommendation:** Split into: hooks/, components/, and utils/ subdirectories

**Strategy:**
1. Identify logical boundaries (features, concerns, responsibilities)
2. Extract into separate files/modules
3. Update imports across codebase
4. Test thoroughly

**Priority:** 🔴 HIGH


### app/dashboard/[venueId]/menu-management/MenuManagementClient.tsx (1517 lines)

**Recommendation:** Split into: hooks/, components/, and utils/ subdirectories

**Strategy:**
1. Identify logical boundaries (features, concerns, responsibilities)
2. Extract into separate files/modules
3. Update imports across codebase
4. Test thoroughly

**Priority:** 🔴 HIGH


### app/order/page.tsx (1452 lines)

**Recommendation:** Split into focused modules by feature/concern

**Strategy:**
1. Identify logical boundaries (features, concerns, responsibilities)
2. Extract into separate files/modules
3. Update imports across codebase
4. Test thoroughly

**Priority:** 🟡 MEDIUM


### components/menu-management.tsx (1153 lines)

**Recommendation:** Split into focused modules by feature/concern

**Strategy:**
1. Identify logical boundaries (features, concerns, responsibilities)
2. Extract into separate files/modules
3. Update imports across codebase
4. Test thoroughly

**Priority:** 🟢 LOW


### app/page.tsx (1065 lines)

**Recommendation:** Split into focused modules by feature/concern

**Strategy:**
1. Identify logical boundaries (features, concerns, responsibilities)
2. Extract into separate files/modules
3. Update imports across codebase
4. Test thoroughly

**Priority:** 🟢 LOW


## Implementation Priority

### Phase 1: Critical (>1500 lines)
- [ ] lib/ai/tool-executors.ts
- [ ] app/dashboard/[venueId]/live-orders/LiveOrdersClient.tsx
- [ ] app/dashboard/[venueId]/menu-management/MenuManagementClient.tsx

### Phase 2: Important (1200-1500 lines)
- [ ] app/order/page.tsx

### Phase 3: Nice to Have (1000-1200 lines)
- [ ] components/menu-management.tsx
- [ ] app/page.tsx

## General Split Guidelines

1. **Component Files:** Split into smaller components in a components/ subdirectory
2. **Hook Files:** Extract custom hooks into hooks/ subdirectory
3. **Utility Files:** Group related utilities into focused modules
4. **API Routes:** Extract business logic into service layer
5. **Tool Executors:** Group by domain (tables, orders, menu, etc.)

## Target Sizes

- **Components:** < 300 lines
- **Hooks:** < 200 lines
- **Utils:** < 300 lines
- **API Routes:** < 200 lines (business logic in services)
- **Services:** < 500 lines

## Benefits

- ✅ Better maintainability
- ✅ Easier to test
- ✅ Faster IDE performance
- ✅ Clearer separation of concerns
- ✅ Easier code reviews
- ✅ Better reusability
