# Component Refactoring Plan

## Overview

This document outlines the plan to refactor two large components into smaller, more maintainable modules:

1. **LiveOrdersClient** (1,790 LOC)
2. **MenuManagementClient** (1,472 LOC)

## Goals

- Reduce component complexity
- Improve maintainability
- Enable better code reusability
- Make testing easier
- Improve TypeScript error detection

---

## 1. LiveOrdersClient Refactoring (1,790 LOC)

### Current Structure Analysis

The component handles:

- Order fetching and real-time updates
- Order filtering and grouping by table
- Tab management (Live, Earlier Today, History)
- Order status management
- Bulk operations
- Auto-refresh functionality
- Table expansion/collapse

### Proposed Module Structure

#### 1.1 Extract Order Utilities

**File**: `lib/orders/order-utils.ts`

```typescript
// Extract these utility functions:
-filterOrdersByTable(orders, tableFilter) -
  groupOrdersByTable(orders) -
  getTableSummary(orders) -
  getStatusColor(status) -
  getPaymentStatusColor(paymentStatus) -
  formatDate(dateString);
```

#### 1.2 Extract Order Hooks

**File**: `hooks/useLiveOrders.ts` (create new)

```typescript
// Extract these hooks:
- useOrderData(venueId) - handles fetching and real-time updates
- useOrderFiltering(orders, tableFilter) - handles filtering logic
- useOrderGrouping(orders) - handles grouping logic
- useOrderRefresh() - handles manual refresh
```

#### 1.3 Extract Order Components

**File**: `components/orders/OrderTabs.tsx` (create new)

```typescript
// Extract tab rendering logic
- Tab buttons
- Tab content rendering
- Tab counts display
```

**File**: `components/orders/TableGroupCard.tsx` (create new)

```typescript
// Extract table group rendering
- Table header with total
- Expandable order list
- Bulk complete button
```

**File**: `components/orders/OrderList.tsx` (create new)

```typescript
// Extract order list rendering
- Individual order cards
- Empty state
- Loading state
```

#### 1.4 Extract Order Constants

**File**: `lib/orders/order-constants.ts` (create new)

```typescript
// Extract all status constants
export const LIVE_STATUSES = [...]
export const TERMINAL_STATUSES = [...]
export const LIVE_WINDOW_STATUSES = [...]
export const ACTIVE_TABLE_ORDER_STATUSES = [...]
export const LIVE_TABLE_ORDER_STATUSES = [...]
export const LIVE_ORDER_WINDOW_MS = 30 * 60 * 1000;
export const prepLeadMs = 30 * 60 * 1000;
```

#### 1.5 Refactored Main Component

**File**: `app/dashboard/[venueId]/live-orders/LiveOrdersClient.tsx` (refactored)

```typescript
// Now ~300-400 LOC instead of 1,790
// Imports from extracted modules
// Focuses on:
- Component orchestration
- State management coordination
- Event handlers
- Main UI layout
```

### Implementation Steps

1. Create `lib/orders/order-constants.ts` with all constants
2. Create `lib/orders/order-utils.ts` with utility functions
3. Create `hooks/useOrderData.ts` for order fetching
4. Create `components/orders/OrderTabs.tsx`
5. Create `components/orders/TableGroupCard.tsx`
6. Create `components/orders/OrderList.tsx`
7. Refactor main `LiveOrdersClient.tsx` to use new modules
8. Test thoroughly

---

## 2. MenuManagementClient Refactoring (1,472 LOC)

### Current Structure Analysis

The component handles:

- Menu item CRUD operations
- Category management
- Drag and drop reordering
- Design settings management
- PDF menu display
- Logo upload
- Preview modes

### Proposed Module Structure

#### 2.1 Extract Menu Utilities

**File**: `lib/menu/menu-utils.ts`

```typescript
// Extract these utility functions:
-formatMenuItem(item) -
  validateMenuItem(item) -
  groupItemsByCategory(items) -
  sortItemsByPosition(items) -
  calculateMenuStats(items);
```

#### 2.2 Extract Menu Hooks

**File**: `hooks/useMenuItems.ts` (enhance existing)

```typescript
// Enhance existing hook with:
- useMenuItems(venueId) - CRUD operations
- useMenuDragDrop(menuItems, onReorder) - drag and drop logic
- useMenuCategories(venueId) - category management
```

**File**: `hooks/useDesignSettings.ts` (enhance existing)

```typescript
// Enhance existing hook with:
- useDesignSettings(venueId) - design settings management
- useLogoUpload() - logo upload logic
- useMenuPreview(menuItems, settings) - preview logic
```

#### 2.3 Extract Menu Components

**File**: `components/menu/MenuItemForm.tsx` (create new)

```typescript
// Extract menu item form
- Add/edit modal
- Form validation
- Submit handling
```

**File**: `components/menu/MenuItemCard.tsx` (create new)

```typescript
// Extract menu item card
- Item display
- Edit/delete buttons
- Availability toggle
- Drag handle
```

**File**: `components/menu/CategorySection.tsx` (create new)

```typescript
// Extract category section
- Category header
- Expandable items list
- Add item button
```

**File**: `components/menu/DesignSettingsPanel.tsx` (create new)

```typescript
// Extract design settings panel
- Color pickers
- Font settings
- Logo upload
- Preview options
```

**File**: `components/menu/MenuPreviewPanel.tsx` (create new)

```typescript
// Extract preview panel
- Preview mode toggle
- PDF/styled/simple preview
- Share functionality
```

#### 2.4 Extract Menu Types

**File**: `types/menu.ts` (create new)

```typescript
// Extract all menu-related types
export interface MenuItem { ... }
export interface DesignSettings { ... }
export interface MenuCategory { ... }
export interface MenuStats { ... }
```

#### 2.5 Refactored Main Component

**File**: `app/dashboard/[venueId]/menu-management/MenuManagementClient.tsx` (refactored)

```typescript
// Now ~300-400 LOC instead of 1,472
// Imports from extracted modules
// Focuses on:
- Component orchestration
- Tab management
- State coordination
- Main UI layout
```

### Implementation Steps

1. Create `types/menu.ts` with all types
2. Create `lib/menu/menu-utils.ts` with utility functions
3. Enhance `hooks/useMenuItems.ts`
4. Enhance `hooks/useDesignSettings.ts`
5. Create `components/menu/MenuItemForm.tsx`
6. Create `components/menu/MenuItemCard.tsx`
7. Create `components/menu/CategorySection.tsx`
8. Create `components/menu/DesignSettingsPanel.tsx`
9. Create `components/menu/MenuPreviewPanel.tsx`
10. Refactor main `MenuManagementClient.tsx` to use new modules
11. Test thoroughly

---

## 3. TypeScript Error Fixing Strategy

### Current Status

- 809 TypeScript errors remaining
- Main error types:
  - 333 × TS18046: 'error'/'err' is of type 'unknown'
  - 270 × TS2345: Type assignment issues
  - 93 × TS2339: Property does not exist

### Fixing Strategy

#### Phase 1: Create Error Handling Utilities

✅ **COMPLETED**: Created `lib/utils/errors.ts` with:

- `getErrorMessage(error)` - safely extract error messages
- `getErrorDetails(error)` - safely extract error details
- `isErrorOfType(error, type)` - type guards
- `stringifyError(error)` - safe error stringification

#### Phase 2: Fix Catch Blocks

Replace all catch blocks from:

```typescript
catch (error) {
  console.error(error.message); // Error: TS18046
}
```

To:

```typescript
catch (error: unknown) {
  console.error(getErrorMessage(error)); // Fixed
}
```

#### Phase 3: Fix Logger Calls

Replace logger calls from:

```typescript
logger.error('message', error); // Error: TS2345
```

To:

```typescript
logger.error('message', getErrorDetails(error)); // Fixed
```

#### Phase 4: Fix Property Access

Replace property access from:

```typescript
error.message; // Error: TS2339
```

To:

```typescript
getErrorMessage(error); // Fixed
```

### Automated Fix Script

Create a script to automatically fix common patterns:

```python
# scripts/fix-ts-errors-final.py
# 1. Find all catch blocks and add : unknown type
# 2. Replace error.message with getErrorMessage(error)
# 3. Replace logger calls with proper error handling
# 4. Add imports for error utilities
```

---

## 4. Pre-commit Hooks Setup

✅ **COMPLETED**: Installed and configured Husky

### Current Setup

- **Pre-commit hook**: Runs type checking and linting
- **Pre-push hook**: Runs tests
- **Husky version**: 9.1.7

### Hook Configuration

```bash
# .husky/pre-commit
pnpm typecheck:all  # TypeScript type checking
pnpm lint          # ESLint
```

```bash
# .husky/pre-push
pnpm test          # Run tests
```

---

## 5. Implementation Priority

### High Priority (Week 1)

1. ✅ Add pre-commit hooks with Husky
2. Create error handling utilities
3. Fix critical TypeScript errors in API routes
4. Extract order constants from LiveOrdersClient

### Medium Priority (Week 2)

1. Extract order utilities from LiveOrdersClient
2. Extract menu utilities from MenuManagementClient
3. Create order components
4. Create menu components

### Low Priority (Week 3)

1. Refactor main LiveOrdersClient component
2. Refactor main MenuManagementClient component
3. Fix remaining TypeScript errors
4. Add comprehensive tests

---

## 6. Testing Strategy

### Unit Tests

- Test all utility functions
- Test all hooks
- Test all components in isolation

### Integration Tests

- Test component interactions
- Test data flow
- Test error handling

### E2E Tests

- Test complete user workflows
- Test order management flow
- Test menu management flow

---

## 7. Success Metrics

### Code Quality

- [ ] Zero TypeScript errors
- [ ] All components under 500 LOC
- [ ] 80%+ test coverage
- [ ] All linting errors fixed

### Performance

- [ ] No performance regressions
- [ ] Faster build times
- [ ] Better code splitting

### Maintainability

- [ ] Clear separation of concerns
- [ ] Reusable components
- [ ] Well-documented code
- [ ] Easy to test

---

## 8. Next Steps

1. **Review this plan** with the team
2. **Prioritize** which components to refactor first
3. **Create branches** for each refactoring task
4. **Implement** changes incrementally
5. **Test** thoroughly after each change
6. **Review** code before merging
7. **Monitor** for any issues after deployment

---

## Notes

- All refactoring should be done incrementally
- Each module should be tested before moving to the next
- Keep the main components working throughout the refactoring
- Use feature flags if needed to gradually roll out changes
- Document all breaking changes
- Update tests as you go

---

**Last Updated**: 2025-01-19
**Status**: In Progress
**Next Review**: After Phase 1 completion
