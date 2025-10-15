-- Fix owner column name mismatch in venues table
-- Run this directly in your Supabase SQL Editor

-- Step 1: Check current column structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns  
WHERE table_name = 'venues' AND column_name LIKE '%owner%'
ORDER BY column_name;

-- Step 2: Rename owner_id to owner_user_id
ALTER TABLE venues RENAME COLUMN owner_id TO owner_user_id;

-- Step 3: Update indexes
DROP INDEX IF EXISTS idx_venues_owner;
CREATE INDEX IF NOT EXISTS idx_venues_owner_user ON venues(owner_user_id);

-- Step 4: Verify the fix worked
SELECT column_name, data_type, is_nullable
FROM information_schema.columns  
WHERE table_name = 'venues' AND column_name LIKE '%owner%'
ORDER BY column_name;

-- Step 5: Test that venues can be found by owner_user_id
SELECT venue_id, name, owner_user_id 
FROM venues 
LIMIT 5;
