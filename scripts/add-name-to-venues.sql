-- Add `name` column to venues if it’s missing
ALTER TABLE IF EXISTS venues
  ADD COLUMN IF NOT EXISTS name TEXT;
