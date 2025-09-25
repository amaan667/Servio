-- RESET TABLES FOR NEW DAY: Close all active table sessions to reset table states

-- ============================================================================
-- STEP 1: Check current table sessions
-- ============================================================================

SELECT 
    '=== CURRENT TABLE SESSIONS ===' as info;

-- Show all active table sessions
SELECT 
    'Active table sessions:' as info,
    ts.id,
    ts.table_id,
    ts.venue_id,
    ts.status,
    ts.opened_at,
    ts.closed_at,
    t.label as table_label
FROM table_sessions ts
JOIN tables t ON ts.table_id = t.id
WHERE ts.venue_id = 'venue-1e02af4d'
  AND ts.closed_at IS NULL
ORDER BY ts.opened_at DESC;

-- ============================================================================
-- STEP 2: Close all active table sessions for new day
-- ============================================================================

SELECT 
    '=== CLOSING ALL ACTIVE SESSIONS ===' as info;

-- Close all active table sessions for this venue
UPDATE table_sessions 
SET 
    closed_at = NOW(),
    status = 'CLOSED'
WHERE venue_id = 'venue-1e02af4d'
  AND closed_at IS NULL;

-- Show how many sessions were closed
SELECT 
    'Sessions closed:' as info,
    COUNT(*) as closed_count
FROM table_sessions 
WHERE venue_id = 'venue-1e02af4d'
  AND closed_at IS NOT NULL
  AND DATE(closed_at) = CURRENT_DATE;

-- ============================================================================
-- STEP 3: Verify table states after reset
-- ============================================================================

SELECT 
    '=== TABLE STATES AFTER RESET ===' as info;

-- Check table_runtime_state view after reset
SELECT 
    'Table states after reset:' as info,
    id,
    label,
    status,
    seat_count
FROM table_runtime_state 
WHERE venue_id = 'venue-1e02af4d'
ORDER BY label;

-- Count tables by status
SELECT 
    'Table counts by status:' as info,
    status,
    COUNT(*) as count
FROM table_runtime_state 
WHERE venue_id = 'venue-1e02af4d'
GROUP BY status
ORDER BY status;

-- ============================================================================
-- STEP 4: Test dashboard counts after reset
-- ============================================================================

SELECT 
    '=== DASHBOARD COUNTS AFTER RESET ===' as info;

-- Test the dashboard_counts function
SELECT 
    'Dashboard counts after reset:' as info,
    live_count as "Live Orders",
    earlier_today_count as "Earlier Today",
    history_count as "History",
    today_orders_count as "Today's Orders Total",
    active_tables_count as "Active Tables",
    tables_set_up as "Tables Set Up",
    tables_in_use as "Tables In Use"
FROM dashboard_counts('venue-1e02af4d', 'Europe/London', 30);
