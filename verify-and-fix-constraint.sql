-- VERIFY AND FIX CONSTRAINT ISSUE
-- This script will show you the current state and fix the problem

-- Step 1: Check current constraints on table_sessions
SELECT 
    'Current constraints on table_sessions:' as info,
    conname as constraint_name,
    contype as constraint_type,
    pg_get_constraintdef(oid) as definition
FROM pg_constraint 
WHERE conrelid = 'table_sessions'::regclass;

-- Step 2: Check if the problematic constraint exists
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_constraint 
            WHERE conname = 'uniq_open_session_per_table'
        ) 
        THEN 'CONSTRAINT STILL EXISTS - NEEDS TO BE REMOVED'
        ELSE 'CONSTRAINT NOT FOUND - ALREADY REMOVED'
    END as constraint_status;

-- Step 3: Check for orphaned sessions
SELECT 
    'Orphaned sessions count:' as info,
    COUNT(*) as count
FROM table_sessions ts
LEFT JOIN tables t ON ts.table_id = t.id
WHERE t.id IS NULL;

-- Step 4: FORCE REMOVE the constraint (run this if constraint still exists)
DO $$
BEGIN
    -- Try to drop the constraint
    BEGIN
        ALTER TABLE table_sessions DROP CONSTRAINT uniq_open_session_per_table;
        RAISE NOTICE 'Successfully dropped uniq_open_session_per_table constraint';
    EXCEPTION
        WHEN undefined_object THEN
            RAISE NOTICE 'Constraint uniq_open_session_per_table does not exist';
        WHEN OTHERS THEN
            RAISE NOTICE 'Error dropping constraint: %', SQLERRM;
    END;
END $$;

-- Step 5: Drop any other problematic constraints
ALTER TABLE table_sessions DROP CONSTRAINT IF EXISTS table_sessions_table_id_key;

-- Step 6: Clean up orphaned sessions
DELETE FROM table_sessions WHERE table_id NOT IN (SELECT id FROM tables);

-- Step 7: Drop and recreate the trigger
DROP TRIGGER IF EXISTS create_free_session_trigger ON tables;

-- Step 8: Create a simple trigger function
CREATE OR REPLACE FUNCTION create_free_session_for_new_table()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO table_sessions (table_id, venue_id, status, opened_at)
    VALUES (NEW.id, NEW.venue_id, 'FREE', NOW());
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Step 9: Recreate the trigger
CREATE TRIGGER create_free_session_trigger
    AFTER INSERT ON tables
    FOR EACH ROW
    EXECUTE FUNCTION create_free_session_for_new_table();

-- Step 10: Final verification
SELECT 'FIX COMPLETED' as status;
SELECT 'Remaining constraints:' as info, COUNT(*) as count 
FROM pg_constraint 
WHERE conrelid = 'table_sessions'::regclass;
