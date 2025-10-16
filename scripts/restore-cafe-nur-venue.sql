-- Restore Cafe Nur venue that was accidentally deleted
-- Run this directly in your Supabase SQL Editor

-- Step 1: Add is_primary column if it doesn't exist
ALTER TABLE venues ADD COLUMN IF NOT EXISTS is_primary BOOLEAN DEFAULT false;

-- Step 2: Check current state
SELECT 'Current venues:' as info;
SELECT venue_id, venue_name, created_at FROM venues ORDER BY created_at;

-- Step 3: Get your user and organization info
SELECT 'Your user info:' as info;
SELECT id as user_id, email FROM auth.users WHERE email = 'amaantanveer667@gmail.com';

SELECT 'Your organization info:' as info;
SELECT id as org_id, name, owner_id FROM organizations WHERE owner_id = (
  SELECT id FROM auth.users WHERE email = 'amaantanveer667@gmail.com'
);

-- Step 4: Restore Cafe Nur venue with all the correct IDs
INSERT INTO venues (
  venue_id,
  venue_name,
  address,
  phone,
  description,
  owner_user_id,
  organization_id,
  is_primary,
  created_at,
  updated_at
) VALUES (
  'venue-1e02af4d',  -- Your original venue ID
  'Cafe Nur',
  '523 Kings Road, Stretford, Manchester',  -- Your actual address
  '07527443911',  -- Your actual phone number
  'Your main cafe location in Stretford, Manchester',
  (SELECT id FROM auth.users WHERE email = 'amaantanveer667@gmail.com'),
  (SELECT id FROM organizations WHERE owner_id = (SELECT id FROM auth.users WHERE email = 'amaantanveer667@gmail.com')),
  true,  -- Set as primary venue
  NOW() - INTERVAL '30 days',  -- Set created date to 30 days ago
  NOW()
);

-- Step 5: Create index for better performance
CREATE INDEX IF NOT EXISTS idx_venues_is_primary ON venues(is_primary);

-- Step 6: Verify the venue was restored
SELECT 'Restored venue:' as info;
SELECT venue_id, venue_name, is_primary, created_at FROM venues WHERE venue_name = 'Cafe Nur';

-- Step 7: Show all venues to confirm
SELECT 'All venues after restoration:' as info;
SELECT venue_id, venue_name, is_primary, created_at FROM venues ORDER BY is_primary DESC, created_at ASC;
