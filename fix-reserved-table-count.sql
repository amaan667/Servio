-- Fix Reserved Table Count Issue
-- The problem: Table shows "Reserved 1" but no tables are visually reserved
-- Root cause: Stale reservation_status in table_runtime_state

SELECT '=== DIAGNOSING RESERVED TABLE ISSUE ===' as step;

-- Check current table_runtime_state data
SELECT 
    'Current table_runtime_state data' as description,
    table_id,
    label,
    venue_id,
    primary_status,
    reservation_status,
    created_at
FROM table_runtime_state 
WHERE venue_id = 'venue-1e02af4d'
ORDER BY label;

-- Check if there are any active reservations
SELECT 
    'Active reservations' as description,
    id,
    table_id,
    start_at,
    end_at,
    status
FROM reservations 
WHERE venue_id = 'venue-1e02af4d' 
  AND status = 'BOOKED'
  AND end_at > NOW()
ORDER BY start_at;

SELECT '=== FIXING RESERVED COUNT ===' as step;

-- Clear any stale reservation_status where there's no active reservation
UPDATE table_runtime_state 
SET reservation_status = 'NONE'
WHERE venue_id = 'venue-1e02af4d'
  AND reservation_status IN ('RESERVED_NOW', 'RESERVED_LATER')
  AND table_id NOT IN (
    SELECT table_id 
    FROM reservations 
    WHERE venue_id = 'venue-1e02af4d' 
      AND status = 'BOOKED'
      AND end_at > NOW()
      AND table_id IS NOT NULL
  );

-- Verify the fix
SELECT '=== VERIFICATION ===' as step;

SELECT 
    'After fix - table_runtime_state' as description,
    table_id,
    label,
    primary_status,
    reservation_status
FROM table_runtime_state 
WHERE venue_id = 'venue-1e02af4d'
ORDER BY label;

-- Count reserved tables (should be 0 now)
SELECT 
    'Reserved count should be 0' as description,
    COUNT(*) as reserved_count
FROM table_runtime_state 
WHERE venue_id = 'venue-1e02af4d'
  AND reservation_status IN ('RESERVED_NOW', 'RESERVED_LATER');

SELECT '✅ Reserved table count fixed!' as status;
