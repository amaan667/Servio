-- ============================================================================
-- Migration: Fix Organization Schema for Multi-Venue Support
-- Purpose: Properly link venues to organizations for enterprise billing
-- ============================================================================

-- Step 1: Add organization_id column to venues table
ALTER TABLE venues 
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- Step 2: Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_venues_organization_id ON venues(organization_id);
CREATE INDEX IF NOT EXISTS idx_organizations_owner ON organizations(owner_user_id);

-- Step 3: Migrate existing data - link venues to their owner's organization
UPDATE venues v
SET organization_id = o.id
FROM organizations o
WHERE v.owner_user_id = o.owner_user_id
AND v.organization_id IS NULL;

-- Step 4: For venues without organizations, create one automatically
DO $$
DECLARE
  venue_record RECORD;
  new_org_id UUID;
BEGIN
  FOR venue_record IN 
    SELECT DISTINCT owner_user_id 
    FROM venues 
    WHERE organization_id IS NULL
  LOOP
    -- Create organization for this user
    INSERT INTO organizations (
      owner_user_id,
      subscription_tier,
      subscription_status,
      trial_ends_at,
      created_at,
      updated_at
    )
    SELECT 
      venue_record.owner_user_id,
      COALESCE(v.subscription_tier, 'basic'),
      'trialing',
      COALESCE(v.trial_ends_at, (NOW() + INTERVAL '14 days')::timestamp),
      NOW(),
      NOW()
    FROM venues v
    WHERE v.owner_user_id = venue_record.owner_user_id
    LIMIT 1
    ON CONFLICT (owner_user_id) DO NOTHING
    RETURNING id INTO new_org_id;
    
    -- Link all venues to this organization
    UPDATE venues
    SET organization_id = new_org_id
    WHERE owner_user_id = venue_record.owner_user_id
    AND organization_id IS NULL;
  END LOOP;
END $$;

-- Step 5: Make organization_id NOT NULL (now that all venues are linked)
-- ALTER TABLE venues ALTER COLUMN organization_id SET NOT NULL;
-- (Commented out for now - enable after verifying all venues are linked)

-- Step 6: Remove duplicate subscription fields from venues
-- (Keep them for now for backward compatibility, remove in future migration)
-- ALTER TABLE venues DROP COLUMN IF EXISTS subscription_tier;
-- ALTER TABLE venues DROP COLUMN IF EXISTS trial_ends_at;

-- Step 7: Add RLS policy to allow users to read their own organizations
DROP POLICY IF EXISTS "Users can read their own organizations" ON organizations;
CREATE POLICY "Users can read their own organizations"
ON organizations FOR SELECT
USING (auth.uid() = owner_user_id);

DROP POLICY IF EXISTS "Users can update their own organizations" ON organizations;
CREATE POLICY "Users can update their own organizations"
ON organizations FOR UPDATE
USING (auth.uid() = owner_user_id);

-- Step 8: Add RLS policy for venues to check organization access
DROP POLICY IF EXISTS "Users can access their organization's venues" ON venues;
CREATE POLICY "Users can access their organization's venues"
ON venues FOR SELECT
USING (
  auth.uid() = owner_user_id 
  OR 
  EXISTS (
    SELECT 1 FROM user_venue_roles 
    WHERE user_venue_roles.venue_id = venues.venue_id 
    AND user_venue_roles.user_id = auth.uid()
  )
);

-- ============================================================================
-- Verification Queries
-- ============================================================================

-- Check all venues have organization_id
-- SELECT COUNT(*) as orphaned_venues FROM venues WHERE organization_id IS NULL;

-- Check all organizations have owner
-- SELECT COUNT(*) as organizations_without_owner FROM organizations WHERE owner_user_id IS NULL;

-- Check venue-organization links
-- SELECT 
--   o.id as org_id,
--   o.owner_user_id,
--   o.subscription_tier,
--   COUNT(v.venue_id) as venue_count
-- FROM organizations o
-- LEFT JOIN venues v ON v.organization_id = o.id
-- GROUP BY o.id, o.owner_user_id, o.subscription_tier;

