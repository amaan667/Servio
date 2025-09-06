-- SIMPLE CONSTRAINT FIX
-- Run this in Supabase SQL Editor to fix table creation

-- 1. Drop the problematic constraint
ALTER TABLE table_sessions DROP CONSTRAINT IF EXISTS uniq_open_session_per_table;

-- 2. Drop the trigger that's causing issues
DROP TRIGGER IF EXISTS create_free_session_trigger ON tables;

-- 3. Clean up any orphaned sessions
DELETE FROM table_sessions WHERE table_id NOT IN (SELECT id FROM tables);

-- 4. Create a simple trigger function without constraints
CREATE OR REPLACE FUNCTION create_free_session_for_new_table()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO table_sessions (table_id, venue_id, status, opened_at)
    VALUES (NEW.id, NEW.venue_id, 'FREE', NOW());
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 5. Recreate the trigger
CREATE TRIGGER create_free_session_trigger
    AFTER INSERT ON tables
    FOR EACH ROW
    EXECUTE FUNCTION create_free_session_for_new_table();

-- 6. Success message
SELECT 'Constraint fix completed - table creation should now work!' as result;
