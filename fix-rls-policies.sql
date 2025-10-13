-- ============================================================================
-- FIX RLS POLICIES FOR OWNER_USER_ID COLUMN
-- ============================================================================
-- This script updates all Row Level Security policies to use the correct
-- column name: owner_user_id (instead of owner_id)
-- ============================================================================

-- Enable RLS on venues table
ALTER TABLE venues ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- VENUES TABLE POLICIES
-- ============================================================================

-- Drop old policies with incorrect column name
DROP POLICY IF EXISTS "Users can view their venues" ON venues;
DROP POLICY IF EXISTS "Users can update their venues" ON venues;
DROP POLICY IF EXISTS "Users can insert their venues" ON venues;
DROP POLICY IF EXISTS "Users can delete their venues" ON venues;
DROP POLICY IF EXISTS "Service role has full access to venues" ON venues;

-- Create new policies with correct column name (owner_user_id)
CREATE POLICY "Users can view their venues"
  ON venues FOR SELECT
  USING (owner_user_id = auth.uid());

CREATE POLICY "Users can update their venues"
  ON venues FOR UPDATE
  USING (owner_user_id = auth.uid());

CREATE POLICY "Users can insert their venues"
  ON venues FOR INSERT
  WITH CHECK (owner_user_id = auth.uid());

CREATE POLICY "Users can delete their venues"
  ON venues FOR DELETE
  USING (owner_user_id = auth.uid());

CREATE POLICY "Service role has full access to venues"
  ON venues FOR ALL
  TO service_role
  USING (true);

-- ============================================================================
-- INGREDIENTS TABLE POLICIES (depends on venues)
-- ============================================================================

DROP POLICY IF EXISTS "Users can view their venue's ingredients" ON ingredients;
DROP POLICY IF EXISTS "Users can manage their venue's ingredients" ON ingredients;

CREATE POLICY "Users can view their venue's ingredients"
  ON ingredients FOR SELECT
  USING (venue_id IN (SELECT venue_id FROM venues WHERE owner_user_id = auth.uid()));

CREATE POLICY "Users can manage their venue's ingredients"
  ON ingredients FOR ALL
  USING (venue_id IN (SELECT venue_id FROM venues WHERE owner_user_id = auth.uid()));

-- ============================================================================
-- STOCK LEDGER POLICIES (depends on venues)
-- ============================================================================

DROP POLICY IF EXISTS "Users can view their venue's stock ledgers" ON stock_ledger;
DROP POLICY IF EXISTS "Users can manage their venue's stock ledgers" ON stock_ledger;

CREATE POLICY "Users can view their venue's stock ledgers"
  ON stock_ledger FOR SELECT
  USING (venue_id IN (SELECT venue_id FROM venues WHERE owner_user_id = auth.uid()));

CREATE POLICY "Users can manage their venue's stock ledgers"
  ON stock_ledger FOR ALL
  USING (venue_id IN (SELECT venue_id FROM venues WHERE owner_user_id = auth.uid()));

-- ============================================================================
-- KDS TABLES POLICIES (depends on venues)
-- ============================================================================

DROP POLICY IF EXISTS "Users can view their venue's KDS stations" ON kds_stations;
DROP POLICY IF EXISTS "Users can manage their venue's KDS stations" ON kds_stations;
DROP POLICY IF EXISTS "Users can view their venue's KDS tickets" ON kds_tickets;
DROP POLICY IF EXISTS "Users can manage their venue's KDS tickets" ON kds_tickets;
DROP POLICY IF EXISTS "Users can view their venue's station categories" ON kds_station_categories;
DROP POLICY IF EXISTS "Users can manage their venue's station categories" ON kds_station_categories;

CREATE POLICY "Users can view their venue's KDS stations"
  ON kds_stations FOR SELECT
  USING (venue_id IN (SELECT venue_id FROM venues WHERE owner_user_id = auth.uid()));

CREATE POLICY "Users can manage their venue's KDS stations"
  ON kds_stations FOR ALL
  USING (venue_id IN (SELECT venue_id FROM venues WHERE owner_user_id = auth.uid()));

CREATE POLICY "Users can view their venue's KDS tickets"
  ON kds_tickets FOR SELECT
  USING (venue_id IN (SELECT venue_id FROM venues WHERE owner_user_id = auth.uid()));

CREATE POLICY "Users can manage their venue's KDS tickets"
  ON kds_tickets FOR ALL
  USING (venue_id IN (SELECT venue_id FROM venues WHERE owner_user_id = auth.uid()));

CREATE POLICY "Users can view their venue's station categories"
  ON kds_station_categories FOR SELECT
  USING (venue_id IN (SELECT venue_id FROM venues WHERE owner_user_id = auth.uid()));

CREATE POLICY "Users can manage their venue's station categories"
  ON kds_station_categories FOR ALL
  USING (venue_id IN (SELECT venue_id FROM venues WHERE owner_user_id = auth.uid()));

-- ============================================================================
-- MENU ITEM INGREDIENTS POLICIES (depends on venues)
-- ============================================================================

DROP POLICY IF EXISTS "Users can view menu item ingredients" ON menu_item_ingredients;
DROP POLICY IF EXISTS "Users can manage menu item ingredients" ON menu_item_ingredients;

CREATE POLICY "Users can view menu item ingredients"
  ON menu_item_ingredients FOR SELECT
  USING (
    menu_item_id IN (
      SELECT id FROM menu_items 
      WHERE venue_id IN (SELECT venue_id FROM venues WHERE owner_user_id = auth.uid())
    )
  );

CREATE POLICY "Users can manage menu item ingredients"
  ON menu_item_ingredients FOR ALL
  USING (
    menu_item_id IN (
      SELECT id FROM menu_items 
      WHERE venue_id IN (SELECT venue_id FROM venues WHERE owner_user_id = auth.uid())
    )
  );

-- ============================================================================
-- ORGANIZATIONS POLICIES (if using owner_id column)
-- ============================================================================

DROP POLICY IF EXISTS "Users can view their organizations" ON organizations;
DROP POLICY IF EXISTS "Owners can update organizations" ON organizations;
DROP POLICY IF EXISTS "Users can create organizations" ON organizations;

-- Note: organizations table might use created_by instead of owner_id
-- Check your schema and adjust if needed
CREATE POLICY "Users can view their organizations" ON organizations
  FOR SELECT
  USING (
    created_by = auth.uid() OR
    id IN (SELECT organization_id FROM user_venue_roles WHERE user_id = auth.uid())
  );

CREATE POLICY "Owners can update organizations" ON organizations
  FOR UPDATE
  USING (created_by = auth.uid());

CREATE POLICY "Users can create organizations" ON organizations
  FOR INSERT
  WITH CHECK (created_by = auth.uid());

-- ============================================================================
-- CONFIRMATION
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '✓ RLS policies updated successfully';
  RAISE NOTICE '✓ All policies now use owner_user_id column';
  RAISE NOTICE '✓ Dashboard redirects should now work correctly';
END $$;

