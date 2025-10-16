-- Complete Cafe Nur Restoration Script
-- This fixes the trigger issue and restores your venue
-- Run this directly in your Supabase SQL Editor

-- ============================================
-- PART 1: Fix the trigger that's causing errors
-- ============================================

-- Drop the old trigger and function (CASCADE to handle dependencies)
DROP TRIGGER IF EXISTS auto_assign_venue_owner_trigger ON venues;
DROP TRIGGER IF EXISTS trg_auto_assign_venue_owner ON venues;
DROP FUNCTION IF EXISTS auto_assign_venue_owner() CASCADE;

-- Create the corrected function (using owner_user_id instead of owner_id)
CREATE OR REPLACE FUNCTION auto_assign_venue_owner()
RETURNS TRIGGER AS $$
BEGIN
  -- Automatically create a user_venue_role entry for the venue owner
  INSERT INTO user_venue_roles (user_id, venue_id, role, created_at)
  VALUES (NEW.owner_user_id, NEW.venue_id, 'owner', NOW())
  ON CONFLICT (venue_id, user_id) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger with the fixed function
CREATE TRIGGER auto_assign_venue_owner_trigger
AFTER INSERT ON venues
FOR EACH ROW
EXECUTE FUNCTION auto_assign_venue_owner();

SELECT '✅ Trigger fixed!' as step_1;

-- ============================================
-- PART 2: Add is_primary column
-- ============================================

ALTER TABLE venues ADD COLUMN IF NOT EXISTS is_primary BOOLEAN DEFAULT false;

SELECT '✅ Column added!' as step_2;

-- ============================================
-- PART 3: Get your user info
-- ============================================

SELECT '=== Your User Info ===' as info;
SELECT id as user_id, email FROM auth.users WHERE email = 'amaantanveer667@gmail.com';

-- ============================================
-- PART 4: Restore Cafe Nur venue
-- ============================================

INSERT INTO venues (
  venue_id,
  venue_name,
  address,
  phone,
  description,
  owner_user_id,
  is_primary,
  created_at,
  updated_at
)
SELECT
  'venue-1e02af4d',  -- Your original venue ID
  'Cafe Nur',
  '523 Kings Road, Stretford, Manchester',
  '07527443911',
  'Your main cafe location in Stretford, Manchester',
  id,  -- Your user ID
  true,  -- Set as primary venue
  NOW() - INTERVAL '30 days',  -- Set created date to 30 days ago
  NOW()
FROM auth.users 
WHERE email = 'amaantanveer667@gmail.com';

SELECT '✅ Venue restored!' as step_3;

-- ============================================
-- PART 5: Try to set organization_id (optional)
-- ============================================

UPDATE venues 
SET organization_id = (
  SELECT id FROM organizations LIMIT 1
)
WHERE venue_id = 'venue-1e02af4d'
AND organization_id IS NULL;

SELECT '✅ Organization linked (if available)!' as step_4;

-- ============================================
-- PART 6: Create index for better performance
-- ============================================

CREATE INDEX IF NOT EXISTS idx_venues_is_primary ON venues(is_primary);

SELECT '✅ Index created!' as step_5;

-- ============================================
-- PART 7: Verify restoration
-- ============================================

SELECT '=== ✅ CAFE NUR RESTORED ===' as result;

SELECT venue_id, venue_name, is_primary, organization_id, created_at 
FROM venues 
WHERE venue_name = 'Cafe Nur';

SELECT '=== All Your Venues ===' as info;
SELECT venue_id, venue_name, is_primary, created_at 
FROM venues 
ORDER BY is_primary DESC, created_at ASC;

-- ============================================
-- SUCCESS MESSAGE
-- ============================================

SELECT '🎉 SUCCESS! Cafe Nur has been fully restored!' as final_result;
SELECT 'Access your dashboard at: /dashboard/venue-1e02af4d' as next_step;
