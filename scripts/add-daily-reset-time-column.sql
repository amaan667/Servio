-- Add daily_reset_time column to venues table if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'venues' 
        AND column_name = 'daily_reset_time'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE venues ADD COLUMN daily_reset_time TIME;
        RAISE NOTICE 'Added daily_reset_time column to venues table';
    ELSE
        RAISE NOTICE 'daily_reset_time column already exists in venues table';
    END IF;
END $$;

-- Set default reset time to midnight for existing venues
UPDATE venues 
SET daily_reset_time = '00:00:00' 
WHERE daily_reset_time IS NULL;