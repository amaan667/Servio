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

-- STEP 5: CRITICAL TEST - Test the get_access_context RPC function
-- This is where the bug is! Your DB shows enterprise but RPC returns starter

-- IMPORTANT: The RPC returns NULL if:
-- 1. Venue doesn't exist, OR
-- 2. User has no access to the venue (not owner, not staff)
-- When RPC returns NULL, frontend defaults to STARTER tier!

-- Test 1: User-only context (no venue) - SHOULD return enterprise tier
SELECT 'USER_ONLY_TEST' as test_name, * FROM get_access_context(NULL);

-- Test 2: Test with first venue from Step 3b (if any exist)
-- This should work if you own the venue
-- SELECT 'FIRST_VENUE_TEST' as test_name, * FROM get_access_context((SELECT venue_id FROM venues LIMIT 1));

-- Test 3: Check what happens with non-existent venue (should return NULL)
SELECT 'INVALID_VENUE_TEST' as test_name, * FROM get_access_context('venue-nonexistent');

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
