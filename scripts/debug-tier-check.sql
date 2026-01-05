-- ========================================================================================
-- COMPLETE TIER DIAGNOSTIC SCRIPT
-- Run this in your Railway PostgreSQL database to check tier and access issues
-- ========================================================================================

-- STEP 1: Check your user ID (replace with your actual email)
SELECT id, email, created_at FROM auth.users WHERE email = 'your-email@example.com';

-- STEP 2: Check your organizations (replace YOUR_USER_ID with the ID from step 1)
SELECT
    id,
    owner_user_id,
    subscription_tier,
    subscription_status,
    stripe_customer_id,
    stripe_subscription_id,
    created_at,
    updated_at
FROM organizations
WHERE owner_user_id = '1e02af4d-2a5d-4ae4-a3d3-ad06a4445b20';

-- STEP 3: Check your venues (replace YOUR_USER_ID)
SELECT
    venue_id,
    owner_user_id,
    venue_name,
    organization_id,
    created_at
FROM venues
WHERE owner_user_id = '1e02af4d-2a5d-4ae4-a3d3-ad06a4445b20';

-- STEP 3b: Check all venues in the system (to see what exists)
SELECT
    venue_id,
    venue_name,
    owner_user_id,
    organization_id,
    created_at
FROM venues
ORDER BY created_at DESC;

-- STEP 3c: Count total venues
SELECT COUNT(*) as total_venues FROM venues;

-- STEP 3d: Check if venue-1e02af4d exists specifically
SELECT 'SPECIFIC_VENUE_CHECK' as test_name,
  CASE WHEN EXISTS(SELECT 1 FROM venues WHERE venue_id = 'venue-1e02af4d') THEN 'EXISTS' ELSE 'DOES_NOT_EXIST' END as venue_status;

-- STEP 3e: CRITICAL - Check if ANY venues exist for this user
SELECT 'USER_VENUES_CHECK' as test_name,
  COUNT(*) as user_venue_count,
  ARRAY_AGG(venue_id ORDER BY created_at DESC) as user_venue_ids
FROM venues
WHERE owner_user_id = '1e02af4d-2a5d-4ae4-a3d3-ad06a4445b20';

-- STEP 3f: Check venue ID format - signup creates venue-${userId.slice(0,8)}-${timestamp}
SELECT 'VENUE_ID_ANALYSIS' as test_name,
  '1e02af4d-2a5d-4ae4-a3d3-ad06a4445b20' as user_id,
  SUBSTRING('1e02af4d-2a5d-4ae4-a3d3-ad06a4445b20', 1, 8) as user_id_prefix,
  'venue-1e02af4d' as trying_to_access,
  CASE WHEN 'venue-1e02af4d' LIKE 'venue-' || SUBSTRING('1e02af4d-2a5d-4ae4-a3d3-ad06a4445b20', 1, 8) || '-%' THEN 'MATCHES_FORMAT' ELSE 'DOESNT_MATCH_FORMAT' END as format_check;

-- STEP 3f: Check if there are ANY venues in the entire system
SELECT 'SYSTEM_VENUES_CHECK' as test_name,
  COUNT(*) as total_venues,
  COUNT(DISTINCT owner_user_id) as unique_owners,
  ARRAY_AGG(venue_id ORDER BY created_at DESC) as all_venue_ids
FROM venues;

-- STEP 3g: CRITICAL - Check who owns venue-1e02af4d
SELECT 'VENUE_1E02AF4D_OWNER' as test_name,
  v.venue_id,
  v.venue_name,
  v.owner_user_id,
  CASE WHEN v.owner_user_id = '1e02af4d-2a5d-4ae4-a3d3-ad06a4445b20' THEN 'YOU_OWN_IT' ELSE 'DIFFERENT_OWNER' END as ownership,
  v.owner_user_id as actual_owner,
  '1e02af4d-2a5d-4ae4-a3d3-ad06a4445b20' as your_user_id
FROM venues v
WHERE v.venue_id = 'venue-1e02af4d';

-- STEP 3h: Check all venue ownership details
SELECT 'ALL_VENUE_OWNERSHIP' as test_name,
  v.venue_id,
  v.venue_name,
  v.owner_user_id,
  CASE WHEN v.owner_user_id = '1e02af4d-2a5d-4ae4-a3d3-ad06a4445b20' THEN 'YOURS' ELSE 'OTHER_USER' END as ownership_status
FROM venues v
ORDER BY v.created_at DESC;

-- STEP 4: Check if you're added as staff to any venues
SELECT
    uvr.venue_id,
    uvr.role,
    v.venue_name,
    v.owner_user_id as venue_owner_id,
    o.subscription_tier as venue_owner_tier,
    o.subscription_status as venue_owner_status
FROM user_venue_roles uvr
JOIN venues v ON uvr.venue_id = v.venue_id
LEFT JOIN organizations o ON v.owner_user_id = o.owner_user_id
WHERE uvr.user_id = '1e02af4d-2a5d-4ae4-a3d3-ad06a4445b20';

-- ========================================================================================
-- STEP 5: DEBUG THE NULL RPC ISSUE - Why does get_access_context return NULL?
-- ========================================================================================

-- The RPC function returns NULL if:
-- 1. Venue doesn't exist in venues table
-- 2. User has no access (not owner, not staff)

-- Test 1: User-only context (should work - no venue needed)
SELECT 'USER_ONLY_TEST' as test_name, * FROM get_access_context(NULL);

-- Test 2: Manual venue lookup (what RPC does internally)
SELECT 'MANUAL_VENUE_LOOKUP' as test_name,
  v.venue_id,
  v.owner_user_id,
  '1e02af4d-2a5d-4ae4-a3d3-ad06a4445b20' as user_checking_access,
  CASE WHEN v.owner_user_id = '1e02af4d-2a5d-4ae4-a3d3-ad06a4445b20' THEN 'OWNER_MATCH' ELSE 'OWNER_MISMATCH' END as owner_check
FROM venues v
WHERE v.venue_id = 'venue-1e02af4d';

-- Test 3: Manual organization lookup (what RPC does for tier)
SELECT 'MANUAL_ORG_LOOKUP' as test_name,
  o.id,
  o.owner_user_id,
  o.subscription_tier,
  o.subscription_status,
  '1e02af4d-2a5d-4ae4-a3d3-ad06a4445b20' as user_checking_access,
  CASE WHEN o.owner_user_id = '1e02af4d-2a5d-4ae4-a3d3-ad06a4445b20' THEN 'ORG_MATCH' ELSE 'ORG_MISMATCH' END as org_check,
  CASE WHEN o.subscription_status = 'active' THEN 'ACTIVE' ELSE 'INACTIVE' END as status_check,
  COALESCE(o.subscription_tier, 'starter') as final_tier
FROM organizations o
WHERE o.owner_user_id = '1e02af4d-2a5d-4ae4-a3d3-ad06a4445b20';

-- Test 2: Check the venue ID you're accessing: venue-1e02af4d
SELECT 'CURRENT_VENUE_ID' as test_name, 'venue-1e02af4d' as browser_venue_id;

-- Test 3: Verify venue-1e02af4d exists in database
SELECT 'VENUE_EXISTS_CHECK' as test_name, venue_id, venue_name, owner_user_id
FROM venues WHERE venue_id = 'venue-1e02af4d';

-- Test 4: Check if you own venue-1e02af4d
SELECT 'OWNERSHIP_CHECK' as test_name,
  v.venue_id, v.venue_name, v.owner_user_id,
  CASE WHEN v.owner_user_id = '1e02af4d-2a5d-4ae4-a3d3-ad06a4445b20' THEN 'YOU_OWN_IT' ELSE 'YOU_DONT_OWN_IT' END as ownership_status
FROM venues v WHERE v.venue_id = 'venue-1e02af4d';

-- Test 5: Test RPC with venue-1e02af4d (this should return enterprise tier if you own it)
SELECT 'RPC_WITH_VENUE' as test_name, * FROM get_access_context('venue-1e02af4d');

-- Test 6: Check RPC function exists and is accessible
SELECT 'RPC_FUNCTION_CHECK' as test_name,
  proname, proargnames, proargtypes
FROM pg_proc
WHERE proname = 'get_access_context';

-- Test 7: Try calling RPC with explicit casting
SELECT 'RPC_CAST_TEST' as test_name, * FROM get_access_context('venue-1e02af4d'::text);

-- Test 8: CRITICAL - Check if user has staff roles (if not owner, RPC returns null)
SELECT 'STAFF_ROLE_CHECK' as test_name,
  uvr.venue_id,
  uvr.role,
  uvr.user_id,
  '1e02af4d-2a5d-4ae4-a3d3-ad06a4445b20' as expected_user,
  CASE WHEN uvr.user_id = '1e02af4d-2a5d-4ae4-a3d3-ad06a4445b20' THEN 'HAS_STAFF_ROLE' ELSE 'NO_STAFF_ROLE' END as staff_status
FROM user_venue_roles uvr
WHERE uvr.user_id = '1e02af4d-2a5d-4ae4-a3d3-ad06a4445b20';

-- Test 9: Simulate the exact RPC logic step by step
WITH venue_check AS (
  SELECT
    v.venue_id,
    v.owner_user_id,
    '1e02af4d-2a5d-4ae4-a3d3-ad06a4445b20' as current_user,
    CASE WHEN v.owner_user_id = '1e02af4d-2a5d-4ae4-a3d3-ad06a4445b20' THEN 'IS_OWNER' ELSE 'NOT_OWNER' END as ownership
  FROM venues v
  WHERE v.venue_id = 'venue-1e02af4d'
),
org_check AS (
  SELECT
    o.owner_user_id,
    o.subscription_tier,
    o.subscription_status,
    COALESCE(o.subscription_tier, 'starter') as base_tier,
    CASE WHEN o.subscription_status = 'active' THEN COALESCE(o.subscription_tier, 'starter') ELSE 'starter' END as final_tier
  FROM organizations o
  WHERE o.owner_user_id = '1e02af4d-2a5d-4ae4-a3d3-ad06a4445b20'
),
staff_check AS (
  SELECT COUNT(*) as staff_roles
  FROM user_venue_roles uvr
  WHERE uvr.venue_id = 'venue-1e02af4d'
    AND uvr.user_id = '1e02af4d-2a5d-4ae4-a3d3-ad06a4445b20'
)
SELECT 'RPC_SIMULATION' as test_name,
  vc.venue_id,
  vc.ownership,
  oc.final_tier as expected_tier,
  sc.staff_roles,
  CASE
    WHEN vc.ownership = 'IS_OWNER' THEN 'SHOULD_RETURN_OWNER_CONTEXT'
    WHEN sc.staff_roles > 0 THEN 'SHOULD_RETURN_STAFF_CONTEXT'
    ELSE 'SHOULD_RETURN_NULL'
  END as expected_result
FROM venue_check vc
CROSS JOIN org_check oc
CROSS JOIN staff_check sc;

-- Test 6: Debug venue ID format issues
SELECT 'VENUE_ID_FORMAT' as test_name,
  'venue-1e02af4d' as venue_id,
  CASE WHEN 'venue-1e02af4d' LIKE 'venue-%' THEN 'HAS_VENUE_PREFIX' ELSE 'NO_VENUE_PREFIX' END as prefix_status,
  LENGTH('venue-1e02af4d') as id_length;

-- STEP 6: Check Stripe subscription status if you have stripe_subscription_id
-- (Only if you have a stripe_subscription_id from step 2)
-- SELECT * FROM stripe.subscriptions WHERE id = 'YOUR_STRIPE_SUBSCRIPTION_ID';

-- STEP 7: Check all organizations to see tier distribution
SELECT
    subscription_tier,
    subscription_status,
    COUNT(*) as count
FROM organizations
GROUP BY subscription_tier, subscription_status
ORDER BY subscription_tier, subscription_status;

-- STEP 8: Check if your organization has the correct tier limits applied
-- This shows what features should be available based on your tier
SELECT
    o.subscription_tier,
    o.subscription_status,
    CASE
        WHEN o.subscription_tier = 'enterprise' THEN 'Should have all features'
        WHEN o.subscription_tier = 'pro' THEN 'Should have Pro features'
        WHEN o.subscription_tier = 'starter' THEN 'Should have basic features only'
        ELSE 'Unknown tier'
    END as expected_features
FROM organizations o
WHERE o.owner_user_id = '1e02af4d-2a5d-4ae4-a3d3-ad06a4445b20';

-- ========================================================================================
-- HOW TO RUN THIS SCRIPT:
-- 1. Go to your Railway dashboard
-- 2. Find your PostgreSQL database
-- 3. Go to the "Query" tab
-- 4. Replace YOUR_USER_ID and VENUE_ID with actual values
-- 5. Run each query step by step
-- 6. Check the results
-- ========================================================================================
