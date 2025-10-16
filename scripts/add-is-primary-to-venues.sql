-- Add is_primary column to venues table
-- Run this directly in your Supabase SQL Editor

-- Step 1: Add the is_primary column
ALTER TABLE venues ADD COLUMN IF NOT EXISTS is_primary BOOLEAN DEFAULT false;

-- Step 2: Set the first venue (oldest by created_at) as primary
UPDATE venues 
SET is_primary = true 
WHERE venue_id = (
  SELECT venue_id 
  FROM venues 
  ORDER BY created_at ASC 
  LIMIT 1
);

-- Step 3: Create an index for better performance
CREATE INDEX IF NOT EXISTS idx_venues_is_primary ON venues(is_primary);

-- Step 4: Verify the changes
SELECT venue_id, venue_name, is_primary, created_at 
FROM venues 
ORDER BY is_primary DESC, created_at ASC;
