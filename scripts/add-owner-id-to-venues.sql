-- Add missing columns to venues table
-- This ensures the venues table has all required columns for the complete profile functionality

-- Add owner_id column (links venues to their owners)
ALTER TABLE IF EXISTS venues
  ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Add business_type column
ALTER TABLE IF EXISTS venues
  ADD COLUMN IF NOT EXISTS business_type TEXT DEFAULT 'Restaurant';

-- Add phone column
ALTER TABLE IF EXISTS venues
  ADD COLUMN IF NOT EXISTS phone TEXT;

-- Add email column  
ALTER TABLE IF EXISTS venues
  ADD COLUMN IF NOT EXISTS email TEXT;

-- Add address column
ALTER TABLE IF EXISTS venues
  ADD COLUMN IF NOT EXISTS address TEXT;

-- Add description column
ALTER TABLE IF EXISTS venues
  ADD COLUMN IF NOT EXISTS description TEXT;

-- Add website column
ALTER TABLE IF EXISTS venues
  ADD COLUMN IF NOT EXISTS website TEXT;

-- Add logo_url column
ALTER TABLE IF EXISTS venues
  ADD COLUMN IF NOT EXISTS logo_url TEXT;

-- Add timestamps if they don't exist
ALTER TABLE IF EXISTS venues
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

ALTER TABLE IF EXISTS venues
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Create index for efficient owner-based queries
CREATE INDEX IF NOT EXISTS idx_venues_owner_id ON venues(owner_id); 