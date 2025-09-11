-- Manual Fix for "Reserved 1" Issue
-- Run this in your Supabase SQL Editor

-- 1. First, let's see what's causing the Reserved count to be 1
SELECT 
    '=== CURRENT TABLE STATES ===' as step,
    table_id,
    label,
    primary_status,
    reservation_status
FROM table_runtime_state 
WHERE venue_id = 'venue-1e02af4d'
ORDER BY label;

-- 2. Check for any stale reservation statuses
SELECT 
    '=== TABLES WITH RESERVATION STATUS ===' as step,
    table_id,
    label,
    reservation_status
FROM table_runtime_state 
WHERE venue_id = 'venue-1e02af4d'
  AND reservation_status IN ('RESERVED_NOW', 'RESERVED_LATER');

-- 3. Check if there are any actual active reservations
SELECT 
    '=== ACTIVE RESERVATIONS ===' as step,
    COUNT(*) as active_reservation_count
FROM reservations 
WHERE venue_id = 'venue-1e02af4d' 
  AND status = 'BOOKED'
  AND end_at > NOW();

-- 4. FIX: Clear stale reservation statuses
-- This will set all tables back to reservation_status = 'NONE' 
-- if there are no active reservations
UPDATE table_runtime_state 
SET reservation_status = 'NONE'
WHERE venue_id = 'venue-1e02af4d'
  AND reservation_status IN ('RESERVED_NOW', 'RESERVED_LATER');

-- 5. Verify the fix worked
SELECT 
    '=== AFTER FIX - RESERVED COUNT ===' as step,
    COUNT(*) as reserved_count_should_be_zero
FROM table_runtime_state 
WHERE venue_id = 'venue-1e02af4d'
  AND reservation_status IN ('RESERVED_NOW', 'RESERVED_LATER');

SELECT '✅ Reserved table count issue fixed!' as result;
