-- Quick Diagnostic - Check what's actually in the database

-- 1. Check total orders
SELECT 'TOTAL ORDERS' as check_type, COUNT(*) as count FROM orders WHERE venue_id = 'venue-1e02af4d';

-- 2. Check payment status distribution
SELECT 'PAYMENT STATUS' as check_type, payment_status, COUNT(*) as count 
FROM orders WHERE venue_id = 'venue-1e02af4d' 
GROUP BY payment_status;

-- 3. Check current time boundaries
SELECT 
    'TIME BOUNDARIES' as check_type,
    NOW() as current_time,
    NOW() - INTERVAL '30 minutes' as thirty_minutes_ago,
    DATE_TRUNC('day', NOW()) as start_of_today;

-- 4. Test the exact API queries
SELECT 
    'LIVE ORDERS QUERY' as check_type,
    COUNT(*) as count
FROM orders
WHERE venue_id = 'venue-1e02af4d'
  AND payment_status = 'PAID'
  AND created_at >= NOW() - INTERVAL '30 minutes';

SELECT 
    'EARLIER TODAY QUERY' as check_type,
    COUNT(*) as count
FROM orders
WHERE venue_id = 'venue-1e02af4d'
  AND payment_status = 'PAID'
  AND created_at >= DATE_TRUNC('day', NOW())
  AND created_at < NOW() - INTERVAL '30 minutes';

SELECT 
    'HISTORY QUERY' as check_type,
    COUNT(*) as count
FROM orders
WHERE venue_id = 'venue-1e02af4d'
  AND payment_status = 'PAID'
  AND created_at < DATE_TRUNC('day', NOW());

-- 5. Show sample orders with their details
SELECT 
    'SAMPLE ORDERS' as check_type,
    id,
    customer_name,
    payment_status,
    created_at,
    EXTRACT(EPOCH FROM (NOW() - created_at))/60 as minutes_ago,
    CASE 
        WHEN created_at >= NOW() - INTERVAL '30 minutes' THEN 'LIVE'
        WHEN created_at >= DATE_TRUNC('day', NOW()) THEN 'EARLIER_TODAY'
        ELSE 'HISTORY'
    END as should_appear_in
FROM orders 
WHERE venue_id = 'venue-1e02af4d'
ORDER BY created_at DESC
LIMIT 5;
