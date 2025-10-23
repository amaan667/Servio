-- ============================================================================
-- Migration: Add RLS Policies for Organizations
-- Purpose: Allow users to read their own organizations (fixes 401/400 errors)
-- ============================================================================

-- Step 1: Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_venues_organization_id ON venues(organization_id);
CREATE INDEX IF NOT EXISTS idx_organizations_owner ON organizations(owner_user_id);

-- Step 2: Link any orphaned venues to their owner's organization
UPDATE venues v
SET organization_id = o.id
FROM organizations o
WHERE v.owner_user_id = o.owner_user_id
AND v.organization_id IS NULL;

-- Step 3: Enable RLS on organizations table (if not already enabled)
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

-- Step 4: Add RLS policy to allow users to read their own organizations
DROP POLICY IF EXISTS "Users can read their own organizations" ON organizations;
CREATE POLICY "Users can read their own organizations"
ON organizations FOR SELECT
USING (auth.uid() = owner_user_id);

-- Step 5: Allow users to update their own organizations
DROP POLICY IF EXISTS "Users can update their own organizations" ON organizations;
CREATE POLICY "Users can update their own organizations"
ON organizations FOR UPDATE
USING (auth.uid() = owner_user_id);

-- Step 6: Allow users to insert their own organizations (for first-time setup)
DROP POLICY IF EXISTS "Users can insert their own organizations" ON organizations;
CREATE POLICY "Users can insert their own organizations"
ON organizations FOR INSERT
WITH CHECK (auth.uid() = owner_user_id);

-- ============================================================================
-- Verification Queries
-- ============================================================================

-- Check if RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename = 'organizations';

-- Check existing policies
SELECT policyname, permissive, roles, cmd 
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename = 'organizations';

-- Check all venues have organization_id
SELECT COUNT(*) as orphaned_venues 
FROM venues 
WHERE organization_id IS NULL;

-- Verify organization-venue links
SELECT 
  o.id as org_id,
  o.owner_user_id,
  o.subscription_tier,
  o.subscription_status,
  o.trial_ends_at,
  COUNT(v.venue_id) as venue_count
FROM organizations o
LEFT JOIN venues v ON v.organization_id = o.id
GROUP BY o.id, o.owner_user_id, o.subscription_tier, o.subscription_status, o.trial_ends_at
ORDER BY o.created_at DESC;

