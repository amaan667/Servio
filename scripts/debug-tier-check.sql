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

-- Test 2: Get the exact venue ID you're trying to access
-- Check your browser URL: https://yourapp.com/dashboard/VENUE_ID_HERE
-- What VENUE_ID shows in your browser URL right now?
-- SELECT 'CURRENT_VENUE_ID' as test_name, 'PASTE_VENUE_ID_FROM_BROWSER_URL' as browser_venue_id;

-- Test 3: Verify this venue exists in database
-- SELECT 'VENUE_EXISTS_CHECK' as test_name, venue_id, venue_name, owner_user_id
-- FROM venues WHERE venue_id = 'PASTE_VENUE_ID_FROM_BROWSER_URL';

-- Test 4: Check if you own this venue
-- SELECT 'OWNERSHIP_CHECK' as test_name,
--   v.venue_id, v.venue_name, v.owner_user_id,
--   CASE WHEN v.owner_user_id = '1e02af4d-2a5d-4ae4-a3d3-ad06a4445b20' THEN 'YOU_OWN_IT' ELSE 'YOU_DONT_OWN_IT' END as ownership_status
-- FROM venues v WHERE v.venue_id = 'PASTE_VENUE_ID_FROM_BROWSER_URL';

-- Test 5: Test RPC with the venue ID
-- SELECT 'RPC_WITH_VENUE' as test_name, * FROM get_access_context('PASTE_VENUE_ID_FROM_BROWSER_URL');

-- Test 6: Debug venue ID format issues
-- SELECT 'VENUE_ID_FORMAT' as test_name,
--   'PASTE_VENUE_ID_FROM_BROWSER_URL' as venue_id,
--   CASE WHEN 'PASTE_VENUE_ID_FROM_BROWSER_URL' LIKE 'venue-%' THEN 'HAS_VENUE_PREFIX' ELSE 'NO_VENUE_PREFIX' END as prefix_status,
--   LENGTH('PASTE_VENUE_ID_FROM_BROWSER_URL') as id_length;

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
