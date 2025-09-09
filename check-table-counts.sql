-- Check current table counts for venue-1e02af4d
-- This should show 5 free tables, 3 occupied tables, 8 total tables

-- Show all tables with their current status
SELECT 
    'Current table states:' as info,
    table_id,
    label as table_number,
    primary_status,
    reservation_status,
    opened_at,
    CASE 
        WHEN primary_status = 'FREE' THEN 'Should count as FREE'
        WHEN primary_status = 'OCCUPIED' THEN 'Should count as OCCUPIED'
        ELSE 'Other status'
    END as expected_count_category
FROM table_runtime_state
WHERE venue_id = 'venue-1e02af4d'
ORDER BY label;

-- Count by primary_status (this should match the dashboard)
SELECT 
    'Counts by primary_status:' as info,
    primary_status,
    COUNT(*) as count,
    CASE 
        WHEN primary_status = 'FREE' THEN 'Should show 5 in dashboard'
        WHEN primary_status = 'OCCUPIED' THEN 'Should show 3 in dashboard'
        ELSE 'Other'
    END as dashboard_expectation
FROM table_runtime_state
WHERE venue_id = 'venue-1e02af4d'
GROUP BY primary_status
ORDER BY primary_status;

-- Count by reservation_status
SELECT 
    'Counts by reservation_status:' as info,
    reservation_status,
    COUNT(*) as count
FROM table_runtime_state
WHERE venue_id = 'venue-1e02af4d'
GROUP BY reservation_status
ORDER BY reservation_status;

-- Test the current api_table_counters function
SELECT 
    'Current api_table_counters result:' as info,
    api_table_counters('venue-1e02af4d') as result;

-- Expected result should be:
-- {
--   "total_tables": 8,
--   "available": 5,  -- This should be 5, not 4
--   "occupied": 3,
--   "reserved_now": 0,
--   "reserved_later": 0,
--   "unassigned_reservations": 0
-- }
