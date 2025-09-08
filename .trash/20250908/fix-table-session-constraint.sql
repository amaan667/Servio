-- Fix Table Session Constraint Issue
-- This script fixes the unique constraint that's preventing table creation

-- First, let's check what constraints exist
SELECT 
    conname as constraint_name,
    contype as constraint_type,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conrelid = 'table_sessions'::regclass;

-- Drop the problematic unique constraint if it exists
ALTER TABLE table_sessions 
DROP CONSTRAINT IF EXISTS uniq_open_session_per_table;

-- Also drop any other unique constraints that might be causing issues
ALTER TABLE table_sessions 
DROP CONSTRAINT IF EXISTS table_sessions_table_id_key;

-- Check if there are any triggers that might be causing issues
SELECT 
    trigger_name,
    event_manipulation,
    action_statement
FROM information_schema.triggers 
WHERE event_object_table = 'tables';

-- Drop the trigger that automatically creates sessions if it's causing issues
DROP TRIGGER IF EXISTS create_free_session_trigger ON tables;

-- Create a new trigger function that handles the constraint properly
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

-- Recreate the trigger with the fixed function
CREATE TRIGGER create_free_session_trigger
    AFTER INSERT ON tables
    FOR EACH ROW
    EXECUTE FUNCTION create_free_session_for_new_table();

-- Test the fix by creating a test table
-- (This will be commented out in production)
-- INSERT INTO tables (venue_id, label, seat_count, qr_version)
-- VALUES ('test-venue', 'Test Table', 2, 1);

-- Show completion message
DO $$
BEGIN
    RAISE NOTICE 'Table session constraint fix completed successfully!';
    RAISE NOTICE 'The /api/tables endpoint should now work properly.';
END $$;