-- Add `owner_id` column to venues table
-- This links venues to their owners (users)

ALTER TABLE IF EXISTS venues
  ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Create index for efficient owner-based queries
CREATE INDEX IF NOT EXISTS idx_venues_owner_id ON venues(owner_id);

-- Add business_type column if it doesn't exist
ALTER TABLE IF EXISTS venues
  ADD COLUMN IF NOT EXISTS business_type TEXT DEFAULT 'Restaurant'; 