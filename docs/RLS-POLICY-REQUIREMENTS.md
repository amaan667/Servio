# RLS Policy Requirements

This document outlines the Row Level Security (RLS) policy requirements for all tables in the Servio multi-tenant SaaS application.

## Overview

Row Level Security (RLS) is a critical security feature that ensures users can only access data belonging to their organization/venue. All tables containing tenant-specific data MUST have RLS policies enabled.

## Core Principles

1. **Tenant Isolation**: Every query MUST filter by `venue_id` or `organization_id`
2. **Service Role Bypass**: Only admin routes (`app/api/admin/**`) should use `createAdminClient()`
3. **Authenticated Access**: All user-facing routes MUST use `createServerSupabase()` or `createClient()` with RLS enabled
4. **Explicit Filtering**: Never rely on application logic alone - RLS policies MUST enforce tenant isolation at the database level

## Tables Requiring RLS Policies

### Core Tables

#### `organizations`
- **Tenant Column**: `id` (organization_id)
- **RLS Required**: YES
- **Policies**:
  - Users can read their own organization
  - Users can update their own organization
  - Service role can manage all organizations
- **Migration**: `migrations/role-based-access-control.sql`

#### `venues`
- **Tenant Column**: `organization_id`
- **RLS Required**: YES
- **Policies**:
  - Users can read venues in their organization
  - Users can update venues in their organization
  - Service role can manage all venues
- **Migration**: `migrations/role-based-access-control.sql`

#### `users`
- **Tenant Column**: `organization_id` (via `user_organizations` join)
- **RLS Required**: YES
- **Policies**:
  - Users can read their own profile
  - Users can update their own profile
  - Service role can manage all users
- **Migration**: `migrations/role-based-access-control.sql`

### Order Management Tables

#### `orders`
- **Tenant Column**: `venue_id`
- **RLS Required**: YES
- **Policies**:
  - Users can read orders for venues they have access to
  - Users can update orders for venues they have access to
  - Service role can manage all orders
- **Migration**: `migrations/multi-venue-schema.sql`

#### `order_items`
- **Tenant Column**: `order_id` (via `orders.venue_id`)
- **RLS Required**: YES
- **Policies**:
  - Users can read order items for orders they have access to
  - Users can update order items for orders they have access to
  - Service role can manage all order items
- **Migration**: `migrations/multi-venue-schema.sql`

#### `order_status_history`
- **Tenant Column**: `order_id` (via `orders.venue_id`)
- **RLS Required**: YES
- **Policies**:
  - Users can read status history for orders they have access to
  - Service role can manage all status history
- **Migration**: `migrations/multi-venue-schema.sql`

### Menu Management Tables

#### `menu_items`
- **Tenant Column**: `venue_id`
- **RLS Required**: YES
- **Policies**:
  - Users can read menu items for venues they have access to
  - Users can create/update/delete menu items for venues they have access to
  - Service role can manage all menu items
- **Migration**: `migrations/multi-venue-schema.sql`

#### `menu_categories`
- **Tenant Column**: `venue_id`
- **RLS Required**: YES
- **Policies**:
  - Users can read categories for venues they have access to
  - Users can create/update/delete categories for venues they have access to
  - Service role can manage all categories
- **Migration**: `migrations/multi-venue-schema.sql`

#### `menu_modifiers`
- **Tenant Column**: `venue_id`
- **RLS Required**: YES
- **Policies**:
  - Users can read modifiers for venues they have access to
  - Users can create/update/delete modifiers for venues they have access to
  - Service role can manage all modifiers
- **Migration**: `migrations/multi-venue-schema.sql`

### Inventory Management Tables

#### `inventory_items`
- **Tenant Column**: `venue_id`
- **RLS Required**: YES
- **Policies**:
  - Users can read inventory for venues they have access to
  - Users can create/update/delete inventory for venues they have access to
  - Service role can manage all inventory
- **Migration**: `migrations/multi-venue-schema.sql`

#### `inventory_transactions`
- **Tenant Column**: `venue_id`
- **RLS Required**: YES
- **Policies**:
  - Users can read transactions for venues they have access to
  - Users can create transactions for venues they have access to
  - Service role can manage all transactions
- **Migration**: `migrations/multi-venue-schema.sql`

### Table Management Tables

#### `tables`
- **Tenant Column**: `venue_id`
- **RLS Required**: YES
- **Policies**:
  - Users can read tables for venues they have access to
  - Users can create/update/delete tables for venues they have access to
  - Service role can manage all tables
- **Migration**: `migrations/multi-venue-schema.sql`

#### `table_sessions`
- **Tenant Column**: `table_id` (via `tables.venue_id`)
- **RLS Required**: YES
- **Policies**:
  - Users can read sessions for tables they have access to
  - Users can create/update/delete sessions for tables they have access to
  - Service role can manage all sessions
- **Migration**: `migrations/multi-venue-schema.sql`

### Reservation Management Tables

#### `reservations`
- **Tenant Column**: `venue_id`
- **RLS Required**: YES
- **Policies**:
  - Users can read reservations for venues they have access to
  - Users can create/update/delete reservations for venues they have access to
  - Service role can manage all reservations
- **Migration**: `migrations/multi-venue-schema.sql`

### Staff Management Tables

#### `staff`
- **Tenant Column**: `venue_id`
- **RLS Required**: YES
- **Policies**:
  - Users can read staff for venues they have access to
  - Users can create/update/delete staff for venues they have access to
  - Service role can manage all staff
- **Migration**: `migrations/role-based-access-control.sql`

#### `staff_roles`
- **Tenant Column**: `venue_id`
- **RLS Required**: YES
- **Policies**:
  - Users can read roles for venues they have access to
  - Users can create/update/delete roles for venues they have access to
  - Service role can manage all roles
- **Migration**: `migrations/role-based-access-control.sql`

### Customer Management Tables

#### `customers`
- **Tenant Column**: `venue_id`
- **RLS Required**: YES
- **Policies**:
  - Users can read customers for venues they have access to
  - Users can create/update/delete customers for venues they have access to
  - Service role can manage all customers
- **Migration**: `migrations/multi-venue-schema.sql`

### Payment & Billing Tables

#### `payments`
- **Tenant Column**: `venue_id` (via `orders.venue_id`)
- **RLS Required**: YES
- **Policies**:
  - Users can read payments for venues they have access to
  - Service role can manage all payments
- **Migration**: `migrations/multi-venue-schema.sql`

#### `refunds`
- **Tenant Column**: `venue_id` (via `orders.venue_id`)
- **RLS Required**: YES
- **Policies**:
  - Users can read refunds for venues they have access to
  - Service role can manage all refunds
- **Migration**: `migrations/multi-venue-schema.sql`

#### `subscription_history`
- **Tenant Column**: `organization_id`
- **RLS Required**: YES
- **Policies**:
  - Users can read subscription history for their organization
  - Service role can manage all subscription history
- **Migration**: `migrations/multi-venue-schema.sql`

### System Tables (No RLS Required)

#### `stripe_webhook_events`
- **RLS Required**: NO (system table)
- **Access**: Service role only
- **Purpose**: Track webhook processing for idempotency

#### `idempotency_keys`
- **RLS Required**: NO (system table)
- **Access**: Service role only
- **Purpose**: Store idempotency keys for API operations

#### `kds_tickets`
- **RLS Required**: NO (derived from orders, RLS enforced at source)
- **Access**: Service role only (for creation), users can read via orders

## RLS Policy Template

```sql
-- Enable RLS on table
ALTER TABLE public.table_name ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own data
CREATE POLICY "Users can read own data"
ON public.table_name
FOR SELECT
TO authenticated
USING (
  venue_id IN (
    SELECT venue_id FROM venue_access
    WHERE user_id = auth.uid()
  )
);

-- Policy: Users can update their own data
CREATE POLICY "Users can update own data"
ON public.table_name
FOR UPDATE
TO authenticated
USING (
  venue_id IN (
    SELECT venue_id FROM venue_access
    WHERE user_id = auth.uid()
  )
);

-- Policy: Service role can manage all data
CREATE POLICY "Service role can manage all"
ON public.table_name
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);
```

## Security Checklist

When creating or modifying tables, ensure:

- [ ] RLS is enabled: `ALTER TABLE public.table_name ENABLE ROW LEVEL SECURITY;`
- [ ] Tenant column exists (`venue_id` or `organization_id`)
- [ ] Authenticated user policy exists (read/update/insert/delete)
- [ ] Service role policy exists (full access)
- [ ] Policy uses `venue_access` table for multi-venue access
- [ ] No policy allows cross-tenant access
- [ ] Migration includes RLS policy creation
- [ ] Tests verify cross-tenant access is blocked

## Common Anti-Patterns to Avoid

### 1. Using `createAdminClient()` in User-Facing Routes
```typescript
// ❌ BAD - Bypasses RLS
const supabase = createAdminClient();
const { data } = await supabase.from('orders').select('*');

// ✅ GOOD - Respects RLS
const supabase = await createServerSupabase();
const { data } = await supabase.from('orders').select('*');
```

### 2. Missing Venue ID Filter
```typescript
// ❌ BAD - No tenant isolation
const { data } = await supabase.from('orders').select('*');

// ✅ GOOD - Explicit tenant filter
const { data } = await supabase.from('orders').select('*').eq('venue_id', venueId);
```

### 3. Relying on Application Logic Only
```typescript
// ❌ BAD - RLS not enforced at DB level
if (user.venueIds.includes(order.venue_id)) {
  const { data } = await supabase.from('orders').select('*').eq('id', orderId);
}

// ✅ GOOD - RLS enforces at DB level
const { data } = await supabase.from('orders').select('*').eq('id', orderId);
// RLS policy automatically filters by venue_id
```

## Testing RLS Policies

### Unit Tests
```typescript
describe('RLS Policies', () => {
  it('should prevent cross-tenant access', async () => {
    // User from venue A tries to access venue B data
    const userA = await createUser({ venueId: 'venue-a' });
    const userB = await createUser({ venueId: 'venue-b' });
    
    // User A should not be able to access venue B orders
    const result = await supabase.auth.signInAs(userA);
    const { data, error } = await result.from('orders')
      .select('*')
      .eq('venue_id', 'venue-b');
    
    expect(error).toBeDefined();
    expect(data).toBeNull();
  });
});
```

### Integration Tests
```typescript
describe('Multi-tenant Isolation', () => {
  it('should enforce venue isolation', async () => {
    const venueA = await createVenue();
    const venueB = await createVenue();
    
    const orderA = await createOrder({ venueId: venueA.id });
    const orderB = await createOrder({ venueId: venueB.id });
    
    // User with access to venue A should only see venue A orders
    const user = await createUser({ venueIds: [venueA.id] });
    const { data: orders } = await supabase.from('orders').select('*');
    
    expect(orders).toHaveLength(1);
    expect(orders[0].id).toBe(orderA.id);
  });
});
```

## Monitoring RLS Violations

### Logging
```typescript
// Log potential RLS violations
if (data.length > expectedCount) {
  logger.warn('Potential RLS violation', {
    table: 'orders',
    userId: auth.uid(),
    expectedCount,
    actualCount: data.length,
  });
}
```

### Alerts
Set up alerts for:
- Unexpected cross-tenant access attempts
- RLS policy failures
- Service role key usage in non-admin routes

## References

- [RBAC Flow Documentation](./RBAC-FLOW.md)
- [Multi-venue Schema Migration](../migrations/multi-venue-schema.sql)
- [Role-based Access Control Migration](../migrations/role-based-access-control.sql)
- [Onboarding Guide](./ONBOARDING.md)
