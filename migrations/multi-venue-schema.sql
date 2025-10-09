-- Multi-Venue & Organizations Schema
-- Enables one account to manage multiple venues with role-based access

-- ============================================================================
-- Organizations Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subscription_tier TEXT DEFAULT 'basic' CHECK (subscription_tier IN ('basic', 'standard', 'premium')),
  subscription_status TEXT DEFAULT 'active' CHECK (subscription_status IN ('active', 'trialing', 'past_due', 'canceled', 'unpaid')),
  stripe_customer_id TEXT UNIQUE,
  stripe_subscription_id TEXT,
  trial_ends_at TIMESTAMPTZ,
  billing_email TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- Update Venues Table to Support Organizations
-- ============================================================================

-- Add organization_id to venues if it doesn't exist
ALTER TABLE venues ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_venues_organization ON venues(organization_id);

-- ============================================================================
-- User-Venue Roles Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_venue_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  venue_id TEXT NOT NULL REFERENCES venues(venue_id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'staff' CHECK (role IN ('owner', 'manager', 'staff', 'kitchen', 'server', 'cashier')),
  permissions JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, venue_id)
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_user_venue_roles_user ON user_venue_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_venue_roles_venue ON user_venue_roles(venue_id);
CREATE INDEX IF NOT EXISTS idx_user_venue_roles_org ON user_venue_roles(organization_id);

-- ============================================================================
-- Subscription History Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS subscription_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  old_tier TEXT,
  new_tier TEXT,
  stripe_event_id TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscription_history_org ON subscription_history(organization_id);

-- ============================================================================
-- Migrate Existing Data
-- ============================================================================

-- Create default organizations for existing venues
INSERT INTO organizations (id, name, slug, owner_id, subscription_tier, created_at)
SELECT 
  gen_random_uuid() as id,
  COALESCE(v.name || ' Organization', 'My Organization') as name,
  LOWER(REGEXP_REPLACE(COALESCE(v.name, 'my-org'), '[^a-zA-Z0-9]+', '-', 'g')) || '-' || SUBSTRING(v.owner_id::TEXT, 1, 8) as slug,
  v.owner_id,
  'basic' as subscription_tier,
  v.created_at
FROM venues v
WHERE v.owner_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM organizations o WHERE o.owner_id = v.owner_id
  )
GROUP BY v.owner_id, v.name, v.created_at;

-- Link venues to their organizations
UPDATE venues v
SET organization_id = o.id
FROM organizations o
WHERE v.owner_id = o.owner_id
  AND v.organization_id IS NULL;

-- Create user-venue roles for existing owner relationships
INSERT INTO user_venue_roles (user_id, venue_id, organization_id, role, created_at)
SELECT 
  v.owner_id as user_id,
  v.venue_id,
  v.organization_id,
  'owner' as role,
  v.created_at
FROM venues v
WHERE v.owner_id IS NOT NULL
  AND v.organization_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM user_venue_roles uvr 
    WHERE uvr.user_id = v.owner_id AND uvr.venue_id = v.venue_id
  );

-- ============================================================================
-- Functions
-- ============================================================================

-- Function to get user's accessible venues
CREATE OR REPLACE FUNCTION get_user_venues(p_user_id UUID)
RETURNS TABLE (
  venue_id TEXT,
  venue_name TEXT,
  organization_id UUID,
  organization_name TEXT,
  user_role TEXT,
  venue_created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    v.venue_id,
    v.name as venue_name,
    v.organization_id,
    o.name as organization_name,
    uvr.role as user_role,
    v.created_at as venue_created_at
  FROM user_venue_roles uvr
  JOIN venues v ON v.venue_id = uvr.venue_id
  LEFT JOIN organizations o ON o.id = v.organization_id
  WHERE uvr.user_id = p_user_id
  ORDER BY v.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- Function to check user permission for venue
CREATE OR REPLACE FUNCTION check_venue_permission(
  p_user_id UUID,
  p_venue_id TEXT,
  p_required_role TEXT DEFAULT 'staff'
)
RETURNS BOOLEAN AS $$
DECLARE
  user_role TEXT;
  role_hierarchy INT;
BEGIN
  -- Get user's role for this venue
  SELECT role INTO user_role
  FROM user_venue_roles
  WHERE user_id = p_user_id AND venue_id = p_venue_id;

  IF user_role IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Role hierarchy: owner > manager > staff
  CASE user_role
    WHEN 'owner' THEN role_hierarchy := 3;
    WHEN 'manager' THEN role_hierarchy := 2;
    ELSE role_hierarchy := 1;
  END CASE;

  CASE p_required_role
    WHEN 'owner' THEN RETURN role_hierarchy >= 3;
    WHEN 'manager' THEN RETURN role_hierarchy >= 2;
    ELSE RETURN role_hierarchy >= 1;
  END CASE;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- RLS Policies
-- ============================================================================

-- Enable RLS
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_venue_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_history ENABLE ROW LEVEL SECURITY;

-- Organizations: Users can see their own organizations
DROP POLICY IF EXISTS "Users can view their organizations" ON organizations;
CREATE POLICY "Users can view their organizations" ON organizations
  FOR SELECT
  USING (
    owner_id = auth.uid() OR
    id IN (SELECT organization_id FROM user_venue_roles WHERE user_id = auth.uid())
  );

-- Organizations: Only owners can update their organizations
DROP POLICY IF EXISTS "Owners can update organizations" ON organizations;
CREATE POLICY "Owners can update organizations" ON organizations
  FOR UPDATE
  USING (owner_id = auth.uid());

-- User venue roles: Users can view roles for venues they have access to
DROP POLICY IF EXISTS "Users can view venue roles" ON user_venue_roles;
CREATE POLICY "Users can view venue roles" ON user_venue_roles
  FOR SELECT
  USING (
    user_id = auth.uid() OR
    venue_id IN (SELECT venue_id FROM user_venue_roles WHERE user_id = auth.uid() AND role IN ('owner', 'manager'))
  );

-- User venue roles: Owners and managers can manage roles
DROP POLICY IF EXISTS "Owners and managers can manage roles" ON user_venue_roles;
CREATE POLICY "Owners and managers can manage roles" ON user_venue_roles
  FOR ALL
  USING (
    venue_id IN (
      SELECT venue_id FROM user_venue_roles 
      WHERE user_id = auth.uid() AND role IN ('owner', 'manager')
    )
  );

-- Subscription history: Users can view their organization's history
DROP POLICY IF EXISTS "Users can view subscription history" ON subscription_history;
CREATE POLICY "Users can view subscription history" ON subscription_history
  FOR SELECT
  USING (
    organization_id IN (
      SELECT id FROM organizations WHERE owner_id = auth.uid()
    )
  );

-- Service role bypass
DROP POLICY IF EXISTS "Service role full access to organizations" ON organizations;
CREATE POLICY "Service role full access to organizations" ON organizations
  FOR ALL TO service_role USING (true);

DROP POLICY IF EXISTS "Service role full access to user_venue_roles" ON user_venue_roles;
CREATE POLICY "Service role full access to user_venue_roles" ON user_venue_roles
  FOR ALL TO service_role USING (true);

DROP POLICY IF EXISTS "Service role full access to subscription_history" ON subscription_history;
CREATE POLICY "Service role full access to subscription_history" ON subscription_history
  FOR ALL TO service_role USING (true);

-- ============================================================================
-- Triggers
-- ============================================================================

CREATE OR REPLACE FUNCTION update_multi_venue_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER organizations_updated_at
  BEFORE UPDATE ON organizations
  FOR EACH ROW
  EXECUTE FUNCTION update_multi_venue_updated_at();

CREATE TRIGGER user_venue_roles_updated_at
  BEFORE UPDATE ON user_venue_roles
  FOR EACH ROW
  EXECUTE FUNCTION update_multi_venue_updated_at();

-- ============================================================================
-- Success Message
-- ============================================================================

DO $$ 
BEGIN
  RAISE NOTICE '=================================================================';
  RAISE NOTICE 'Multi-Venue Schema Migration Completed!';
  RAISE NOTICE '=================================================================';
  RAISE NOTICE 'Tables created: organizations, user_venue_roles, subscription_history';
  RAISE NOTICE 'Existing venues migrated to organizations';
  RAISE NOTICE 'Owner roles created for all existing venues';
  RAISE NOTICE '=================================================================';
END $$;

