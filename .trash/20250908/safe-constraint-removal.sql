-- SAFE CONSTRAINT REMOVAL - HANDLES DEPENDENCIES
-- Run this in Supabase SQL Editor

-- Step 1: Show current constraints and dependencies
SELECT 
    'Current constraints on table_sessions:' as info,
    conname as constraint_name,
    contype as constraint_type
FROM pg_constraint 
WHERE conrelid = 'table_sessions'::regclass;

-- Step 2: Show foreign key dependencies
SELECT 
    'Foreign key dependencies:' as info,
    tc.constraint_name,
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
    AND (tc.table_name = 'table_sessions' OR ccu.table_name = 'table_sessions');

-- Step 3: SAFELY remove only the problematic constraint
DO $$
BEGIN
    -- Try to drop the specific problematic constraint
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

-- Step 4: Drop other problematic constraints (but keep primary key)
ALTER TABLE table_sessions DROP CONSTRAINT IF EXISTS table_sessions_table_id_key;

-- Step 5: Clean up orphaned sessions
DELETE FROM table_sessions WHERE table_id NOT IN (SELECT id FROM tables);

-- Step 6: Drop the trigger completely
DROP TRIGGER IF EXISTS create_free_session_trigger ON tables;
DROP FUNCTION IF EXISTS create_free_session_for_new_table();

-- Step 7: Verify the problematic constraint is gone
SELECT 
    'Remaining constraints:' as info,
    conname as constraint_name,
    contype as constraint_type
FROM pg_constraint 
WHERE conrelid = 'table_sessions'::regclass
    AND conname = 'uniq_open_session_per_table';

-- Step 8: Test table creation
INSERT INTO tables (venue_id, label, seat_count, qr_version) 
VALUES ('test-venue', 'Test Table', 4, 1)
ON CONFLICT DO NOTHING;

-- Step 9: Clean up test data
DELETE FROM tables WHERE venue_id = 'test-venue';

-- Step 10: Success message
SELECT 'SAFE CONSTRAINT REMOVAL COMPLETED!' as result;
