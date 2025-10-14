-- Fix owner column name mismatch
-- The app expects 'owner_user_id' but database has 'owner_id'
-- This migration aligns the database with the application code

-- Rename owner_id to owner_user_id in venues table
ALTER TABLE venues RENAME COLUMN owner_id TO owner_user_id;

-- Update any indexes that reference the old column name
DROP INDEX IF EXISTS idx_venues_owner;
CREATE INDEX IF NOT EXISTS idx_venues_owner_user ON venues(owner_user_id);

-- Update any foreign key constraints
-- Note: This will update the multi-venue migration references too
-- We'll need to update those queries to use owner_user_id instead

-- Verify the change worked
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'venues' AND column_name LIKE '%owner%'
ORDER BY column_name;
