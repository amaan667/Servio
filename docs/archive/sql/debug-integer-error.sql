-- Debug the integer conversion error since the trigger doesn't exist

-- 1. Check all triggers on the tables table
SELECT 'All triggers on tables table:' as info;
SELECT 
    trigger_name,
    event_manipulation,
    action_timing,
    action_statement
FROM information_schema.triggers 
WHERE event_object_table = 'tables';

-- 2. Check all triggers on table_sessions table
SELECT 'All triggers on table_sessions table:' as info;
SELECT 
    trigger_name,
    event_manipulation,
    action_timing,
    action_statement
FROM information_schema.triggers 
WHERE event_object_table = 'table_sessions';

-- 3. Get the full definition of the create_initial_table_session function
SELECT 'Full create_initial_table_session function definition:' as info;
SELECT 
    routine_name,
    routine_definition
FROM information_schema.routines 
WHERE routine_name = 'create_initial_table_session';

-- 4. Check if there are any other functions that might be called
SELECT 'Other functions that might be called:' as info;
SELECT 
    routine_name,
    routine_definition
FROM information_schema.routines 
WHERE routine_definition ILIKE '%INSERT INTO table_sessions%'
   OR routine_definition ILIKE '%NEW.%'
   OR routine_definition ILIKE '%tables%';

-- 5. Check the exact table_sessions structure to see what could be causing integer conversion
SELECT 'Table_sessions structure (all columns):' as info;
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'table_sessions' 
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- 6. Try to create a table and see what happens
SELECT 'Testing table creation to reproduce the error:' as info;
INSERT INTO tables (venue_id, label, seat_count, area, is_active)
VALUES ('venue-1e02af4d', 'Fixed Test Table', 2, 'Test Area', true)
RETURNING id, venue_id, label, seat_count, is_active, created_at;
