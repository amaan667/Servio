-- SIMPLE FIX for Reserved Table Count Issue
-- Run this in Supabase SQL Editor

-- 1. Check current table states (to see what's causing Reserved=1)
SELECT 
    table_id,
    label,
    primary_status,
    reservation_status
FROM table_runtime_state 
WHERE venue_id = 'venue-1e02af4d'
ORDER BY label;

-- 2. THE FIX: Clear all stale reservation statuses
UPDATE table_runtime_state 
SET reservation_status = 'NONE'
WHERE venue_id = 'venue-1e02af4d'
  AND reservation_status IN ('RESERVED_NOW', 'RESERVED_LATER');

-- 3. Verify fix worked (should return 0)
SELECT 
    COUNT(*) as reserved_count_should_be_zero
FROM table_runtime_state 
WHERE venue_id = 'venue-1e02af4d'
  AND reservation_status IN ('RESERVED_NOW', 'RESERVED_LATER');
