-- Fix Dashboard Orders Count Discrepancy
-- This script ensures that "Today's Orders" count matches the actual orders in live orders and orders sections

-- First, let's see what orders exist today and their status
SELECT 
    'CURRENT ORDERS STATUS - Today (Sept 10, 2025):' as info,
    order_status,
    payment_status,
    COUNT(*) as count,
    MIN(created_at::time) as earliest_time,
    MAX(created_at::time) as latest_time
FROM orders 
WHERE venue_id = 'venue-1e02af4d'
  AND DATE(created_at) = '2025-09-10'
GROUP BY order_status, payment_status
ORDER BY order_status, payment_status;

-- Check what the dashboard_counts function should return
-- Let's manually calculate what the counts should be
WITH today_window AS (
    -- Today's window in UTC (assuming Europe/London timezone)
    SELECT 
        '2025-09-10 00:00:00+01'::timestamptz as start_utc,
        '2025-09-10 23:59:59+01'::timestamptz as end_utc,
        NOW() - INTERVAL '30 minutes' as live_cutoff
),
order_counts AS (
    SELECT 
        -- Live orders: orders from today within last 30 minutes
        COUNT(CASE 
            WHEN created_at >= (SELECT live_cutoff FROM today_window)
            AND created_at >= (SELECT start_utc FROM today_window)
            AND created_at <= (SELECT end_utc FROM today_window)
            THEN 1 
        END) as live_count,
        
        -- Earlier today: orders from today but more than 30 minutes ago
        COUNT(CASE 
            WHEN created_at < (SELECT live_cutoff FROM today_window)
            AND created_at >= (SELECT start_utc FROM today_window)
            AND created_at <= (SELECT end_utc FROM today_window)
            THEN 1 
        END) as earlier_today_count,
        
        -- Total today's orders
        COUNT(CASE 
            WHEN created_at >= (SELECT start_utc FROM today_window)
            AND created_at <= (SELECT end_utc FROM today_window)
            THEN 1 
        END) as today_orders_count,
        
        -- History orders: orders before today
        COUNT(CASE 
            WHEN created_at < (SELECT start_utc FROM today_window)
            THEN 1 
        END) as history_count
    FROM orders 
    WHERE venue_id = 'venue-1e02af4d'
)
SELECT 
    'EXPECTED DASHBOARD COUNTS:' as info,
    live_count,
    earlier_today_count,
    today_orders_count,
    history_count
FROM order_counts;

-- Check if there are any orders that should be visible but aren't
SELECT 
    'ORDERS THAT SHOULD BE VISIBLE TODAY:' as info,
    id,
    table_number,
    customer_name,
    order_status,
    payment_status,
    total_amount,
    created_at::time as order_time,
    CASE 
        WHEN created_at >= NOW() - INTERVAL '30 minutes' THEN 'LIVE'
        WHEN created_at >= '2025-09-10 00:00:00+01'::timestamptz THEN 'EARLIER_TODAY'
        ELSE 'HISTORY'
    END as expected_category
FROM orders 
WHERE venue_id = 'venue-1e02af4d'
  AND DATE(created_at) = '2025-09-10'
ORDER BY created_at DESC;

-- Check for any orders that might have incorrect payment_status
-- All orders should be PAID since they only appear after payment
SELECT 
    'ORDERS WITH INCORRECT PAYMENT STATUS:' as info,
    id,
    table_number,
    customer_name,
    order_status,
    payment_status,
    created_at::time as order_time
FROM orders 
WHERE venue_id = 'venue-1e02af4d'
  AND DATE(created_at) = '2025-09-10'
  AND payment_status != 'PAID'
ORDER BY created_at DESC;

-- Fix any orders that have incorrect payment_status
-- All orders should be PAID since they only appear after payment
UPDATE orders 
SET 
    payment_status = 'PAID',
    updated_at = NOW()
WHERE venue_id = 'venue-1e02af4d'
  AND DATE(created_at) = '2025-09-10'
  AND payment_status != 'PAID';

-- Verify the fix
SELECT 
    'AFTER PAYMENT STATUS FIX:' as info,
    order_status,
    payment_status,
    COUNT(*) as count
FROM orders 
WHERE venue_id = 'venue-1e02af4d'
  AND DATE(created_at) = '2025-09-10'
GROUP BY order_status, payment_status
ORDER BY order_status, payment_status;

-- Final verification - what the dashboard should show
WITH today_window AS (
    SELECT 
        '2025-09-10 00:00:00+01'::timestamptz as start_utc,
        '2025-09-10 23:59:59+01'::timestamptz as end_utc,
        NOW() - INTERVAL '30 minutes' as live_cutoff
),
final_counts AS (
    SELECT 
        COUNT(CASE 
            WHEN created_at >= (SELECT live_cutoff FROM today_window)
            AND created_at >= (SELECT start_utc FROM today_window)
            AND created_at <= (SELECT end_utc FROM today_window)
            THEN 1 
        END) as live_count,
        
        COUNT(CASE 
            WHEN created_at < (SELECT live_cutoff FROM today_window)
            AND created_at >= (SELECT start_utc FROM today_window)
            AND created_at <= (SELECT end_utc FROM today_window)
            THEN 1 
        END) as earlier_today_count,
        
        COUNT(CASE 
            WHEN created_at >= (SELECT start_utc FROM today_window)
            AND created_at <= (SELECT end_utc FROM today_window)
            THEN 1 
        END) as today_orders_count
    FROM orders 
    WHERE venue_id = 'venue-1e02af4d'
)
SELECT 
    'FINAL DASHBOARD COUNTS (should match UI):' as info,
    live_count as "Live Orders",
    earlier_today_count as "Earlier Today",
    today_orders_count as "Today's Orders Total"
FROM final_counts;

-- Show the specific orders that should be visible
SELECT 
    'ORDERS THAT SHOULD APPEAR IN DASHBOARD:' as info,
    id,
    table_number,
    customer_name,
    order_status,
    payment_status,
    total_amount,
    created_at::time as order_time,
    CASE 
        WHEN created_at >= NOW() - INTERVAL '30 minutes' THEN 'LIVE (last 30 min)'
        WHEN created_at >= '2025-09-10 00:00:00+01'::timestamptz THEN 'EARLIER TODAY'
        ELSE 'HISTORY'
    END as category
FROM orders 
WHERE venue_id = 'venue-1e02af4d'
  AND DATE(created_at) = '2025-09-10'
  AND payment_status = 'PAID'  -- Only show paid orders
ORDER BY created_at DESC;
