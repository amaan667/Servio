-- Check and fix owner column in venues table
-- Run this directly in your Supabase SQL Editor

-- Step 1: Check what owner-related columns currently exist
SELECT column_name, data_type, is_nullable
FROM information_schema.columns  
WHERE table_name = 'venues' AND column_name LIKE '%owner%'
ORDER BY column_name;

-- Step 2: Check if owner_user_id already exists
SELECT column_name, data_type, is_nullable
FROM information_schema.columns  
WHERE table_name = 'venues' AND column_name = 'owner_user_id';

-- Step 3: If owner_user_id doesn't exist, create it
-- First check if we need to add the column
DO $$
BEGIN
    -- Check if owner_user_id column exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'venues' AND column_name = 'owner_user_id'
    ) THEN
        -- Check if owner_id exists and copy data from it
        IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'venues' AND column_name = 'owner_id'
        ) THEN
            -- Add owner_user_id column and copy data from owner_id
            ALTER TABLE venues ADD COLUMN owner_user_id UUID REFERENCES auth.users(id);
            UPDATE venues SET owner_user_id = owner_id;
            ALTER TABLE venues DROP COLUMN owner_id;
            RAISE NOTICE 'Copied data from owner_id to owner_user_id and dropped owner_id';
        ELSE
            -- No owner column exists, add owner_user_id
            ALTER TABLE venues ADD COLUMN owner_user_id UUID REFERENCES auth.users(id);
            RAISE NOTICE 'Added owner_user_id column';
        END IF;
    ELSE
        RAISE NOTICE 'owner_user_id column already exists';
    END IF;
END $$;

-- Step 4: Create index if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_venues_owner_user ON venues(owner_user_id);

-- Step 5: Verify the final state
SELECT column_name, data_type, is_nullable
FROM information_schema.columns  
WHERE table_name = 'venues' AND column_name LIKE '%owner%'
ORDER BY column_name;

-- Step 6: Test that venues can be found by owner_user_id
SELECT venue_id, name, owner_user_id 
FROM venues 
LIMIT 5;
