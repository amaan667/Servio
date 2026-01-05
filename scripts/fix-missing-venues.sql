-- ========================================================================================
-- FIX MISSING VENUES - Recreate venues that exist in user_venue_roles but not in venues
-- ========================================================================================

-- STEP 1: Find all venue_ids in user_venue_roles that don't exist in venues table
SELECT 'MISSING_VENUES' as issue_type,
  uvr.venue_id,
  uvr.user_id,
  uvr.role,
  CASE WHEN v.venue_id IS NULL THEN 'MISSING_FROM_VENUES_TABLE' ELSE 'EXISTS' END as status
FROM user_venue_roles uvr
LEFT JOIN venues v ON uvr.venue_id = v.venue_id
WHERE v.venue_id IS NULL
ORDER BY uvr.created_at;

-- STEP 2: Find the user who should own venue-1e02af4d
SELECT 'VENUE_1E02AF4D_OWNER' as analysis,
  uvr.user_id,
  uvr.role,
  '1e02af4d-2a5d-4ae4-a3d3-ad06a4445b20' as expected_owner,
  CASE WHEN uvr.user_id = '1e02af4d-2a5d-4ae4-a3d3-ad06a4445b20' THEN 'CORRECT_OWNER' ELSE 'WRONG_OWNER' END as ownership_check
FROM user_venue_roles uvr
WHERE uvr.venue_id = 'venue-1e02af4d';

-- STEP 3: Get the organization for the correct owner
SELECT 'USER_ORGANIZATION' as analysis,
  o.id as organization_id,
  o.owner_user_id,
  o.subscription_tier,
  o.subscription_status,
  '1e02af4d-2a5d-4ae4-a3d3-ad06a4445b20' as expected_owner,
  CASE WHEN o.owner_user_id = '1e02af4d-2a5d-4ae4-a3d3-ad06a4445b20' THEN 'CORRECT_ORG' ELSE 'WRONG_ORG' END as org_check
FROM organizations o
WHERE o.owner_user_id = '1e02af4d-2a5d-4ae4-a3d3-ad06a4445b20';

-- STEP 4: RECREATE THE MISSING VENUE
-- Based on the venue_id format: venue-{userId.slice(0,8)}-{timestamp}
-- venue-1e02af4d suggests user ID starts with 1e02af4d

INSERT INTO venues (
  venue_id,
  venue_name,
  business_type,
  owner_user_id,
  organization_id,
  created_at,
  updated_at,
  is_active,
  timezone,
  currency,
  daily_reset_time
) VALUES (
  'venue-1e02af4d',
  'Amaan Tanveer''s Venue', -- Default name, can be updated later
  'Restaurant',
  '1e02af4d-2a5d-4ae4-a3d3-ad06a4445b20',
  '65493772-a3a7-4f08-a396-ff4c86c2c7e1', -- From organizations table
  NOW(),
  NOW(),
  true,
  'Europe/London',
  'GBP',
  '06:00:00'
) ON CONFLICT (venue_id) DO NOTHING;

-- STEP 5: Verify the fix worked
SELECT 'AFTER_FIX_CHECK' as verification,
  v.venue_id,
  v.venue_name,
  v.owner_user_id,
  v.organization_id,
  o.subscription_tier,
  o.subscription_status,
  CASE WHEN v.owner_user_id = o.owner_user_id THEN 'OWNER_MATCHES_ORG' ELSE 'OWNER_MISMATCH' END as validation
FROM venues v
LEFT JOIN organizations o ON v.organization_id = o.id
WHERE v.venue_id = 'venue-1e02af4d';

-- STEP 6: Test that the RPC now works
SELECT 'RPC_TEST_AFTER_FIX' as test, * FROM get_access_context('venue-1e02af4d');

-- STEP 7: Check for any other missing venues that need fixing
SELECT 'REMAINING_MISSING_VENUES' as status,
  COUNT(*) as missing_count,
  ARRAY_AGG(uvr.venue_id ORDER BY uvr.created_at) as missing_venue_ids
FROM user_venue_roles uvr
LEFT JOIN venues v ON uvr.venue_id = v.venue_id
WHERE v.venue_id IS NULL;

-- ========================================================================================
-- HOW TO RUN THIS SCRIPT:
-- 1. Go to Railway dashboard → PostgreSQL → Query tab
-- 2. Run each section step by step
-- 3. Check the results after each step
-- 4. The venue should be recreated and RPC should work
-- ========================================================================================
