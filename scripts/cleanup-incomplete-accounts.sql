-- ============================================
-- CLEANUP INCOMPLETE ACCOUNTS SCRIPT
-- ============================================
-- This script identifies accounts that were created before the plan selection flow
-- These accounts exist but don't have proper subscriptions/venues set up
--
-- USAGE:
-- 1. First run the SELECT queries to see what will be affected
-- 2. Review the results carefully
-- 3. Uncomment the DELETE statements if you want to remove them
-- 4. Run in Supabase SQL Editor
-- ============================================

-- ============================================
-- STEP 1: IDENTIFY INCOMPLETE ACCOUNTS
-- ============================================
-- Find users who:
-- - Exist in auth.users
-- - Don't have any venues (not an owner)
-- - Don't have any staff roles
-- - Don't have an organization
-- - May have incomplete onboarding

SELECT 
  u.id,
  u.email,
  u.created_at,
  u.email_confirmed_at,
  u.user_metadata->>'full_name' as full_name,
  u.user_metadata->>'pending_signup' as pending_signup,
  -- Check if user owns any venues
  (SELECT COUNT(*) FROM venues WHERE owner_user_id = u.id) as venue_count,
  -- Check if user has staff roles
  (SELECT COUNT(*) FROM user_venue_roles WHERE user_id = u.id) as staff_role_count,
  -- Check if user has organization
  (SELECT COUNT(*) FROM organizations WHERE owner_user_id = u.id) as org_count,
  -- Check onboarding progress
  (SELECT current_step FROM onboarding_progress WHERE user_id = u.id) as onboarding_step
FROM auth.users u
WHERE 
  -- User exists
  u.id IS NOT NULL
  -- No venues owned
  AND NOT EXISTS (SELECT 1 FROM venues WHERE owner_user_id = u.id)
  -- No staff roles
  AND NOT EXISTS (SELECT 1 FROM user_venue_roles WHERE user_id = u.id)
  -- No organization
  AND NOT EXISTS (SELECT 1 FROM organizations WHERE owner_user_id = u.id)
ORDER BY u.created_at DESC;

-- ============================================
-- STEP 2: COUNT INCOMPLETE ACCOUNTS
-- ============================================
SELECT 
  COUNT(*) as incomplete_account_count,
  COUNT(CASE WHEN email_confirmed_at IS NULL THEN 1 END) as unverified_count,
  COUNT(CASE WHEN user_metadata->>'pending_signup' IS NOT NULL THEN 1 END) as pending_signup_count
FROM auth.users u
WHERE 
  NOT EXISTS (SELECT 1 FROM venues WHERE owner_user_id = u.id)
  AND NOT EXISTS (SELECT 1 FROM user_venue_roles WHERE user_id = u.id)
  AND NOT EXISTS (SELECT 1 FROM organizations WHERE owner_user_id = u.id);

-- ============================================
-- STEP 3: DETAILED BREAKDOWN BY CREATION DATE
-- ============================================
SELECT 
  DATE(created_at) as creation_date,
  COUNT(*) as account_count,
  COUNT(CASE WHEN email_confirmed_at IS NOT NULL THEN 1 END) as verified_count,
  COUNT(CASE WHEN email_confirmed_at IS NULL THEN 1 END) as unverified_count
FROM auth.users u
WHERE 
  NOT EXISTS (SELECT 1 FROM venues WHERE owner_user_id = u.id)
  AND NOT EXISTS (SELECT 1 FROM user_venue_roles WHERE user_id = u.id)
  AND NOT EXISTS (SELECT 1 FROM organizations WHERE owner_user_id = u.id)
GROUP BY DATE(created_at)
ORDER BY creation_date DESC;

-- ============================================
-- STEP 4: CLEANUP (UNCOMMENT TO EXECUTE)
-- ============================================
-- WARNING: This will permanently delete accounts and all associated data
-- Make sure you've reviewed the SELECT queries above first!

-- Delete onboarding progress for incomplete accounts
/*
DELETE FROM onboarding_progress
WHERE user_id IN (
  SELECT u.id
  FROM auth.users u
  WHERE 
    NOT EXISTS (SELECT 1 FROM venues WHERE owner_user_id = u.id)
    AND NOT EXISTS (SELECT 1 FROM user_venue_roles WHERE user_id = u.id)
    AND NOT EXISTS (SELECT 1 FROM organizations WHERE owner_user_id = u.id)
);
*/

-- Delete users (this will cascade delete related data due to ON DELETE CASCADE)
-- Note: This requires admin privileges and may need to be done via Supabase Admin API
/*
-- First, get the list of user IDs to delete
SELECT id, email 
FROM auth.users u
WHERE 
  NOT EXISTS (SELECT 1 FROM venues WHERE owner_user_id = u.id)
  AND NOT EXISTS (SELECT 1 FROM user_venue_roles WHERE user_id = u.id)
  AND NOT EXISTS (SELECT 1 FROM organizations WHERE owner_user_id = u.id);
*/

-- ============================================
-- ALTERNATIVE: SAFE CLEANUP VIA API
-- ============================================
-- Instead of direct SQL deletion, you can use Supabase Admin API
-- This is safer and provides better logging

