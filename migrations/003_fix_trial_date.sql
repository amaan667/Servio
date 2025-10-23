-- ============================================================================
-- Migration: Fix Trial Date for Existing User
-- Purpose: Update trial_ends_at from August 21 to October 24 (Oct 10 + 14 days)
-- ============================================================================

-- Update your specific organization's trial date
UPDATE organizations
SET 
  trial_ends_at = '2024-10-24T00:00:00Z',  -- Oct 10 + 14 days
  subscription_status = 'trialing',          -- Ensure still trialing
  updated_at = NOW()
WHERE owner_user_id = '1e02af4d-2a5d-4ae4-a3d3-ad06a4445b20';

-- Verify the update worked
SELECT 
  id,
  owner_user_id,
  subscription_tier,
  subscription_status,
  trial_ends_at,
  EXTRACT(DAY FROM (trial_ends_at - NOW())) as days_remaining
FROM organizations
WHERE owner_user_id = '1e02af4d-2a5d-4ae4-a3d3-ad06a4445b20';

-- ============================================================================
-- Alternative: Extend trial by 14 days from today
-- ============================================================================

-- Uncomment this if you want to give yourself a fresh 14-day trial:
-- UPDATE organizations
-- SET 
--   trial_ends_at = (NOW() + INTERVAL '14 days')::timestamp,
--   subscription_status = 'trialing',
--   updated_at = NOW()
-- WHERE owner_user_id = '1e02af4d-2a5d-4ae4-a3d3-ad06a4445b20';

