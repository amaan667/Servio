-- Check if the api_remove_table function exists

-- 1. Check if the function exists
SELECT 'Checking for api_remove_table function:' as info;
SELECT 
    routine_name,
    routine_type,
    routine_definition
FROM information_schema.routines 
WHERE routine_name = 'api_remove_table'
  AND routine_schema = 'public';

-- 2. Check what functions exist that might be related to table removal
SELECT 'Functions related to table removal:' as info;
SELECT 
    routine_name,
    routine_type
FROM information_schema.routines 
WHERE routine_name ILIKE '%remove%'
   OR routine_name ILIKE '%delete%'
   OR routine_name ILIKE '%table%'
ORDER BY routine_name;
