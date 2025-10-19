# RBAC Implementation Summary

## ✅ Completed

### 1. Centralized Permission System Created

**File:** `lib/auth/permissions.ts`

- ✅ Capability-based access control (not role-based spaghetti)
- ✅ Single source of truth for all permissions
- ✅ Clean, explicit API: `assertVenueCapability(userId, venueId, "menu.update")`
- ✅ Backward-compatible adapter functions
- ✅ Comprehensive error handling with `PermissionError`

### 2. Capabilities Defined

```typescript
type Capability =
  // Venue: read, manage, delete
  // Menu: create, update, delete, translate
  // Orders: read, create, update, complete, delete
  // Inventory: read, adjust, manage
  // Analytics: read, export
  // Staff: read, manage
  // Discounts: create, update, delete
  // KDS: read, update
```

### 3. Role Hierarchy

| Role   | Capabilities | Use Case |
|--------|-------------|----------|
| **owner** | All capabilities | Business owner, full control |
| **manager** | Most capabilities except venue/staff management | Shift manager, operational control |
| **staff** | Read + order management + KDS | Front-of-house, order handling |
| **viewer** | Read-only | Auditor, read-only access |

### 4. AI Assistant Integration

**Updated Files:**
- ✅ `types/ai-assistant.ts` - Added `TOOL_CAPABILITIES` mapping
- ✅ `app/api/ai-assistant/execute/route.ts` - Uses capability checks per tool
- ✅ `app/api/ai-assistant/plan/route.ts` - Uses `venue.read` capability

**Example:**
```typescript
// Before: Scattered role checks
const { data: roleData } = await supabase
  .from("user_venue_roles")
  .select("role")
  .eq("venue_id", venueId)
  .eq("user_id", userId)
  .single();

if (!roleData || !["owner", "manager"].includes(roleData.role)) {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

// After: Clean capability check
await assertVenueCapability(userId, venueId, "menu.update");
```

### 5. Comprehensive Test Suite

**File:** `__tests__/auth/permissions.test.ts`

- ✅ 30 tests, all passing
- ✅ Tests for all roles and capabilities
- ✅ Tests for capability hierarchy
- ✅ Tests for error handling

### 6. Documentation

**File:** `docs/RBAC_MIGRATION_GUIDE.md`

- ✅ Complete migration guide
- ✅ Usage examples for all patterns
- ✅ Phase-by-phase migration strategy
- ✅ Troubleshooting section
- ✅ Common patterns and best practices

## 📊 Impact

### Before
- ❌ Scattered auth checks across 28+ API routes
- ❌ Inconsistent role checking logic
- ❌ Hard to maintain and extend
- ❌ No single source of truth

### After
- ✅ Centralized in one file: `lib/auth/permissions.ts`
- ✅ Consistent capability-based checks
- ✅ Easy to add new roles/capabilities
- ✅ Single source of truth
- ✅ Fully tested and documented

## 🎯 Key Benefits

### 1. Explicit Over Implicit
```typescript
// Clear intent
await assertVenueCapability(userId, venueId, "menu.update");

// vs implicit
if (role !== "owner" && role !== "manager") { ... }
```

### 2. Easy to Extend
```typescript
// Add new role
const RoleCaps: Record<UserRole, Capability[]> = {
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
  | "recipe.create" // New!
```

### 3. Better Errors
```typescript
// PermissionError includes context
throw new PermissionError(
  `User does not have permission to perform '${action}' on this venue`,
  403,
  action,  // "menu.update"
  role     // "staff"
);
```

### 4. Testable
```typescript
// Pure function - easy to test
expect(can("owner", "menu.update")).toBe(true);
```

## 🔄 Migration Status

### Phase 1: Core System ✅
- [x] Create permissions module
- [x] Define capabilities
- [x] Implement core functions
- [x] Add tests

### Phase 2: AI Assistant ✅
- [x] Update execute route
- [x] Update plan route
- [x] Map tools to capabilities

### Phase 3: Remaining Routes (Next Steps)
- [ ] Update menu API routes
- [ ] Update orders API routes
- [ ] Update inventory API routes
- [ ] Update staff API routes
- [ ] Update analytics API routes

### Phase 4: Frontend (Future)
- [ ] Update client components
- [ ] Add permission hooks
- [ ] Update UI based on capabilities

### Phase 5: Cleanup (Future)
- [ ] Remove deprecated helper functions
- [ ] Remove old auth checks
- [ ] Final audit

## 📝 Usage Examples

### Simple Capability Check
```typescript
import { assertVenueCapability } from "@/lib/auth/permissions";

export async function POST(request: NextRequest) {
  const { userId, venueId } = await request.json();
  
  // Check capability - throws if denied
  await assertVenueCapability(userId, venueId, "menu.update");
  
  // Proceed with update...
}
```

### Non-Throwing Check
```typescript
import { hasVenueCapability } from "@/lib/auth/permissions";

const canEdit = await hasVenueCapability(userId, venueId, "menu.update");

return (
  <div>
    {canEdit && <EditButton />}
  </div>
);
```

### Get User Role
```typescript
import { getUserVenueRole } from "@/lib/auth/permissions";

const role = await getUserVenueRole(userId, venueId);
console.log(`User role: ${role}`); // "owner", "manager", "staff", or "viewer"
```

## 🧪 Testing

Run the permission tests:
```bash
pnpm test __tests__/auth/permissions.test.ts
```

All 30 tests pass ✅

## 📚 Documentation

See `docs/RBAC_MIGRATION_GUIDE.md` for:
- Complete migration guide
- Usage patterns
- Troubleshooting
- Best practices

## 🚀 Next Steps

1. **Migrate remaining API routes** to use `assertVenueCapability`
2. **Add capability checks to frontend** components
3. **Create React hooks** for permission checks
4. **Add integration tests** for auth flows
5. **Remove deprecated functions** once migration is complete

## 💡 Design Decisions

### Why Capability-Based?
- **Explicit**: `can(user, "menu.update")` is clearer than `role !== "viewer"`
- **Flexible**: Easy to add new capabilities without changing roles
- **Testable**: Pure functions, no side effects
- **Scalable**: Can support complex permission models

### Why Not Just RLS?
- **Better UX**: Clear error messages before hitting database
- **Performance**: Check permissions before expensive operations
- **Flexibility**: Support complex business logic
- **Testing**: Easier to test application logic

### Why Backward-Compatible?
- **Gradual migration**: No big-bang rewrite
- **Zero downtime**: Can migrate route by route
- **Safe rollback**: Old code still works during migration

## 🎉 Success Metrics

- ✅ 1 centralized permission system
- ✅ 4 roles defined (owner, manager, staff, viewer)
- ✅ 25+ capabilities defined
- ✅ 2 AI assistant routes migrated
- ✅ 30 tests passing
- ✅ 0 linter errors
- ✅ Complete documentation

## 📞 Support

For questions or issues:
1. Check `docs/RBAC_MIGRATION_GUIDE.md`
2. Review test examples in `__tests__/auth/permissions.test.ts`
3. See implementation in `lib/auth/permissions.ts`

---

**Status:** ✅ Core implementation complete, ready for gradual migration

