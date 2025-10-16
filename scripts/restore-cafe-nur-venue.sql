-- Restore Cafe Nur venue that was accidentally deleted
-- Run this directly in your Supabase SQL Editor

-- Step 1: Check if you have any venues left
SELECT 'Current venues:' as info;
SELECT venue_id, venue_name, created_at FROM venues ORDER BY created_at;

-- Step 2: Get your user ID (replace with your actual user ID)
-- You can find this in your Supabase auth.users table
SELECT 'Your user ID:' as info;
SELECT id, email FROM auth.users WHERE email = 'amaantanveer667@gmail.com';

-- Step 3: Get your organization ID
SELECT 'Your organization:' as info;
SELECT id, name, owner_id FROM organizations WHERE owner_id = (
  SELECT id FROM auth.users WHERE email = 'amaantanveer667@gmail.com'
);

-- Step 4: Restore Cafe Nur venue
-- Replace 'YOUR_USER_ID' and 'YOUR_ORG_ID' with the actual IDs from steps 2 and 3
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
  'Your original address',  -- Update with actual address
  'Your phone number',      -- Update with actual phone
  'Your main cafe location',
  (SELECT id FROM auth.users WHERE email = 'amaantanveer667@gmail.com'),
  (SELECT id FROM organizations WHERE owner_id = (SELECT id FROM auth.users WHERE email = 'amaantanveer667@gmail.com')),
  true,  -- Set as primary venue
  NOW() - INTERVAL '30 days',  -- Set created date to 30 days ago
  NOW()
);

-- Step 5: Verify the venue was restored
SELECT 'Restored venue:' as info;
SELECT venue_id, venue_name, is_primary, created_at FROM venues WHERE venue_name = 'Cafe Nur';
