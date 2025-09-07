-- Quick database check to diagnose loading issues
-- Run this to see what's wrong with the database

-- Check if tables table exists and has data
SELECT 'TABLES TABLE CHECK' as check_type;
SELECT COUNT(*) as table_count FROM tables;
SELECT id, venue_id, label, is_active FROM tables LIMIT 5;

-- Check if table_sessions table exists and has data
SELECT 'TABLE_SESSIONS TABLE CHECK' as check_type;
SELECT COUNT(*) as session_count FROM table_sessions;
SELECT id, table_id, venue_id, status FROM table_sessions LIMIT 5;

-- Check if table_sessions has the required columns
SELECT 'TABLE_SESSIONS COLUMNS CHECK' as check_type;
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'table_sessions' 
ORDER BY ordinal_position;

-- Check if table_status enum exists and has values
SELECT 'TABLE_STATUS ENUM CHECK' as check_type;
SELECT unnest(enum_range(NULL::table_status)) as enum_values;

-- Check if tables_with_sessions view exists
SELECT 'TABLES_WITH_SESSIONS VIEW CHECK' as check_type;
SELECT COUNT(*) as view_count FROM tables_with_sessions LIMIT 1;

-- Check for any recent errors in table_sessions
SELECT 'RECENT TABLE_SESSIONS DATA' as check_type;
SELECT id, table_id, venue_id, status, created_at, updated_at 
FROM table_sessions 
ORDER BY created_at DESC 
LIMIT 10;
