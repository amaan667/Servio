-- EMERGENCY FIX: Remove constraint and clean up conflicting data
-- This will resolve the table creation issue immediately

-- Step 1: First, let's see what's causing the conflict
SELECT 
    'Current constraint status:' as info,
    conname as constraint_name,
    contype as constraint_type
FROM pg_constraint 
WHERE conname LIKE '%uniq_open_session_per_table%' 
   OR conname LIKE '%table_sessions%';

-- Step 2: Check for orphaned sessions
SELECT 
    'Orphaned sessions:' as info,
    COUNT(*) as count
FROM table_sessions ts
LEFT JOIN tables t ON ts.table_id = t.id
WHERE t.id IS NULL;

-- Step 3: Drop the problematic constraint completely
ALTER TABLE table_sessions 
DROP CONSTRAINT IF EXISTS uniq_open_session_per_table;

-- Step 4: Drop any other unique constraints on table_id
ALTER TABLE table_sessions 
DROP CONSTRAINT IF EXISTS table_sessions_table_id_key;

-- Step 5: Clean up orphaned sessions that might be causing conflicts
DELETE FROM table_sessions 
WHERE table_id NOT IN (SELECT id FROM tables);

-- Step 6: Drop the problematic trigger
DROP TRIGGER IF EXISTS create_free_session_trigger ON tables;

-- Step 7: Create a safer trigger function
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

-- Step 8: Recreate the trigger
CREATE TRIGGER create_free_session_trigger
    AFTER INSERT ON tables
    FOR EACH ROW
    EXECUTE FUNCTION create_free_session_for_new_table();

-- Step 9: Verify the fix
SELECT 'Fix completed successfully!' as status;
SELECT 'Remaining sessions:' as info, COUNT(*) as count FROM table_sessions;
SELECT 'Remaining tables:' as info, COUNT(*) as count FROM tables;
