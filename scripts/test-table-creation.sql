-- Test script to check table creation functionality
-- This will help diagnose why table creation isn't working

-- 1. Check if the tables table exists and has the right structure
SELECT 
    column_name, 
    data_type, 
    is_nullable, 
    column_default
FROM information_schema.columns 
WHERE table_name = 'tables' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- 2. Check if table_sessions table exists and has the right structure
SELECT 
    column_name, 
    data_type, 
    is_nullable, 
    column_default
FROM information_schema.columns 
WHERE table_name = 'table_sessions' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- 3. Check RLS policies on tables table
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'tables';

-- 4. Check RLS policies on table_sessions table
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'table_sessions';

-- 5. Check if there are any existing tables for testing
SELECT 
    t.id,
    t.venue_id,
    t.label,
    t.seat_count,
    t.is_active,
    t.created_at,
    ts.id as session_id,
    ts.status,
    ts.opened_at
FROM tables t
LEFT JOIN table_sessions ts ON t.id = ts.table_id AND ts.closed_at IS NULL
ORDER BY t.created_at DESC
LIMIT 5;

-- 6. Check if the tables_with_sessions view exists
SELECT 
    table_name,
    table_type
FROM information_schema.tables 
WHERE table_name = 'tables_with_sessions' 
AND table_schema = 'public';
