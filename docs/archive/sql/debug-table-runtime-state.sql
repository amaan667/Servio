-- Debug the table_runtime_state view that's causing 400 errors

-- 1. Check if the table_runtime_state view exists
SELECT 'Checking if table_runtime_state view exists:' as info;
SELECT 
    table_name,
    table_type,
    table_schema
FROM information_schema.tables 
WHERE table_name = 'table_runtime_state'
  AND table_schema = 'public';

-- 2. Get the definition of the table_runtime_state view
SELECT 'Table_runtime_state view definition:' as info;
SELECT 
    view_definition
FROM information_schema.views 
WHERE table_name = 'table_runtime_state'
  AND table_schema = 'public';

-- 3. Check what columns the view has
SELECT 'Table_runtime_state view columns:' as info;
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'table_runtime_state'
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- 4. Try to query the view directly to see the error
SELECT 'Testing table_runtime_state view query:' as info;
SELECT *
FROM table_runtime_state
WHERE venue_id = 'venue-1e02af4d'
ORDER BY label ASC
LIMIT 5;

-- 5. Check if there are any functions that might be used in the view
SELECT 'Functions that might be used in the view:' as info;
SELECT 
    routine_name,
    routine_definition
FROM information_schema.routines 
WHERE routine_definition ILIKE '%table_runtime_state%'
   OR routine_definition ILIKE '%get_venue_tables%'
   OR routine_definition ILIKE '%venue_tables_view%';
