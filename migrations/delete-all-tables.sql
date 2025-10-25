-- NUCLEAR OPTION: Delete ALL tables and table sessions for venue-1e02af4d
-- This will completely reset the table management for this venue

-- Step 1: Clear table references from orders to avoid foreign key constraints
UPDATE orders
SET table_id = NULL
WHERE venue_id = 'venue-1e02af4d';

-- Step 2: Delete all table sessions
DELETE FROM table_sessions
WHERE venue_id = 'venue-1e02af4d';

-- Step 3: Delete all tables
DELETE FROM tables
WHERE venue_id = 'venue-1e02af4d';

-- Verify deletion
SELECT 'Tables remaining: ' || COUNT(*) || ' (should be 0)' AS tables_result
FROM tables WHERE venue_id = 'venue-1e02af4d';

SELECT 'Sessions remaining: ' || COUNT(*) || ' (should be 0)' AS sessions_result
FROM table_sessions WHERE venue_id = 'venue-1e02af4d';

-- Note: table_runtime_state is a VIEW, not a table - it will automatically update

