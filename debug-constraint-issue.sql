-- Debug the actual constraint violation issue
-- Since the trigger doesn't exist, let's find what's causing the duplicate sessions

-- 1. Check what constraints exist on table_sessions
SELECT 'Constraints on table_sessions:' as info;
SELECT 
    conname as constraint_name,
    contype as constraint_type,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conrelid = 'table_sessions'::regclass;

-- 2. Check for any existing duplicate sessions
SELECT 'Existing duplicate sessions:' as info;
SELECT 
    table_id,
    COUNT(*) as session_count,
    STRING_AGG(id::TEXT, ', ') as session_ids,
    STRING_AGG(status::TEXT, ', ') as statuses,
    STRING_AGG(COALESCE(closed_at::TEXT, 'NULL'), ', ') as closed_dates
FROM table_sessions 
WHERE closed_at IS NULL
GROUP BY table_id
HAVING COUNT(*) > 1;

-- 3. Check all open sessions for the venue
SELECT 'All open sessions for venue:' as info;
SELECT 
    ts.id,
    ts.table_id,
    ts.status,
    ts.opened_at,
    ts.closed_at,
    t.label as table_label
FROM table_sessions ts
JOIN tables t ON ts.table_id = t.id
WHERE t.venue_id = 'venue-1e02af4d'
  AND ts.closed_at IS NULL
ORDER BY ts.opened_at DESC;

-- 4. Check if there are any functions that might be creating sessions
SELECT 'Functions that might create sessions:' as info;
SELECT 
    routine_name,
    routine_type,
    routine_definition
FROM information_schema.routines 
WHERE routine_definition ILIKE '%table_sessions%'
   OR routine_definition ILIKE '%INSERT INTO table_sessions%';

-- 5. Check for any triggers on table_sessions itself
SELECT 'Triggers on table_sessions:' as info;
SELECT 
    trigger_name,
    event_manipulation,
    action_timing,
    action_statement
FROM information_schema.triggers 
WHERE event_object_table = 'table_sessions';

-- 6. Try to create a table and see what happens
SELECT 'Attempting to create test table:' as info;
INSERT INTO tables (venue_id, label, seat_count, area, is_active)
VALUES ('venue-1e02af4d', 'Debug Test Table', 2, 'Debug Area', true)
RETURNING id, venue_id, label, seat_count, is_active, created_at;

-- 7. Check if a session was automatically created for the new table
SELECT 'Checking for auto-created session:' as info;
SELECT 
    ts.id,
    ts.table_id,
    ts.status,
    ts.opened_at,
    ts.closed_at,
    t.label as table_label
FROM table_sessions ts
JOIN tables t ON ts.table_id = t.id
WHERE t.venue_id = 'venue-1e02af4d'
  AND t.label = 'Debug Test Table'
  AND ts.closed_at IS NULL;

-- 8. Now try to manually create a session for this table
SELECT 'Attempting to create session manually:' as info;
INSERT INTO table_sessions (venue_id, table_id, status, opened_at, closed_at)
SELECT 
    'venue-1e02af4d',
    t.id,
    'FREE',
    NOW(),
    NULL
FROM tables t
WHERE t.venue_id = 'venue-1e02af4d' 
  AND t.label = 'Debug Test Table'
RETURNING id, table_id, status;
