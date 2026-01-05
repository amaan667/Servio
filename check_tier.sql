-- Check subscription tier in database
-- Run this in Supabase SQL Editor to see what tier is stored

-- Replace 'YOUR_USER_ID' with your actual user ID (from auth.users table)
-- Or use the email to find the user ID first

-- Option 1: Check by user email
SELECT 
  u.id as user_id,
  u.email,
  o.id as organization_id,
  o.subscription_tier,
  o.subscription_status,
  o.stripe_customer_id,
  o.stripe_subscription_id,
  o.updated_at
FROM auth.users u
LEFT JOIN organizations o ON o.owner_user_id = u.id
WHERE u.email = 'your-email@example.com';  -- Replace with your email

-- Option 2: Check by organization ID (if you know it)
SELECT 
  id,
  owner_user_id,
  subscription_tier,
  subscription_status,
  stripe_customer_id,
  stripe_subscription_id,
  updated_at
FROM organizations
WHERE id = 'your-org-id';  -- Replace with your org ID

-- Option 3: Check all organizations (admin view)
SELECT 
  id,
  owner_user_id,
  subscription_tier,
  subscription_status,
  stripe_customer_id,
  stripe_subscription_id,
  updated_at,
  (SELECT email FROM auth.users WHERE id = owner_user_id) as owner_email
FROM organizations
ORDER BY updated_at DESC;

-- Option 4: Check what get_access_context RPC would return
-- Replace 'YOUR_VENUE_ID' with your actual venue_id
SELECT get_access_context('your-venue-id') as access_context;

