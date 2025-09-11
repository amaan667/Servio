-- CORRECT FIX for Reserved Table Count Issue
-- table_runtime_state is a VIEW, not a table, so we can't update it directly
-- We need to update the underlying tables table instead

-- 1. First, let's see what's in the tables table
SELECT 
    '=== TABLES TABLE DATA ===' as step,
    id,
    label,
    venue_id,
    is_active
FROM tables 
WHERE venue_id = 'venue-1e02af4d'
ORDER BY label;

-- 2. Check the view to see what's causing Reserved=1
SELECT 
    '=== VIEW DATA (what we see in dashboard) ===' as step,
    table_id,
    label,
    primary_status,
    reservation_status
FROM table_runtime_state 
WHERE venue_id = 'venue-1e02af4d'
ORDER BY label;

-- 3. The issue is likely in the view logic, not the data
-- Let's check if there are any actual reservations
SELECT 
    '=== ACTIVE RESERVATIONS ===' as step,
    COUNT(*) as active_reservation_count
FROM reservations 
WHERE venue_id = 'venue-1e02af4d' 
  AND status = 'BOOKED'
  AND end_at > NOW();

-- 4. If there are no active reservations, the view logic needs to be fixed
-- The view should not show any tables as reserved if there are no active reservations

-- 5. Check what the view definition looks like
SELECT 
    '=== VIEW DEFINITION ===' as step,
    definition
FROM pg_views 
WHERE viewname = 'table_runtime_state';

-- SOLUTION: The view logic needs to be updated to properly handle reservation status
-- This is a view definition issue, not a data issue
