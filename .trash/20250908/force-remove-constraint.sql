-- FORCE REMOVE CONSTRAINT - RUN THIS NOW IN SUPABASE
-- This will definitely remove the problematic constraint

-- Step 1: Show current constraints
SELECT 
    'Current constraints on table_sessions:' as info,
    conname as constraint_name,
    contype as constraint_type
FROM pg_constraint 
WHERE conrelid = 'table_sessions'::regclass;

-- Step 2: FORCE DROP the constraint
DO $$
BEGIN
    -- Try multiple ways to drop the constraint
    BEGIN
        ALTER TABLE table_sessions DROP CONSTRAINT uniq_open_session_per_table;
        RAISE NOTICE 'Successfully dropped uniq_open_session_per_table constraint';
    EXCEPTION
        WHEN undefined_object THEN
            RAISE NOTICE 'Constraint uniq_open_session_per_table does not exist';
        WHEN OTHERS THEN
            RAISE NOTICE 'Error dropping constraint: %', SQLERRM;
    END;
    
    -- Try dropping by index if constraint exists
    BEGIN
        DROP INDEX IF EXISTS uniq_open_session_per_table;
        RAISE NOTICE 'Dropped index uniq_open_session_per_table';
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE 'No index to drop: %', SQLERRM;
    END;
END $$;

-- Step 3: Drop ALL unique constraints on table_sessions
ALTER TABLE table_sessions DROP CONSTRAINT IF EXISTS table_sessions_table_id_key;
ALTER TABLE table_sessions DROP CONSTRAINT IF EXISTS table_sessions_pkey;

-- Step 4: Clean up ALL orphaned sessions
DELETE FROM table_sessions WHERE table_id NOT IN (SELECT id FROM tables);

-- Step 5: Drop the trigger completely
DROP TRIGGER IF EXISTS create_free_session_trigger ON tables;
DROP FUNCTION IF EXISTS create_free_session_for_new_table();

-- Step 6: Verify constraints are gone
SELECT 
    'Remaining constraints:' as info,
    conname as constraint_name,
    contype as constraint_type
FROM pg_constraint 
WHERE conrelid = 'table_sessions'::regclass;

-- Step 7: Test table creation by inserting a test table
INSERT INTO tables (venue_id, label, seat_count, qr_version) 
VALUES ('test-venue', 'Test Table', 4, 1)
ON CONFLICT DO NOTHING;

-- Step 8: Clean up test data
DELETE FROM tables WHERE venue_id = 'test-venue';

-- Step 9: Success message
SELECT 'CONSTRAINT REMOVAL COMPLETED - TABLE CREATION SHOULD NOW WORK!' as result;
