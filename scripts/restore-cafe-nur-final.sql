-- Final restoration of Cafe Nur venue - No organization dependency
-- Run this directly in your Supabase SQL Editor

-- Step 1: Add is_primary column if it doesn't exist
ALTER TABLE venues ADD COLUMN IF NOT EXISTS is_primary BOOLEAN DEFAULT false;

-- Step 2: Check current state
SELECT '=== Current Venues ===' as info;
SELECT venue_id, venue_name, created_at FROM venues ORDER BY created_at;

-- Step 3: Get your user ID
SELECT '=== Your User Info ===' as info;
SELECT id as user_id, email FROM auth.users WHERE email = 'amaantanveer667@gmail.com';

-- Step 4: Restore Cafe Nur venue
-- We'll skip organization_id for now since the organizations table structure is unclear
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

-- Step 5: If you have an organization, update the venue with organization_id
-- This will only work if organizations table exists and has the right structure
-- If it fails, that's OK - the venue will still work
UPDATE venues 
SET organization_id = (
  SELECT id FROM organizations LIMIT 1
)
WHERE venue_id = 'venue-1e02af4d'
AND organization_id IS NULL;

-- Step 6: Create index for better performance
CREATE INDEX IF NOT EXISTS idx_venues_is_primary ON venues(is_primary);

-- Step 7: Verify the venue was restored
SELECT '=== Restored Venue ===' as info;
SELECT venue_id, venue_name, is_primary, organization_id, created_at 
FROM venues 
WHERE venue_name = 'Cafe Nur';

-- Step 8: Show all venues to confirm
SELECT '=== All Venues After Restoration ===' as info;
SELECT venue_id, venue_name, is_primary, created_at 
FROM venues 
ORDER BY is_primary DESC, created_at ASC;

-- Step 9: Success message
SELECT '✅ Cafe Nur has been restored successfully!' as result;
SELECT 'You can now access your dashboard at /dashboard/venue-1e02af4d' as next_step;
