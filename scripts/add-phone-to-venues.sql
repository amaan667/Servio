-- Add phone column to venues table if it doesn't exist
-- This script safely adds the phone column without breaking existing data

DO $$ 
BEGIN
    -- Check if the phone column exists, if not add it
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'venues' 
        AND column_name = 'phone'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE venues ADD COLUMN phone TEXT;
        RAISE NOTICE 'Added phone column to venues table';
    ELSE
        RAISE NOTICE 'Phone column already exists in venues table';
    END IF;
END $$;