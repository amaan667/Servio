-- Debug Dashboard Counts - Find the discrepancy
-- The dashboard shows Today's Orders: 0 and Tables Set Up: 4
-- But there should be 1 order and 8 tables

-- ============================================================================
-- STEP 1: Check what orders exist today
-- ============================================================================

SELECT 
    '=== ORDERS TODAY ===' as info;

-- Check all orders from today
SELECT 
    'All orders from today (Sept 10, 2025):' as info,
    id,
    table_number,
    customer_name,
    order_status,
    payment_status,
    total_amount,
    created_at::time as order_time
FROM orders 
WHERE venue_id = 'venue-1e02af4d'
  AND DATE(created_at) = '2025-09-10'
ORDER BY created_at DESC;

-- Count orders by status
SELECT 
    'Order counts by status:' as info,
    order_status,
    payment_status,
    COUNT(*) as count
FROM orders 
WHERE venue_id = 'venue-1e02af4d'
  AND DATE(created_at) = '2025-09-10'
GROUP BY order_status, payment_status
ORDER BY order_status, payment_status;

-- ============================================================================
-- STEP 2: Check what tables exist
-- ============================================================================

SELECT 
    '=== TABLES ===' as info;

-- Check all tables
SELECT 
    'All tables in table_runtime_state:' as info,
    id,
    label,
    primary_status,
    reservation_status,
    seat_count
FROM table_runtime_state 
WHERE venue_id = 'venue-1e02af4d'
ORDER BY label;

-- Count tables by status
SELECT 
    'Table counts by primary_status:' as info,
    primary_status,
    COUNT(*) as count
FROM table_runtime_state 
WHERE venue_id = 'venue-1e02af4d'
GROUP BY primary_status
ORDER BY primary_status;

-- ============================================================================
-- STEP 3: Test the dashboard_counts function
-- ============================================================================

SELECT 
    '=== DASHBOARD_COUNTS FUNCTION TEST ===' as info;

-- Test the function
SELECT 
    'Function result:' as info,
    live_count as "Live Orders",
    earlier_today_count as "Earlier Today",
    history_count as "History",
    today_orders_count as "Today's Orders Total",
    active_tables_count as "Active Tables",
    tables_set_up as "Tables Set Up",
    tables_in_use as "Tables In Use"
FROM dashboard_counts('venue-1e02af4d', 'Europe/London', 30);

-- ============================================================================
-- STEP 4: Manual calculation to compare
-- ============================================================================

SELECT 
    '=== MANUAL CALCULATION ===' as info;

-- Manual calculation of today's orders
WITH today_window AS (
    SELECT 
        '2025-09-10 00:00:00+01'::timestamptz as start_utc,
        '2025-09-10 23:59:59+01'::timestamptz as end_utc,
        NOW() - INTERVAL '30 minutes' as live_cutoff
),
manual_counts AS (
    SELECT 
        -- Live orders
        COUNT(CASE 
            WHEN created_at >= (SELECT live_cutoff FROM today_window)
            AND created_at >= (SELECT start_utc FROM today_window)
            AND created_at <= (SELECT end_utc FROM today_window)
            AND payment_status = 'PAID'
            THEN 1 
        END) as live_count,
        
        -- Earlier today
        COUNT(CASE 
            WHEN created_at < (SELECT live_cutoff FROM today_window)
            AND created_at >= (SELECT start_utc FROM today_window)
            AND created_at <= (SELECT end_utc FROM today_window)
            AND payment_status = 'PAID'
            THEN 1 
        END) as earlier_today_count,
        
        -- Total today
        COUNT(CASE 
            WHEN created_at >= (SELECT start_utc FROM today_window)
            AND created_at <= (SELECT end_utc FROM today_window)
            AND payment_status = 'PAID'
            THEN 1 
        END) as today_orders_count
    FROM orders 
    WHERE venue_id = 'venue-1e02af4d'
)
SELECT 
    'Manual calculation results:' as info,
    live_count as "Live Orders",
    earlier_today_count as "Earlier Today", 
    today_orders_count as "Today's Orders Total"
FROM manual_counts;

-- Manual calculation of tables
SELECT 
    'Manual table counts:' as info,
    COUNT(*) as "Total Tables",
    COUNT(CASE WHEN primary_status = 'FREE' THEN 1 END) as "Free Tables",
    COUNT(CASE WHEN primary_status = 'OCCUPIED' THEN 1 END) as "Occupied Tables"
FROM table_runtime_state 
WHERE venue_id = 'venue-1e02af4d';

-- ============================================================================
-- STEP 5: Check timezone issues
-- ============================================================================

SELECT 
    '=== TIMEZONE DEBUG ===' as info;

-- Check current time and timezone calculations
SELECT 
    'Current time info:' as info,
    NOW() as "Current UTC Time",
    NOW() AT TIME ZONE 'Europe/London' as "Current London Time",
    date_trunc('day', NOW() AT TIME ZONE 'Europe/London') AT TIME ZONE 'Europe/London' as "Today Start London",
    date_trunc('day', NOW() AT TIME ZONE 'Europe/London') AT TIME ZONE 'Europe/London' + INTERVAL '1 day' - INTERVAL '1 second' as "Today End London";
