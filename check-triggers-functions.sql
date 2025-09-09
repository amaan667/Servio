-- Check for triggers and functions that might be causing the integer conversion error

-- 1. Check for triggers on the tables table
SELECT 'Triggers on tables table:' as info;
SELECT 
    trigger_name,
    event_manipulation,
    action_timing,
    action_statement
FROM information_schema.triggers 
WHERE event_object_table = 'tables';

-- 2. Check for triggers on table_sessions table
SELECT 'Triggers on table_sessions table:' as info;
SELECT 
    trigger_name,
    event_manipulation,
    action_timing,
    action_statement
FROM information_schema.triggers 
WHERE event_object_table = 'table_sessions';

-- 3. Check for functions that might be called by triggers
SELECT 'Functions that might be called by triggers:' as info;
SELECT 
    routine_name,
    routine_type,
    routine_definition
FROM information_schema.routines 
WHERE routine_definition ILIKE '%tables%'
   OR routine_definition ILIKE '%table_sessions%'
   OR routine_definition ILIKE '%INSERT INTO%';

-- 4. Try to create a table with the exact label that's causing the error
SELECT 'Testing with Fixed Test Table label:' as info;
INSERT INTO tables (venue_id, label, seat_count, area, is_active)
VALUES ('venue-1e02af4d', 'Fixed Test Table', 2, 'Test Area', true)
RETURNING id, venue_id, label, seat_count, is_active, created_at;

-- 5. Check if there are any constraints that might be causing issues
SELECT 'Constraints on tables table:' as info;
SELECT 
    conname as constraint_name,
    contype as constraint_type,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conrelid = 'tables'::regclass;
