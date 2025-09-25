-- Add configurable daily reset time to venues table
-- This allows each venue to set their own auto-reset time (default 00:00)

-- Add the new column
ALTER TABLE venues 
ADD COLUMN IF NOT EXISTS daily_reset_time TIME DEFAULT '00:00:00';

-- Add a comment to explain the column
COMMENT ON COLUMN venues.daily_reset_time IS 'Time of day when automatic daily reset should run (24-hour format, e.g. 04:00:00 for 4 AM)';

-- Update existing venues to have the default reset time
UPDATE venues 
SET daily_reset_time = '00:00:00' 
WHERE daily_reset_time IS NULL;

-- Make the column NOT NULL with default
ALTER TABLE venues 
ALTER COLUMN daily_reset_time SET NOT NULL;

-- Create an index for efficient querying
CREATE INDEX IF NOT EXISTS idx_venues_daily_reset_time ON venues(daily_reset_time);

-- Add RLS policy for the new column
-- (The existing RLS policies should already cover this, but let's be explicit)
-- Policy to allow venue owners to update their reset time
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'venues' 
        AND policyname = 'Venue owners can update their reset time'
    ) THEN
        CREATE POLICY "Venue owners can update their reset time" ON venues
        FOR UPDATE USING (
            owner_id = auth.uid()
        );
    END IF;
END $$;

-- Test the new column
SELECT 
    'Testing venue reset time configuration:' as info,
    venue_id,
    name,
    daily_reset_time
FROM venues 
LIMIT 5;
