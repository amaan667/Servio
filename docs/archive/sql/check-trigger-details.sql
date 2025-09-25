-- Check the exact trigger and function that's causing the integer conversion error

-- 1. Get the full definition of the create_initial_table_session function
SELECT 'Full create_initial_table_session function definition:' as info;
SELECT 
    routine_name,
    routine_definition
FROM information_schema.routines 
WHERE routine_name = 'create_initial_table_session';

-- 2. Check if there's a trigger that calls this function
SELECT 'Trigger that calls create_initial_table_session:' as info;
SELECT 
    trigger_name,
    event_manipulation,
    action_timing,
    action_statement
FROM information_schema.triggers 
WHERE action_statement ILIKE '%create_initial_table_session%';

-- 3. Check the table_sessions table structure to see what fields are integers
SELECT 'Table_sessions table structure (focusing on integer fields):' as info;
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'table_sessions' 
  AND table_schema = 'public'
  AND data_type IN ('integer', 'bigint', 'smallint', 'numeric')
ORDER BY ordinal_position;

-- 4. Try to disable the trigger temporarily to test table creation
SELECT 'Attempting to disable the trigger:' as info;
ALTER TABLE tables DISABLE TRIGGER create_initial_table_session;

-- 5. Test table creation without the trigger
SELECT 'Testing table creation without trigger:' as info;
INSERT INTO tables (venue_id, label, seat_count, area, is_active)
VALUES ('venue-1e02af4d', 'Fixed Test Table', 2, 'Test Area', true)
RETURNING id, venue_id, label, seat_count, is_active, created_at;

-- 6. Manually create a session for the new table
SELECT 'Manually creating session for the new table:' as info;
INSERT INTO table_sessions (venue_id, table_id, status, opened_at, closed_at)
SELECT 
    'venue-1e02af4d',
    t.id,
    'FREE',
    NOW(),
    NULL
FROM tables t
WHERE t.venue_id = 'venue-1e02af4d' 
  AND t.label = 'Fixed Test Table'
RETURNING id, table_id, status;

-- 7. Re-enable the trigger
SELECT 'Re-enabling the trigger:' as info;
ALTER TABLE tables ENABLE TRIGGER create_initial_table_session;
