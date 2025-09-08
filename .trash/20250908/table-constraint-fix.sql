-- Fix Table Session Constraint Issue
-- Run this in your Supabase SQL editor to fix the 503 error

-- Step 1: Drop the problematic unique constraint if it exists
ALTER TABLE table_sessions 
DROP CONSTRAINT IF EXISTS uniq_open_session_per_table;

-- Step 2: Drop any other unique constraints that might be causing issues
ALTER TABLE table_sessions 
DROP CONSTRAINT IF EXISTS table_sessions_table_id_key;

-- Step 3: Drop the trigger that automatically creates sessions if it's causing issues
DROP TRIGGER IF EXISTS create_free_session_trigger ON tables;

-- Step 4: Create a new trigger function that handles the constraint properly
CREATE OR REPLACE FUNCTION create_free_session_for_new_table()
RETURNS TRIGGER AS $$
BEGIN
    -- Only create a session if there isn't already an open one
    IF NOT EXISTS (
        SELECT 1 FROM table_sessions 
        WHERE table_id = NEW.id 
        AND closed_at IS NULL
    ) THEN
        INSERT INTO table_sessions (table_id, venue_id, status, opened_at)
        VALUES (NEW.id, NEW.venue_id, 'FREE', NOW());
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Step 5: Recreate the trigger with the fixed function
CREATE TRIGGER create_free_session_trigger
    AFTER INSERT ON tables
    FOR EACH ROW
    EXECUTE FUNCTION create_free_session_for_new_table();

-- Show completion message
DO $$
BEGIN
    RAISE NOTICE 'Table session constraint fix completed successfully!';
    RAISE NOTICE 'The /api/tables endpoint should now work properly.';
END $$;
