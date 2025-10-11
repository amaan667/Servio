-- Role-Based Access Control (RBAC) Migration
-- This migration implements comprehensive server-side security for team management

-- Step 1: Create enum for user roles (if not already exists)
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('owner', 'manager', 'staff', 'kitchen');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Step 2: Create user_venue_roles table (if not exists)
CREATE TABLE IF NOT EXISTS user_venue_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id UUID NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  user_id UUID NOT NULL, -- auth.users.id
  role user_role NOT NULL DEFAULT 'staff',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (venue_id, user_id)
);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_user_venue_roles_venue ON user_venue_roles(venue_id);
CREATE INDEX IF NOT EXISTS idx_user_venue_roles_user ON user_venue_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_venue_roles_lookup ON user_venue_roles(venue_id, user_id);

-- Step 3: Create audit log table
CREATE TABLE IF NOT EXISTS role_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id UUID NOT NULL,
  changed_by UUID NOT NULL,
  target_user UUID NOT NULL,
  old_role user_role,
  new_role user_role NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for audit queries
CREATE INDEX IF NOT EXISTS idx_role_changes_venue ON role_changes(venue_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_role_changes_user ON role_changes(target_user, created_at DESC);

-- Step 4: Enable RLS on tables
ALTER TABLE user_venue_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_changes ENABLE ROW LEVEL SECURITY;

-- Step 5: RLS Policies for user_venue_roles

-- Drop existing policies if any
DROP POLICY IF EXISTS uvr_read ON user_venue_roles;
DROP POLICY IF EXISTS uvr_insert ON user_venue_roles;
DROP POLICY IF EXISTS uvr_update ON user_venue_roles;
DROP POLICY IF EXISTS uvr_delete ON user_venue_roles;

-- Read team: any member of that venue can see all members
CREATE POLICY uvr_read ON user_venue_roles FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM user_venue_roles me
    WHERE me.venue_id = user_venue_roles.venue_id
      AND me.user_id = auth.uid()
  )
);

-- Insert member: owners can add any role; managers can add staff/kitchen only
CREATE POLICY uvr_insert ON user_venue_roles FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_venue_roles me
    WHERE me.venue_id = user_venue_roles.venue_id
      AND me.user_id = auth.uid()
      AND (
        me.role = 'owner'
        OR (me.role = 'manager' AND user_venue_roles.role IN ('staff', 'kitchen'))
      )
  )
);

-- Update role: owners only
CREATE POLICY uvr_update ON user_venue_roles FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM user_venue_roles me
    WHERE me.venue_id = user_venue_roles.venue_id
      AND me.user_id = auth.uid()
      AND me.role = 'owner'
  )
);

-- Delete member: owners; managers may remove staff/kitchen
CREATE POLICY uvr_delete ON user_venue_roles FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM user_venue_roles me
    WHERE me.venue_id = user_venue_roles.venue_id
      AND me.user_id = auth.uid()
      AND (
        me.role = 'owner'
        OR (
          me.role = 'manager' 
          AND user_venue_roles.role IN ('staff', 'kitchen')
        )
      )
  )
);

-- Step 6: RLS Policies for role_changes (audit log)

-- Drop existing policies if any
DROP POLICY IF EXISTS role_changes_read ON role_changes;
DROP POLICY IF EXISTS role_changes_insert ON role_changes;

-- Read: owners and managers can see audit log
CREATE POLICY role_changes_read ON role_changes FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM user_venue_roles me
    WHERE me.venue_id = role_changes.venue_id
      AND me.user_id = auth.uid()
      AND me.role IN ('owner', 'manager')
  )
);

-- Insert: system only (triggers will handle this)
CREATE POLICY role_changes_insert ON role_changes FOR INSERT
WITH CHECK (auth.uid() = changed_by);

-- Step 7: Create trigger function to prevent removing/demoting the last owner
CREATE OR REPLACE FUNCTION prevent_last_owner() 
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER
AS $$
DECLARE
  owner_count INTEGER;
  target_venue_id UUID;
BEGIN
  -- Determine the venue_id
  target_venue_id := COALESCE(OLD.venue_id, NEW.venue_id);
  
  -- Check if this affects an owner
  IF TG_OP = 'DELETE' THEN
    IF OLD.role = 'owner' THEN
      -- Count remaining owners (excluding this one)
      SELECT COUNT(*) INTO owner_count
      FROM user_venue_roles
      WHERE venue_id = target_venue_id
        AND role = 'owner'
        AND id <> OLD.id;
      
      IF owner_count = 0 THEN
        RAISE EXCEPTION 'Cannot remove the last owner of this venue.';
      END IF;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.role = 'owner' AND NEW.role <> 'owner' THEN
      -- Count remaining owners (excluding this one)
      SELECT COUNT(*) INTO owner_count
      FROM user_venue_roles
      WHERE venue_id = target_venue_id
        AND role = 'owner'
        AND id <> OLD.id;
      
      IF owner_count = 0 THEN
        RAISE EXCEPTION 'Cannot demote the last owner of this venue.';
      END IF;
    END IF;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Attach trigger
DROP TRIGGER IF EXISTS trg_prevent_last_owner ON user_venue_roles;
CREATE TRIGGER trg_prevent_last_owner
  BEFORE UPDATE OR DELETE ON user_venue_roles
  FOR EACH ROW
  EXECUTE FUNCTION prevent_last_owner();

-- Step 8: Create trigger function to log role changes
CREATE OR REPLACE FUNCTION log_role_change() 
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER
AS $$
DECLARE
  audit_reason TEXT;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.role IS DISTINCT FROM OLD.role THEN
    -- Try to get the reason from session variable
    BEGIN
      audit_reason := current_setting('app.role_reason', true);
    EXCEPTION WHEN OTHERS THEN
      audit_reason := NULL;
    END;
    
    -- Log the change
    INSERT INTO role_changes(venue_id, changed_by, target_user, old_role, new_role, reason)
    VALUES(NEW.venue_id, auth.uid(), NEW.user_id, OLD.role, NEW.role, audit_reason);
  END IF;
  
  RETURN NEW;
END;
$$;

-- Attach trigger
DROP TRIGGER IF EXISTS trg_log_role_change ON user_venue_roles;
CREATE TRIGGER trg_log_role_change
  AFTER UPDATE ON user_venue_roles
  FOR EACH ROW
  EXECUTE FUNCTION log_role_change();

-- Step 9: RLS Policies for core data tables

-- ========================================
-- ORDERS TABLE
-- ========================================
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS orders_read ON orders;
DROP POLICY IF EXISTS orders_insert ON orders;
DROP POLICY IF EXISTS orders_update ON orders;
DROP POLICY IF EXISTS orders_delete ON orders;

-- Read: any member can see orders
CREATE POLICY orders_read ON orders FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM user_venue_roles me
    WHERE me.venue_id = orders.venue_id
      AND me.user_id = auth.uid()
  )
);

-- Insert: staff+ can create orders
CREATE POLICY orders_insert ON orders FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_venue_roles me
    WHERE me.venue_id = orders.venue_id
      AND me.user_id = auth.uid()
      AND me.role IN ('owner', 'manager', 'staff', 'kitchen')
  )
);

-- Update: staff+ can update orders (lifecycle, status, etc.)
CREATE POLICY orders_update ON orders FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM user_venue_roles me
    WHERE me.venue_id = orders.venue_id
      AND me.user_id = auth.uid()
      AND me.role IN ('owner', 'manager', 'staff', 'kitchen')
  )
);

-- Delete: owners and managers only
CREATE POLICY orders_delete ON orders FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM user_venue_roles me
    WHERE me.venue_id = orders.venue_id
      AND me.user_id = auth.uid()
      AND me.role IN ('owner', 'manager')
  )
);

-- ========================================
-- MENU_ITEMS TABLE
-- ========================================
ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS menu_read ON menu_items;
DROP POLICY IF EXISTS menu_insert ON menu_items;
DROP POLICY IF EXISTS menu_update ON menu_items;
DROP POLICY IF EXISTS menu_delete ON menu_items;

-- Read: any member can see menu
CREATE POLICY menu_read ON menu_items FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM user_venue_roles me
    WHERE me.venue_id = menu_items.venue_id
      AND me.user_id = auth.uid()
  )
);

-- Insert: owners and managers only
CREATE POLICY menu_insert ON menu_items FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_venue_roles me
    WHERE me.venue_id = menu_items.venue_id
      AND me.user_id = auth.uid()
      AND me.role IN ('owner', 'manager')
  )
);

-- Update: owners and managers only
CREATE POLICY menu_update ON menu_items FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM user_venue_roles me
    WHERE me.venue_id = menu_items.venue_id
      AND me.user_id = auth.uid()
      AND me.role IN ('owner', 'manager')
  )
);

-- Delete: owners and managers only
CREATE POLICY menu_delete ON menu_items FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM user_venue_roles me
    WHERE me.venue_id = menu_items.venue_id
      AND me.user_id = auth.uid()
      AND me.role IN ('owner', 'manager')
  )
);

-- ========================================
-- TABLES TABLE
-- ========================================
ALTER TABLE tables ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS tables_read ON tables;
DROP POLICY IF EXISTS tables_insert ON tables;
DROP POLICY IF EXISTS tables_update ON tables;
DROP POLICY IF EXISTS tables_delete ON tables;

-- Read: any member can see tables
CREATE POLICY tables_read ON tables FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM user_venue_roles me
    WHERE me.venue_id = tables.venue_id
      AND me.user_id = auth.uid()
  )
);

-- Insert: owners and managers only
CREATE POLICY tables_insert ON tables FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_venue_roles me
    WHERE me.venue_id = tables.venue_id
      AND me.user_id = auth.uid()
      AND me.role IN ('owner', 'manager')
  )
);

-- Update: staff+ can update table status; owners/managers can modify structure
CREATE POLICY tables_update ON tables FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM user_venue_roles me
    WHERE me.venue_id = tables.venue_id
      AND me.user_id = auth.uid()
      AND me.role IN ('owner', 'manager', 'staff')
  )
);

-- Delete: owners and managers only
CREATE POLICY tables_delete ON tables FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM user_venue_roles me
    WHERE me.venue_id = tables.venue_id
      AND me.user_id = auth.uid()
      AND me.role IN ('owner', 'manager')
  )
);

-- ========================================
-- VENUE_BRANDING TABLE
-- ========================================
ALTER TABLE venue_branding ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS venue_branding_read ON venue_branding;
DROP POLICY IF EXISTS venue_branding_insert ON venue_branding;
DROP POLICY IF EXISTS venue_branding_update ON venue_branding;
DROP POLICY IF EXISTS venue_branding_delete ON venue_branding;

-- Read: any member can see branding
CREATE POLICY venue_branding_read ON venue_branding FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM user_venue_roles me
    WHERE me.venue_id = venue_branding.venue_id
      AND me.user_id = auth.uid()
  )
);

-- Insert/Update/Delete: owners only
CREATE POLICY venue_branding_insert ON venue_branding FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_venue_roles me
    WHERE me.venue_id = venue_branding.venue_id
      AND me.user_id = auth.uid()
      AND me.role = 'owner'
  )
);

CREATE POLICY venue_branding_update ON venue_branding FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM user_venue_roles me
    WHERE me.venue_id = venue_branding.venue_id
      AND me.user_id = auth.uid()
      AND me.role = 'owner'
  )
);

CREATE POLICY venue_branding_delete ON venue_branding FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM user_venue_roles me
    WHERE me.venue_id = venue_branding.venue_id
      AND me.user_id = auth.uid()
      AND me.role = 'owner'
  )
);

-- ========================================
-- VENUES TABLE
-- ========================================
ALTER TABLE venues ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS venues_read ON venues;
DROP POLICY IF EXISTS venues_insert ON venues;
DROP POLICY IF EXISTS venues_update ON venues;
DROP POLICY IF EXISTS venues_delete ON venues;

-- Read: any member can see venue details
CREATE POLICY venues_read ON venues FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM user_venue_roles me
    WHERE me.venue_id = venues.id
      AND me.user_id = auth.uid()
  )
);

-- Insert: any authenticated user (will be assigned as owner automatically)
CREATE POLICY venues_insert ON venues FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- Update: owners and managers
CREATE POLICY venues_update ON venues FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM user_venue_roles me
    WHERE me.venue_id = venues.id
      AND me.user_id = auth.uid()
      AND me.role IN ('owner', 'manager')
  )
);

-- Delete: owners only
CREATE POLICY venues_delete ON venues FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM user_venue_roles me
    WHERE me.venue_id = venues.id
      AND me.user_id = auth.uid()
      AND me.role = 'owner'
  )
);

-- Step 10: Create helper function for checking permissions
CREATE OR REPLACE FUNCTION check_user_role(p_venue_id UUID, p_user_id UUID)
RETURNS user_role
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_role_result user_role;
BEGIN
  SELECT role INTO user_role_result
  FROM user_venue_roles
  WHERE venue_id = p_venue_id
    AND user_id = p_user_id;
  
  RETURN user_role_result;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION check_user_role(UUID, UUID) TO authenticated;

-- Step 11: Helper function for setting session variables (for audit reasons)
CREATE OR REPLACE FUNCTION set_config(setting_name TEXT, new_value TEXT, is_local BOOLEAN)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM set_config(setting_name, new_value, is_local);
  RETURN new_value;
END;
$$;

GRANT EXECUTE ON FUNCTION set_config(TEXT, TEXT, BOOLEAN) TO authenticated;

-- Step 12: Comments for documentation
COMMENT ON TABLE user_venue_roles IS 'Stores team member roles for each venue';
COMMENT ON TABLE role_changes IS 'Audit log for role changes';
COMMENT ON FUNCTION prevent_last_owner() IS 'Prevents removing or demoting the last owner of a venue';
COMMENT ON FUNCTION log_role_change() IS 'Logs all role changes to the audit table';
COMMENT ON FUNCTION check_user_role(UUID, UUID) IS 'Helper function to check a user''s role for a venue';
COMMENT ON FUNCTION set_config(TEXT, TEXT, BOOLEAN) IS 'Helper to set session configuration variables for audit logging';

