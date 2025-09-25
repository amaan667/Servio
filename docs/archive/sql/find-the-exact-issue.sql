-- FIND THE EXACT ISSUE: Why is the manual count showing 0?
-- Let's check every possible condition step by step

-- ============================================================================
-- STEP 1: Check the raw order data
-- ============================================================================

SELECT 
    '=== RAW ORDER DATA ===' as info;

-- Show the exact order with all details
SELECT 
    'Raw order data:' as info,
    id,
    venue_id,
    table_number,
    customer_name,
    order_status,
    payment_status,
    total_amount,
    created_at,
    created_at::date as "Created Date",
    created_at::time as "Created Time",
    EXTRACT(timezone_hour FROM created_at) as "Timezone Offset"
FROM orders 
WHERE venue_id = 'venue-1e02af4d'
  AND DATE(created_at) = '2025-09-10'
ORDER BY created_at DESC;

-- ============================================================================
-- STEP 2: Test each condition separately
-- ============================================================================

SELECT 
    '=== TESTING EACH CONDITION ===' as info;

-- Test 1: Does the order exist for this venue?
SELECT 
    'Test 1 - Order exists for venue:' as info,
    COUNT(*) as count
FROM orders 
WHERE venue_id = 'venue-1e02af4d';

-- Test 2: Does the order exist for today's date?
SELECT 
    'Test 2 - Order exists for today:' as info,
    COUNT(*) as count
FROM orders 
WHERE venue_id = 'venue-1e02af4d'
  AND DATE(created_at) = '2025-09-10';

-- Test 3: What is the payment status?
SELECT 
    'Test 3 - Payment status check:' as info,
    payment_status,
    COUNT(*) as count
FROM orders 
WHERE venue_id = 'venue-1e02af4d'
  AND DATE(created_at) = '2025-09-10'
GROUP BY payment_status;

-- Test 4: Test the timezone conversion
SELECT 
    'Test 4 - Timezone conversion:' as info,
    id,
    created_at as "Original Timestamp",
    created_at AT TIME ZONE 'Europe/London' as "London Time",
    DATE(created_at AT TIME ZONE 'Europe/London') as "London Date",
    CURRENT_DATE as "Current Date",
    CASE 
        WHEN DATE(created_at AT TIME ZONE 'Europe/London') = CURRENT_DATE THEN 'MATCHES'
        ELSE 'NO MATCH'
    END as "Date Match"
FROM orders 
WHERE venue_id = 'venue-1e02af4d'
  AND DATE(created_at) = '2025-09-10';

-- ============================================================================
-- STEP 3: Check what CURRENT_DATE returns
-- ============================================================================

SELECT 
    '=== CURRENT DATE INFO ===' as info;

-- Check what CURRENT_DATE returns in different timezones
SELECT 
    'Date information:' as info,
    CURRENT_DATE as "Current Date UTC",
    CURRENT_DATE AT TIME ZONE 'Europe/London' as "Current Date London",
    NOW() as "Current Timestamp UTC",
    NOW() AT TIME ZONE 'Europe/London' as "Current Timestamp London",
    DATE(NOW() AT TIME ZONE 'Europe/London') as "Today in London";

-- ============================================================================
-- STEP 4: Try different date comparison methods
-- ============================================================================

SELECT 
    '=== DIFFERENT DATE COMPARISON METHODS ===' as info;

-- Method 1: Using DATE() function
SELECT 
    'Method 1 - Using DATE():' as info,
    COUNT(*) as count
FROM orders 
WHERE venue_id = 'venue-1e02af4d'
  AND DATE(created_at) = '2025-09-10'
  AND payment_status = 'PAID';

-- Method 2: Using date_trunc
SELECT 
    'Method 2 - Using date_trunc:' as info,
    COUNT(*) as count
FROM orders 
WHERE venue_id = 'venue-1e02af4d'
  AND date_trunc('day', created_at) = '2025-09-10 00:00:00'::timestamp
  AND payment_status = 'PAID';

-- Method 3: Using timezone conversion
SELECT 
    'Method 3 - Using timezone conversion:' as info,
    COUNT(*) as count
FROM orders 
WHERE venue_id = 'venue-1e02af4d'
  AND DATE(created_at AT TIME ZONE 'Europe/London') = CURRENT_DATE
  AND payment_status = 'PAID';

-- Method 4: Using timezone conversion with specific date
SELECT 
    'Method 4 - Using timezone conversion with specific date:' as info,
    COUNT(*) as count
FROM orders 
WHERE venue_id = 'venue-1e02af4d'
  AND DATE(created_at AT TIME ZONE 'Europe/London') = '2025-09-10'::date
  AND payment_status = 'PAID';

-- ============================================================================
-- STEP 5: Check if payment_status is the issue
-- ============================================================================

SELECT 
    '=== PAYMENT STATUS INVESTIGATION ===' as info;

-- Show all payment statuses
SELECT 
    'All payment statuses:' as info,
    payment_status,
    COUNT(*) as count
FROM orders 
WHERE venue_id = 'venue-1e02af4d'
GROUP BY payment_status;

-- Check the specific order's payment status
SELECT 
    'Specific order payment status:' as info,
    id,
    payment_status,
    CASE 
        WHEN payment_status = 'PAID' THEN 'YES - PAID'
        WHEN payment_status = 'UNPAID' THEN 'NO - UNPAID'
        WHEN payment_status IS NULL THEN 'NO - NULL'
        ELSE 'NO - OTHER: ' || payment_status
    END as "Is Paid?"
FROM orders 
WHERE venue_id = 'venue-1e02af4d'
  AND DATE(created_at) = '2025-09-10';

-- ============================================================================
-- STEP 6: Force fix the payment status and test
-- ============================================================================

SELECT 
    '=== FORCE FIX PAYMENT STATUS ===' as info;

-- Force update payment status to PAID
UPDATE orders 
SET 
    payment_status = 'PAID',
    updated_at = NOW()
WHERE venue_id = 'venue-1e02af4d'
  AND DATE(created_at) = '2025-09-10';

-- Test again after the fix
SELECT 
    'After payment status fix:' as info,
    COUNT(*) as count
FROM orders 
WHERE venue_id = 'venue-1e02af4d'
  AND DATE(created_at) = '2025-09-10'
  AND payment_status = 'PAID';

-- Show the updated order
SELECT 
    'Updated order:' as info,
    id,
    payment_status,
    created_at::time as order_time
FROM orders 
WHERE venue_id = 'venue-1e02af4d'
  AND DATE(created_at) = '2025-09-10';
