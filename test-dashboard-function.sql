-- Test the dashboard_counts function to see what it's returning
-- The live orders page shows 1 order, but dashboard shows 0

-- ============================================================================
-- STEP 1: Test the current function
-- ============================================================================

SELECT 
    '=== CURRENT FUNCTION RESULT ===' as info;

SELECT 
    'dashboard_counts function result:' as info,
    live_count as "Live Orders",
    earlier_today_count as "Earlier Today",
    history_count as "History",
    today_orders_count as "Today's Orders Total",
    active_tables_count as "Active Tables",
    tables_set_up as "Tables Set Up",
    tables_in_use as "Tables In Use"
FROM dashboard_counts('venue-1e02af4d', 'Europe/London', 30);

-- ============================================================================
-- STEP 2: Check what orders actually exist
-- ============================================================================

SELECT 
    '=== ACTUAL ORDERS ===' as info;

-- Show all orders from today
SELECT 
    'All orders from today:' as info,
    id,
    table_number,
    customer_name,
    order_status,
    payment_status,
    total_amount,
    created_at::time as order_time,
    created_at as full_timestamp
FROM orders 
WHERE venue_id = 'venue-1e02af4d'
  AND DATE(created_at) = '2025-09-10'
ORDER BY created_at DESC;

-- ============================================================================
-- STEP 3: Check timezone calculations
-- ============================================================================

SELECT 
    '=== TIMEZONE CALCULATIONS ===' as info;

-- Check what the function is calculating for time windows
SELECT 
    'Time calculations:' as info,
    NOW() as "Current UTC",
    NOW() AT TIME ZONE 'Europe/London' as "Current London",
    date_trunc('day', NOW() AT TIME ZONE 'Europe/London') AT TIME ZONE 'Europe/London' as "Today Start",
    date_trunc('day', NOW() AT TIME ZONE 'Europe/London') AT TIME ZONE 'Europe/London' + INTERVAL '1 day' - INTERVAL '1 second' as "Today End",
    NOW() - INTERVAL '30 minutes' as "Live Cutoff";

-- ============================================================================
-- STEP 4: Manual calculation to compare
-- ============================================================================

SELECT 
    '=== MANUAL CALCULATION ===' as info;

-- Manual calculation using the same logic as the function
WITH time_windows AS (
    SELECT 
        date_trunc('day', NOW() AT TIME ZONE 'Europe/London') AT TIME ZONE 'Europe/London' as today_start,
        date_trunc('day', NOW() AT TIME ZONE 'Europe/London') AT TIME ZONE 'Europe/London' + INTERVAL '1 day' - INTERVAL '1 second' as today_end,
        NOW() - INTERVAL '30 minutes' as live_cutoff
),
order_counts AS (
    SELECT 
        COUNT(CASE 
            WHEN created_at >= (SELECT live_cutoff FROM time_windows)
            AND created_at >= (SELECT today_start FROM time_windows)
            AND created_at <= (SELECT today_end FROM time_windows)
            AND payment_status = 'PAID'
            THEN 1 
        END) as live_count,
        
        COUNT(CASE 
            WHEN created_at < (SELECT live_cutoff FROM time_windows)
            AND created_at >= (SELECT today_start FROM time_windows)
            AND created_at <= (SELECT today_end FROM time_windows)
            AND payment_status = 'PAID'
            THEN 1 
        END) as earlier_today_count,
        
        COUNT(CASE 
            WHEN created_at >= (SELECT today_start FROM time_windows)
            AND created_at <= (SELECT today_end FROM time_windows)
            AND payment_status = 'PAID'
            THEN 1 
        END) as today_orders_count
    FROM orders 
    WHERE venue_id = 'venue-1e02af4d'
)
SELECT 
    'Manual calculation:' as info,
    live_count as "Live Orders",
    earlier_today_count as "Earlier Today",
    today_orders_count as "Today's Orders Total"
FROM order_counts;

-- ============================================================================
-- STEP 5: Check if the order is within the time windows
-- ============================================================================

SELECT 
    '=== ORDER TIME ANALYSIS ===' as info;

-- Check if the order falls within the calculated time windows
WITH time_windows AS (
    SELECT 
        date_trunc('day', NOW() AT TIME ZONE 'Europe/London') AT TIME ZONE 'Europe/London' as today_start,
        date_trunc('day', NOW() AT TIME ZONE 'Europe/London') AT TIME ZONE 'Europe/London' + INTERVAL '1 day' - INTERVAL '1 second' as today_end,
        NOW() - INTERVAL '30 minutes' as live_cutoff
)
SELECT 
    'Order time analysis:' as info,
    o.id,
    o.created_at as "Order Time",
    tw.today_start as "Today Start",
    tw.today_end as "Today End", 
    tw.live_cutoff as "Live Cutoff",
    CASE 
        WHEN o.created_at >= tw.today_start AND o.created_at <= tw.today_end THEN 'WITHIN TODAY'
        ELSE 'OUTSIDE TODAY'
    END as "Today Status",
    CASE 
        WHEN o.created_at >= tw.live_cutoff THEN 'WITHIN LIVE WINDOW'
        ELSE 'OUTSIDE LIVE WINDOW'
    END as "Live Status",
    o.payment_status
FROM orders o, time_windows tw
WHERE o.venue_id = 'venue-1e02af4d'
  AND DATE(o.created_at) = '2025-09-10';
