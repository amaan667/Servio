-- RLS Policies Documentation and Migration
-- This file documents all Row Level Security (RLS) policies for Servio
-- Run this migration to ensure all policies are properly set up

-- ============================================================================
-- VENUES TABLE
-- ============================================================================

-- Enable RLS
ALTER TABLE venues ENABLE ROW LEVEL SECURITY;

-- Policy: Owners can view and manage their own venues
DROP POLICY IF EXISTS "owners_manage_own_venues" ON venues;
CREATE POLICY "owners_manage_own_venues" ON venues
  FOR ALL
  USING (owner_user_id = auth.uid())
  WITH CHECK (owner_user_id = auth.uid());

-- Policy: Staff can view venues they have roles in
DROP POLICY IF EXISTS "staff_view_venues" ON venues;
CREATE POLICY "staff_view_venues" ON venues
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_venue_roles
      WHERE user_venue_roles.venue_id = venues.venue_id
      AND user_venue_roles.user_id = auth.uid()
    )
  );

-- ============================================================================
-- ORDERS TABLE
-- ============================================================================

-- Enable RLS
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Policy: Venue owners can manage all orders for their venues
DROP POLICY IF EXISTS "owners_manage_venue_orders" ON orders;
CREATE POLICY "owners_manage_venue_orders" ON orders
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM venues
      WHERE venues.venue_id = orders.venue_id
      AND venues.owner_user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM venues
      WHERE venues.venue_id = orders.venue_id
      AND venues.owner_user_id = auth.uid()
    )
  );

-- Policy: Staff can view and update orders for venues they have access to
DROP POLICY IF EXISTS "staff_manage_venue_orders" ON orders;
CREATE POLICY "staff_manage_venue_orders" ON orders
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_venue_roles
      WHERE user_venue_roles.venue_id = orders.venue_id
      AND user_venue_roles.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_venue_roles
      WHERE user_venue_roles.venue_id = orders.venue_id
      AND user_venue_roles.user_id = auth.uid()
    )
  );

-- ============================================================================
-- MENU_ITEMS TABLE
-- ============================================================================

-- Enable RLS
ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;

-- Policy: Venue owners can manage menu items for their venues
DROP POLICY IF EXISTS "owners_manage_venue_menu_items" ON menu_items;
CREATE POLICY "owners_manage_venue_menu_items" ON menu_items
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM venues
      WHERE venues.venue_id = menu_items.venue_id
      AND venues.owner_user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM venues
      WHERE venues.venue_id = menu_items.venue_id
      AND venues.owner_user_id = auth.uid()
    )
  );

-- Policy: Staff can view menu items (read-only for most roles)
DROP POLICY IF EXISTS "staff_view_venue_menu_items" ON menu_items;
CREATE POLICY "staff_view_venue_menu_items" ON menu_items
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_venue_roles
      WHERE user_venue_roles.venue_id = menu_items.venue_id
      AND user_venue_roles.user_id = auth.uid()
    )
  );

-- Policy: Managers can edit menu items
DROP POLICY IF EXISTS "managers_edit_menu_items" ON menu_items;
CREATE POLICY "managers_edit_menu_items" ON menu_items
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_venue_roles
      WHERE user_venue_roles.venue_id = menu_items.venue_id
      AND user_venue_roles.user_id = auth.uid()
      AND user_venue_roles.role IN ('owner', 'manager')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_venue_roles
      WHERE user_venue_roles.venue_id = menu_items.venue_id
      AND user_venue_roles.user_id = auth.uid()
      AND user_venue_roles.role IN ('owner', 'manager')
    )
  );

-- ============================================================================
-- USER_VENUE_ROLES TABLE
-- ============================================================================

-- Enable RLS
ALTER TABLE user_venue_roles ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own roles
DROP POLICY IF EXISTS "users_view_own_roles" ON user_venue_roles;
CREATE POLICY "users_view_own_roles" ON user_venue_roles
  FOR SELECT
  USING (user_id = auth.uid());

-- Policy: Venue owners can manage roles for their venues
DROP POLICY IF EXISTS "owners_manage_venue_roles" ON user_venue_roles;
CREATE POLICY "owners_manage_venue_roles" ON user_venue_roles
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM venues
      WHERE venues.venue_id = user_venue_roles.venue_id
      AND venues.owner_user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM venues
      WHERE venues.venue_id = user_venue_roles.venue_id
      AND venues.owner_user_id = auth.uid()
    )
  );

-- ============================================================================
-- KDS_TICKETS TABLE
-- ============================================================================

-- Enable RLS
ALTER TABLE kds_tickets ENABLE ROW LEVEL SECURITY;

-- Policy: Staff with kitchen/KDS access can view and update tickets
DROP POLICY IF EXISTS "kitchen_staff_manage_tickets" ON kds_tickets;
CREATE POLICY "kitchen_staff_manage_tickets" ON kds_tickets
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_venue_roles
      WHERE user_venue_roles.venue_id = kds_tickets.venue_id
      AND user_venue_roles.user_id = auth.uid()
      AND user_venue_roles.role IN ('owner', 'manager', 'kitchen')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_venue_roles
      WHERE user_venue_roles.venue_id = kds_tickets.venue_id
      AND user_venue_roles.user_id = auth.uid()
      AND user_venue_roles.role IN ('owner', 'manager', 'kitchen')
    )
  );

-- ============================================================================
-- TABLES TABLE
-- ============================================================================

-- Enable RLS
ALTER TABLE tables ENABLE ROW LEVEL SECURITY;

-- Policy: Venue owners and staff can manage tables
DROP POLICY IF EXISTS "venue_staff_manage_tables" ON tables;
CREATE POLICY "venue_staff_manage_tables" ON tables
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM venues
      WHERE venues.venue_id = tables.venue_id
      AND (
        venues.owner_user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM user_venue_roles
          WHERE user_venue_roles.venue_id = tables.venue_id
          AND user_venue_roles.user_id = auth.uid()
        )
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM venues
      WHERE venues.venue_id = tables.venue_id
      AND (
        venues.owner_user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM user_venue_roles
          WHERE user_venue_roles.venue_id = tables.venue_id
          AND user_venue_roles.user_id = auth.uid()
        )
      )
    )
  );

-- ============================================================================
-- INVENTORY TABLES
-- ============================================================================

-- Enable RLS for ingredients
ALTER TABLE ingredients ENABLE ROW LEVEL SECURITY;

-- Policy: Venue owners and managers can manage ingredients
DROP POLICY IF EXISTS "managers_manage_ingredients" ON ingredients;
CREATE POLICY "managers_manage_ingredients" ON ingredients
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM venues
      WHERE venues.venue_id = ingredients.venue_id
      AND (
        venues.owner_user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM user_venue_roles
          WHERE user_venue_roles.venue_id = ingredients.venue_id
          AND user_venue_roles.user_id = auth.uid()
          AND user_venue_roles.role IN ('owner', 'manager')
        )
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM venues
      WHERE venues.venue_id = ingredients.venue_id
      AND (
        venues.owner_user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM user_venue_roles
          WHERE user_venue_roles.venue_id = ingredients.venue_id
          AND user_venue_roles.user_id = auth.uid()
          AND user_venue_roles.role IN ('owner', 'manager')
        )
      )
    )
  );

-- ============================================================================
-- NOTES
-- ============================================================================

-- IMPORTANT SECURITY NOTES:
-- 1. All policies use auth.uid() to identify the current user
-- 2. Policies cascade through venue relationships (owner_user_id and user_venue_roles)
-- 3. Service role key bypasses RLS - use admin client only for server-side operations
-- 4. Customer-facing endpoints (QR ordering) should NOT use RLS - they use service role
-- 5. Staff-facing endpoints should use authenticated Supabase client to respect RLS
-- 6. Always verify venue access in API routes before using admin client
-- 7. Test policies after any schema changes

-- AUDIT CHECKLIST:
-- [ ] All tables have RLS enabled
-- [ ] Policies cover all CRUD operations (SELECT, INSERT, UPDATE, DELETE)
-- [ ] Policies properly restrict access based on venue ownership/roles
-- [ ] Customer-facing flows use service role (bypass RLS)
-- [ ] Staff-facing flows use authenticated client (respect RLS)
-- [ ] No admin client usage in customer-facing endpoints
-- [ ] All API routes verify venue access before operations

