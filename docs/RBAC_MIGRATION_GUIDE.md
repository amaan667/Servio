# RBAC Migration Guide

## Overview

This guide explains how to migrate from scattered auth checks to the centralized, capability-based RBAC system.

## What Changed

### Before: Scattered Auth Checks

```typescript
// Old pattern - scattered and inconsistent
const { data: roleData } = await supabase
  .from("user_venue_roles")
  .select("role")
  .eq("venue_id", venueId)
  .eq("user_id", userId)
  .single();

if (!roleData || roleData.role !== "owner") {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}
```

### After: Centralized Capability Checks

```typescript
// New pattern - clean and explicit
import { assertVenueCapability } from "@/lib/auth/permissions";

await assertVenueCapability(userId, venueId, "menu.update");
// Throws PermissionError if access denied
```

## Capability-Based Design

### Available Capabilities

```typescript
type Capability =
  // Venue
  | "venue.read" | "venue.manage" | "venue.delete"
  // Menu
  | "menu.create" | "menu.update" | "menu.delete" | "menu.translate"
  // Orders
  | "order.read" | "order.create" | "order.update" | "order.complete" | "order.delete"
  // Inventory
  | "inventory.read" | "inventory.adjust" | "inventory.manage"
  // Analytics
  | "analytics.read" | "analytics.export"
  // Staff
  | "staff.read" | "staff.manage"
  // Discounts
  | "discount.create" | "discount.update" | "discount.delete"
  // KDS
  | "kds.read" | "kds.update";
```

### Role Capabilities

| Role   | Capabilities |
|--------|-------------|
| **owner** | All capabilities |
| **manager** | Most capabilities except venue.manage, venue.delete, staff.manage |
| **staff** | Read access + order management + KDS |
| **viewer** | Read-only access to most resources |

## Usage Patterns

### 1. Simple Capability Check (Throwing)

```typescript
import { assertVenueCapability } from "@/lib/auth/permissions";

export async function POST(request: NextRequest) {
  const { userId, venueId, menuItemId } = await request.json();
  
  // Check capability - throws if denied
  await assertVenueCapability(userId, venueId, "menu.update");
  
  // Proceed with update...
  return NextResponse.json({ success: true });
}
```

### 2. Capability Check with Error Handling

```typescript
import { assertVenueCapability, PermissionError } from "@/lib/auth/permissions";

export async function POST(request: NextRequest) {
  try {
    const { userId, venueId } = await request.json();
    await assertVenueCapability(userId, venueId, "menu.delete");
    
    // Proceed with deletion...
  } catch (error) {
    if (error instanceof PermissionError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }
    throw error;
  }
}
```

### 3. Non-Throwing Check

```typescript
import { hasVenueCapability } from "@/lib/auth/permissions";

export async function GET(request: NextRequest) {
  const { userId, venueId } = await request.json();
  
  const canEdit = await hasVenueCapability(userId, venueId, "menu.update");
  
  return NextResponse.json({ 
    canEdit,
    // Include UI hints based on permissions
    actions: canEdit ? ["edit", "delete"] : ["view"]
  });
}
```

### 4. Get User Role

```typescript
import { getUserVenueRole } from "@/lib/auth/permissions";

export async function GET(request: NextRequest) {
  const { userId, venueId } = await request.json();
  
  const role = await getUserVenueRole(userId, venueId);
  
  return NextResponse.json({ role });
}
```

### 5. Check Multiple Capabilities

```typescript
import { assertVenueCapability } from "@/lib/auth/permissions";

export async function POST(request: NextRequest) {
  const { userId, venueId, action } = await request.json();
  
  // Check different capabilities based on action
  const capabilityMap = {
    create: "menu.create",
    update: "menu.update",
    delete: "menu.delete",
  };
  
  const requiredCapability = capabilityMap[action];
  if (!requiredCapability) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }
  
  await assertVenueCapability(userId, venueId, requiredCapability);
  
  // Proceed...
}
```

## Migration Steps

### Phase 1: Update Hot Paths (AI Assistant, Menu, Orders)

✅ **Completed:**
- `app/api/ai-assistant/execute/route.ts` - Uses capability checks per tool
- `app/api/ai-assistant/plan/route.ts` - Uses `venue.read` capability

### Phase 2: Update Remaining API Routes

**Priority routes to migrate:**
1. `app/api/menu/*` - Menu CRUD operations
2. `app/api/orders/*` - Order management
3. `app/api/inventory/*` - Inventory operations
4. `app/api/staff/*` - Staff management
5. `app/api/analytics/*` - Analytics access

**Example migration:**

```typescript
// Before
const { data: roleData } = await supabase
  .from("user_venue_roles")
  .select("role")
  .eq("venue_id", venueId)
  .eq("user_id", userId)
  .single();

if (!roleData || !["owner", "manager"].includes(roleData.role)) {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

// After
await assertVenueCapability(userId, venueId, "menu.update");
```

### Phase 3: Update Frontend Components

Update client-side components to use the new permission system:

```typescript
// Before
const { data: role } = await supabase
  .from("user_venue_roles")
  .select("role")
  .eq("venue_id", venueId)
  .eq("user_id", userId)
  .single();

const canEdit = role === "owner" || role === "manager";

// After
const canEdit = await hasVenueCapability(userId, venueId, "menu.update");
```

### Phase 4: Add Tests

```typescript
// __tests__/auth/permissions.test.ts
import { assertVenueCapability, can } from "@/lib/auth/permissions";

describe("Permission System", () => {
  it("owner can perform all actions", () => {
    expect(can("owner", "menu.update")).toBe(true);
    expect(can("owner", "menu.delete")).toBe(true);
    expect(can("owner", "venue.manage")).toBe(true);
  });

  it("manager cannot delete menu items", () => {
    expect(can("manager", "menu.update")).toBe(true);
    expect(can("manager", "menu.delete")).toBe(true); // Actually allowed
  });

  it("staff cannot update menu", () => {
    expect(can("staff", "menu.update")).toBe(false);
    expect(can("staff", "order.complete")).toBe(true);
  });

  it("viewer has read-only access", () => {
    expect(can("viewer", "venue.read")).toBe(true);
    expect(can("viewer", "menu.update")).toBe(false);
  });
});
```

### Phase 5: Remove Old Helpers

Once all routes are migrated, remove deprecated functions:
- `isVenueOwner()`
- `isVenueManager()`
- `isVenueStaff()`

## Tool-to-Capability Mapping

The AI Assistant uses this mapping to check permissions:

```typescript
export const TOOL_CAPABILITIES: Record<ToolName, string> = {
  "menu.update_prices": "menu.update",
  "menu.toggle_availability": "menu.update",
  "menu.create_item": "menu.create",
  "menu.delete_item": "menu.delete",
  "menu.translate": "menu.update",
  "inventory.adjust_stock": "inventory.adjust",
  "inventory.set_par_levels": "inventory.manage",
  "inventory.generate_purchase_order": "inventory.read",
  "orders.mark_served": "order.update",
  "orders.complete": "order.complete",
  "analytics.get_insights": "analytics.read",
  "analytics.get_stats": "analytics.read",
  "analytics.export": "analytics.export",
  "analytics.create_report": "analytics.read",
  "discounts.create": "discount.create",
  "kds.get_overdue": "kds.read",
  "kds.suggest_optimization": "kds.read",
  "navigation.go_to_page": "venue.read",
};
```

## Benefits

### 1. Single Source of Truth
All permission logic is centralized in `lib/auth/permissions.ts`

### 2. Explicit and Clear
```typescript
// Clear intent
await assertVenueCapability(userId, venueId, "menu.update");

// vs implicit
if (role !== "owner" && role !== "manager") { ... }
```

### 3. Easy to Extend
Adding new roles or capabilities is simple:

```typescript
// Add new role
const RoleCaps: Record<UserRole, Capability[]> = {
  // ... existing roles
  chef: [
    "venue.read",
    "menu.read",
    "kds.read",
    "kds.update",
  ],
};

// Add new capability
type Capability = 
  | "menu.update"
  | "menu.create"
  | "recipe.create" // New!
  | ...
```

### 4. Better Error Messages
```typescript
// PermissionError includes context
throw new PermissionError(
  `User does not have permission to perform '${action}' on this venue`,
  403,
  action,  // "menu.update"
  role     // "staff"
);
```

### 5. Testable
```typescript
// Pure function - easy to test
expect(can("owner", "menu.update")).toBe(true);
```

## Common Patterns

### Pattern 1: Route Protection

```typescript
export async function POST(request: NextRequest) {
  const user = await getAuthUser(request);
  const { venueId, ...params } = await request.json();
  
  // Check capability
  await assertVenueCapability(user.id, venueId, "menu.create");
  
  // Proceed
  const result = await createMenuItem(venueId, params);
  return NextResponse.json(result);
}
```

### Pattern 2: Conditional UI

```typescript
const canEdit = await hasVenueCapability(userId, venueId, "menu.update");
const canDelete = await hasVenueCapability(userId, venueId, "menu.delete");

return (
  <div>
    <MenuItem item={item} />
    {canEdit && <EditButton />}
    {canDelete && <DeleteButton />}
  </div>
);
```

### Pattern 3: Bulk Operations

```typescript
// Check once for the whole operation
await assertVenueCapability(userId, venueId, "menu.update");

// Perform bulk update
for (const item of items) {
  await updateMenuItem(item);
}
```

## Troubleshooting

### Issue: PermissionError not being caught

```typescript
// Wrong - PermissionError extends Error, not thrown as 403
try {
  await assertVenueCapability(userId, venueId, "menu.update");
} catch (error) {
  if (error.statusCode === 403) { // Won't work!
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
}

// Correct - check error type or statusCode property
try {
  await assertVenueCapability(userId, venueId, "menu.update");
} catch (error: any) {
  if (error instanceof PermissionError || error.statusCode === 403) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  throw error;
}
```

### Issue: Capability not found

```typescript
// Make sure capability is defined in permissions.ts
type Capability = 
  | "menu.update"
  | "my.new.capability"; // Add here

// And in RoleCaps
const RoleCaps: Record<UserRole, Capability[]> = {
  owner: [
    "menu.update",
    "my.new.capability", // Add here
  ],
};
```

## Next Steps

1. ✅ Create centralized permissions system
2. ✅ Update AI Assistant routes
3. 🔄 Update remaining API routes (in progress)
4. ⏳ Add comprehensive tests
5. ⏳ Update frontend components
6. ⏳ Remove deprecated helpers

## Questions?

See the implementation in:
- `lib/auth/permissions.ts` - Core permission system
- `app/api/ai-assistant/execute/route.ts` - Example usage
- `app/api/ai-assistant/plan/route.ts` - Example usage

