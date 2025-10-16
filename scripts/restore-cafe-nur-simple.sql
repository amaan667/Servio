-- Simple restoration of Cafe Nur venue
-- Run this directly in your Supabase SQL Editor

-- Step 1: Add is_primary column if it doesn't exist
ALTER TABLE venues ADD COLUMN IF NOT EXISTS is_primary BOOLEAN DEFAULT false;

-- Step 2: Get your user ID
SELECT 'Your user ID:' as info;
SELECT id as user_id, email FROM auth.users WHERE email = 'amaantanveer667@gmail.com';

-- Step 3: Restore Cafe Nur venue (without organization_id for now)
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
) VALUES (
  'venue-1e02af4d',  -- Your original venue ID
  'Cafe Nur',
  '523 Kings Road, Stretford, Manchester',  -- Your actual address
  '07527443911',  -- Your actual phone number
  'Your main cafe location in Stretford, Manchester',
  (SELECT id FROM auth.users WHERE email = 'amaantanveer667@gmail.com'),
  true,  -- Set as primary venue
  NOW() - INTERVAL '30 days',  -- Set created date to 30 days ago
  NOW()
);

-- Step 4: Create index for better performance
CREATE INDEX IF NOT EXISTS idx_venues_is_primary ON venues(is_primary);

-- Step 5: Verify the venue was restored
SELECT 'Restored venue:' as info;
SELECT venue_id, venue_name, is_primary, created_at FROM venues WHERE venue_name = 'Cafe Nur';

-- Step 6: Show all venues to confirm
SELECT 'All venues after restoration:' as info;
SELECT venue_id, venue_name, is_primary, created_at FROM venues ORDER BY is_primary DESC, created_at ASC;
