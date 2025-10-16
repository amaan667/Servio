-- Restore Cafe Nur venue that was accidentally deleted
-- Run this directly in your Supabase SQL Editor
-- This version is more defensive and handles missing tables/columns

-- Step 1: Add is_primary column if it doesn't exist
ALTER TABLE venues ADD COLUMN IF NOT EXISTS is_primary BOOLEAN DEFAULT false;

-- Step 2: Check current state
SELECT 'Current venues:' as info;
SELECT venue_id, venue_name, created_at FROM venues ORDER BY created_at;

-- Step 3: Get your user info
SELECT 'Your user info:' as info;
SELECT id as user_id, email FROM auth.users WHERE email = 'amaantanveer667@gmail.com';

-- Step 4: Check if organizations table exists and get organization info
DO $$
BEGIN
    -- Check if organizations table exists
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'organizations') THEN
        -- Check if owner_id column exists
        IF EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'owner_id') THEN
            RAISE NOTICE 'Organizations table found with owner_id column';
            -- This will be executed in the main query below
        ELSE
            RAISE NOTICE 'Organizations table exists but owner_id column not found';
        END IF;
    ELSE
        RAISE NOTICE 'Organizations table does not exist';
    END IF;
END $$;

-- Try to get organization info (will fail gracefully if table/column doesn't exist)
SELECT 'Your organization info:' as info;
SELECT id as org_id, name, owner_id FROM organizations WHERE owner_id = (
  SELECT id FROM auth.users WHERE email = 'amaantanveer667@gmail.com'
);

-- Step 5: Restore Cafe Nur venue
-- If organizations table doesn't exist, we'll set organization_id to NULL
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
  -- Try to get organization_id, but use NULL if organizations table doesn't exist
  COALESCE(
    (SELECT id FROM organizations WHERE owner_id = (SELECT id FROM auth.users WHERE email = 'amaantanveer667@gmail.com')),
    NULL
  ),
  true,  -- Set as primary venue
  NOW() - INTERVAL '30 days',  -- Set created date to 30 days ago
  NOW()
);

-- Step 6: Create index for better performance
CREATE INDEX IF NOT EXISTS idx_venues_is_primary ON venues(is_primary);

-- Step 7: Verify the venue was restored
SELECT 'Restored venue:' as info;
SELECT venue_id, venue_name, is_primary, created_at FROM venues WHERE venue_name = 'Cafe Nur';

-- Step 8: Show all venues to confirm
SELECT 'All venues after restoration:' as info;
SELECT venue_id, venue_name, is_primary, created_at FROM venues ORDER BY is_primary DESC, created_at ASC;
