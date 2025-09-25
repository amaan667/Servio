-- Debug table creation to find the integer field issue
-- The error suggests a string is being passed to an integer field

-- 1. Check the table structure to see what fields are integers
SELECT 'Tables table structure:' as info;
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'tables' 
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- 2. Check the table_sessions structure
SELECT 'Table_sessions table structure:' as info;
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'table_sessions' 
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- 3. Try to create a table with a simple label to see if it works
SELECT 'Testing simple table creation:' as info;
INSERT INTO tables (venue_id, label, seat_count, area, is_active)
VALUES ('venue-1e02af4d', 'Test Table 1', 2, 'Test Area', true)
RETURNING id, venue_id, label, seat_count, is_active, created_at;

-- 4. Check if there are any triggers on the tables table
SELECT 'Triggers on tables table:' as info;
SELECT 
    trigger_name,
    event_manipulation,
    action_timing,
    action_statement
FROM information_schema.triggers 
WHERE event_object_table = 'tables';

-- 5. Check if there are any functions that might be called by triggers
SELECT 'Functions that might be called by triggers:' as info;
SELECT 
    routine_name,
    routine_definition
FROM information_schema.routines 
WHERE routine_definition ILIKE '%tables%'
   OR routine_definition ILIKE '%table_sessions%';
